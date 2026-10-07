// AI provider abstraction. The rest of the backend only calls generateReply() / isConfigured()
// and passes provider-neutral input: a system prompt, messages, and tool definitions as
// { name, description, parameters (JSON Schema) }. This file is the ONLY place that knows which
// provider is used. Current provider: Google Gemini, via the official `generateContent` REST API
// called with plain fetch (stateless: nothing is stored by the API between requests).
//
// Environment variables (backend/.env, never in the frontend):
//   GEMINI_API_KEY    required, from https://aistudio.google.com/apikey
//   GEMINI_MODEL      optional, defaults to DEFAULT_MODEL
//   GEMINI_BASE_URL   optional, defaults to https://generativelanguage.googleapis.com (tests/proxies)
//   GEMINI_TIMEOUT_MS optional, defaults to 15000

// "-latest" is Google's alias for its current Flash-Lite model (free tier, low cost). Verified
// with a real key: the explicit "gemini-3.5-flash-lite" hung / returned 503 "high demand" and the
// 2.5 models return 404 for new users, while this alias answered in ~4 s. Override with GEMINI_MODEL.
const DEFAULT_MODEL = "gemini-flash-lite-latest";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
// How long a guest may wait for Gemini before the approved-knowledge fallback answers instead.
// Override with GEMINI_TIMEOUT_MS (Gemini's free tier can be slow when Google is busy).
const timeoutMs = () => Number(process.env.GEMINI_TIMEOUT_MS) || 15000;
const MAX_TOOL_ROUNDS = 3;
const MAX_OUTPUT_TOKENS = 1500; // generous so internal "thinking" cannot cut the answer short

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

// JSON Schema (lowercase types) -> Gemini schema (uppercase types).
const toGeminiSchema = (schema) => {
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  if (schema.type) out.type = String(schema.type).toUpperCase();
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.required) out.required = schema.required;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)])
    );
  }
  return out;
};

const toGeminiTools = (tools) =>
  tools && tools.length
    ? [
        {
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: toGeminiSchema(tool.parameters),
          })),
        },
      ]
    : undefined;

// One HTTP call. Returns the first candidate (or null if the prompt was blocked / empty).
const callProvider = async ({ system, contents, tools }) => {
  const model = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).replace(/^models\//, "");
  const url = `${process.env.GEMINI_BASE_URL || DEFAULT_BASE_URL}/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        // Key goes in a header, never in the URL, so it cannot end up in logs or error messages.
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        ...(tools ? { tools } : {}),
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.4 },
      }),
    });

    if (!response.ok) {
      // Status only (e.g. 429 rate limit): never log the key or the response body.
      throw new Error(`AI provider returned status ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.candidates) && data.candidates.length > 0 ? data.candidates[0] : null;
  } finally {
    clearTimeout(timer);
  }
};

// Gemini wants the function result as an object.
const asObject = (output) => {
  if (output && typeof output === "object") return output;
  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return { result: parsed };
  } catch {
    return { result: String(output) };
  }
};

const textOf = (parts) =>
  parts
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();

// Runs the conversation. If the model asks for a tool, executeTool() is called and the result
// is sent back, for at most MAX_TOOL_ROUNDS rounds. Returns the final text ("" if the model
// produced none, e.g. a blocked response).
const generateReply = async ({ system, messages, tools, executeTool }) => {
  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: String(message.content) }],
  }));
  const providerTools = toGeminiTools(tools);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const candidate = await callProvider({ system, contents, tools: providerTools });
    const parts = candidate?.content?.parts || [];
    const calls = parts.filter((part) => part.functionCall);

    if (calls.length === 0) return textOf(parts);

    // Echo the model's turn back unchanged (this also keeps any thought signatures intact).
    contents.push(candidate.content);

    const responseParts = [];
    for (const { functionCall } of calls) {
      const output = await executeTool(functionCall.name, functionCall.args || {});
      responseParts.push({
        functionResponse: {
          ...(functionCall.id ? { id: functionCall.id } : {}),
          name: functionCall.name,
          response: asObject(output),
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  throw new Error("AI used too many tool rounds");
};

module.exports = { generateReply, isConfigured, DEFAULT_MODEL };
