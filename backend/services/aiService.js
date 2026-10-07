// AI provider abstraction. The rest of the backend only calls generateReply().
// Current provider: Anthropic Messages API, called with plain fetch (no SDK needed).
// To switch provider later, replace the body of callProvider() only.
//
// Environment variables (backend/.env, never in the frontend):
//   AI_API_KEY   required, provider API key
//   AI_MODEL     optional, defaults to DEFAULT_MODEL
//   AI_BASE_URL  optional, defaults to https://api.anthropic.com (useful for tests/proxies)

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const TIMEOUT_MS = 20000;
const MAX_TOOL_ROUNDS = 3;

const isConfigured = () => Boolean(process.env.AI_API_KEY);

const callProvider = async ({ system, messages, tools }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${process.env.AI_BASE_URL || DEFAULT_BASE_URL}/v1/messages`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.AI_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || DEFAULT_MODEL,
          max_tokens: 500,
          system,
          messages,
          ...(tools && tools.length ? { tools } : {}),
        }),
      }
    );

    if (!response.ok) {
      // Status only: never log the key or the response body.
      throw new Error(`AI provider returned status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

// Runs the conversation. If the model asks for a tool, executeTool() is called and the
// result is sent back, for at most MAX_TOOL_ROUNDS rounds. Returns the final text.
const generateReply = async ({ system, messages, tools, executeTool }) => {
  const conversation = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const result = await callProvider({ system, messages: conversation, tools });
    const content = Array.isArray(result.content) ? result.content : [];
    const toolCalls = content.filter((block) => block.type === "tool_use");

    if (result.stop_reason !== "tool_use" || toolCalls.length === 0) {
      return content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
    }

    const toolResults = [];
    for (const call of toolCalls) {
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: await executeTool(call.name, call.input || {}),
      });
    }

    conversation.push({ role: "assistant", content });
    conversation.push({ role: "user", content: toolResults });
  }

  throw new Error("AI used too many tool rounds");
};

module.exports = { generateReply, isConfigured };
