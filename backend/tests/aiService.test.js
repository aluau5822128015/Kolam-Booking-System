// Unit tests for the AI provider layer (Gemini). A local server stands in for the Gemini API,
// so no real key, network call or paid usage is involved. No database needed.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { generateReply, isConfigured, DEFAULT_MODEL } = require("../services/aiService");

const PORT = 5089;
const KEY = "test-key-NOT-A-REAL-KEY-123";

let server;
let requests = [];
let responder;

const ok = (parts, extra = {}) => ({ status: 200, body: { candidates: [{ finishReason: "STOP", content: { role: "model", parts } }], ...extra } });

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const record = { url: req.url, method: req.method, headers: req.headers, body: JSON.parse(raw) };
      requests.push(record);
      const { status, body, raw: rawOut } = responder(record, requests.length);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(rawOut !== undefined ? rawOut : JSON.stringify(body));
    });
  });
  await new Promise((resolve) => server.listen(PORT, resolve));
});

after(() => server.close());

beforeEach(() => {
  requests = [];
  responder = () => ok([{ text: "Hello." }]);
  process.env.GEMINI_API_KEY = KEY;
  process.env.GEMINI_BASE_URL = `http://localhost:${PORT}`;
  delete process.env.GEMINI_MODEL;
  delete process.env.AI_API_KEY; // the old Anthropic variable plays no role any more
});

const TOOL = {
  name: "check_availability",
  description: "Check availability",
  parameters: {
    type: "object",
    properties: { checkIn: { type: "string", description: "date" }, roomType: { type: "string" } },
    required: ["checkIn"],
  },
};

test("1. the provider is configured from GEMINI_API_KEY only", () => {
  assert.equal(isConfigured(), true);
  process.env.GEMINI_API_KEY = "";
  assert.equal(isConfigured(), false);
  delete process.env.GEMINI_API_KEY;
  assert.equal(isConfigured(), false);
  process.env.AI_API_KEY = "old-anthropic-style-key";
  assert.equal(isConfigured(), false, "an Anthropic key is neither needed nor used");
});

test("2. default model is a current free-tier Gemini model and can be overridden", async () => {
  assert.equal(DEFAULT_MODEL, "gemini-flash-lite-latest");
  await generateReply({ system: "s", messages: [{ role: "user", content: "hi" }] });
  assert.equal(requests[0].url, "/v1beta/models/gemini-flash-lite-latest:generateContent");
  process.env.GEMINI_MODEL = "models/some-other-model";
  await generateReply({ system: "s", messages: [{ role: "user", content: "hi" }] });
  assert.equal(requests[1].url, "/v1beta/models/some-other-model:generateContent");
});

test("3. the request follows Gemini's generateContent format and the key stays in a header", async () => {
  const reply = await generateReply({
    system: "You are the Front Office Executive.",
    messages: [{ role: "user", content: "parking iruka?" }],
    tools: [TOOL],
  });
  assert.equal(reply, "Hello.");
  const [req] = requests;
  assert.equal(req.method, "POST");
  assert.equal(req.headers["x-goog-api-key"], KEY);
  assert.ok(!req.url.includes(KEY) && !JSON.stringify(req.body).includes(KEY), "key is not in the URL or body");
  assert.deepEqual(req.body.systemInstruction, { parts: [{ text: "You are the Front Office Executive." }] });
  assert.deepEqual(req.body.contents, [{ role: "user", parts: [{ text: "parking iruka?" }] }]);
  assert.ok(req.body.generationConfig.maxOutputTokens >= 1000);
  assert.deepEqual(req.body.tools[0].functionDeclarations[0], {
    name: "check_availability",
    description: "Check availability",
    parameters: {
      type: "OBJECT",
      properties: { checkIn: { type: "STRING", description: "date" }, roomType: { type: "STRING" } },
      required: ["checkIn"],
    },
  });
});

test("4. no tools are sent when none are given", async () => {
  await generateReply({ system: "s", messages: [{ role: "user", content: "hi" }] });
  assert.equal(requests[0].body.tools, undefined);
});

test("5. text from several parts is joined, and internal thought parts are not shown to guests", async () => {
  responder = () => ok([{ text: "Hidden reasoning", thought: true }, { text: "Hello " }, { text: "there.  " }]);
  assert.equal(await generateReply({ system: "s", messages: [{ role: "user", content: "hi" }] }), "Hello there.");
});

test("6. function calling: the tool runs locally and its result goes back in Gemini's format", async () => {
  const modelTurn = {
    role: "model",
    parts: [{ functionCall: { id: "call-1", name: "check_availability", args: { checkIn: "2031-10-10" } }, thoughtSignature: "sig-abc" }],
  };
  responder = (req, n) =>
    n === 1
      ? { status: 200, body: { candidates: [{ finishReason: "STOP", content: modelTurn }] } }
      : ok([{ text: "Queen rooms are free." }]);

  const calls = [];
  const reply = await generateReply({
    system: "s",
    messages: [{ role: "user", content: "Is a queen room free?" }],
    tools: [TOOL],
    executeTool: async (name, args) => {
      calls.push([name, args]);
      return JSON.stringify({ freeRooms: ["1B-R2"] });
    },
  });

  assert.equal(reply, "Queen rooms are free.");
  assert.deepEqual(calls, [["check_availability", { checkIn: "2031-10-10" }]]);
  assert.equal(requests.length, 2);
  const second = requests[1].body.contents;
  assert.equal(second.length, 3);
  assert.deepEqual(second[1], modelTurn, "the model's own turn is echoed back unchanged (keeps thought signatures)");
  assert.deepEqual(second[2], {
    role: "user",
    parts: [{ functionResponse: { id: "call-1", name: "check_availability", response: { freeRooms: ["1B-R2"] } } }],
  });
});

test("7. tool output that is not JSON is wrapped as an object", async () => {
  responder = (req, n) =>
    n === 1 ? ok([{ functionCall: { name: "check_availability", args: {} } }]) : ok([{ text: "done" }]);
  await generateReply({ system: "s", messages: [{ role: "user", content: "x" }], tools: [TOOL], executeTool: async () => "plain text" });
  assert.deepEqual(requests[1].body.contents[2].parts[0].functionResponse.response, { result: "plain text" });
});

test("8. a model that keeps calling tools is stopped", async () => {
  responder = () => ok([{ functionCall: { name: "check_availability", args: {} } }]);
  await assert.rejects(
    generateReply({ system: "s", messages: [{ role: "user", content: "x" }], tools: [TOOL], executeTool: async () => "{}" }),
    /too many tool rounds/
  );
  assert.equal(requests.length, 3);
});

test("9. provider errors (rate limit, server error, bad body) throw without leaking the key or the response body", async () => {
  for (const status of [429, 500, 503, 400, 403]) {
    responder = () => ({ status, body: { error: { message: `secret provider detail ${KEY}` } } });
    await assert.rejects(
      generateReply({ system: "s", messages: [{ role: "user", content: "x" }] }),
      (error) => {
        assert.equal(error.message, `AI provider returned status ${status}`);
        assert.ok(!error.message.includes(KEY) && !error.message.includes("secret provider detail"));
        return true;
      }
    );
  }
  responder = () => ({ status: 200, raw: "not json" });
  await assert.rejects(generateReply({ system: "s", messages: [{ role: "user", content: "x" }] }));
});

test("10. a blocked or empty response returns an empty string (the caller then uses its fallback)", async () => {
  responder = () => ({ status: 200, body: { promptFeedback: { blockReason: "SAFETY" } } });
  assert.equal(await generateReply({ system: "s", messages: [{ role: "user", content: "x" }] }), "");
  responder = () => ({ status: 200, body: { candidates: [] } });
  assert.equal(await generateReply({ system: "s", messages: [{ role: "user", content: "x" }] }), "");
  responder = () => ok([]);
  assert.equal(await generateReply({ system: "s", messages: [{ role: "user", content: "x" }] }), "");
  responder = () => ({ status: 200, body: { candidates: [{ finishReason: "MAX_TOKENS", content: { role: "model" } }] } });
  assert.equal(await generateReply({ system: "s", messages: [{ role: "user", content: "x" }] }), "");
});

test("10b. a Gemini call that is too slow is cut off (the caller then uses its fallback)", async () => {
  process.env.GEMINI_TIMEOUT_MS = "150";
  const slow = http.createServer((req, res) => setTimeout(() => res.end(JSON.stringify({ candidates: [] })), 600));
  await new Promise((resolve) => slow.listen(PORT + 1, resolve));
  process.env.GEMINI_BASE_URL = `http://localhost:${PORT + 1}`;
  const started = Date.now();
  await assert.rejects(generateReply({ system: "s", messages: [{ role: "user", content: "x" }] }), /abort/i);
  assert.ok(Date.now() - started < 550, "gave up at the configured timeout, not when the server answered");
  slow.closeAllConnections?.();
  slow.close();
  delete process.env.GEMINI_TIMEOUT_MS;
});

test("11. the Anthropic provider is gone from the backend", () => {
  const root = path.join(__dirname, "..");
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "tests", ".cache"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|json|md|example)$/.test(entry.name) && entry.name !== "package-lock.json" && entry.name !== ".env") files.push(full);
    }
  };
  walk(root);
  files.push(path.join(root, ".env.example"));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.ok(!/api\.anthropic\.com|anthropic-version|x-api-key|AI_API_KEY|@anthropic-ai/i.test(text), `Anthropic reference left in ${path.relative(root, file)}`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((name) => /anthropic|gemini|google/i.test(name)), "no AI SDK dependency");
});

test("12. the Gemini key never reaches the frontend", () => {
  const frontend = path.join(__dirname, "..", "..", "frontend");
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "dist"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/\.(js|jsx|css|html|json|example)$/.test(entry.name) && entry.name !== "package-lock.json") {
        const text = fs.readFileSync(full, "utf8");
        assert.ok(!/GEMINI|AIza[0-9A-Za-z_-]{20,}|x-goog-api-key|generativelanguage/i.test(text), `AI provider reference in frontend file ${path.relative(frontend, full)}`);
        assert.ok(!/VITE_[A-Z_]*(KEY|SECRET|TOKEN)/.test(text), `secret-looking VITE variable in ${path.relative(frontend, full)}`);
      }
    }
  };
  scan(frontend);
  const dist = path.join(frontend, "dist");
  if (fs.existsSync(dist)) {
    const assets = path.join(dist, "assets");
    for (const name of fs.existsSync(assets) ? fs.readdirSync(assets) : []) {
      if (!name.endsWith(".js")) continue;
      const text = fs.readFileSync(path.join(assets, name), "utf8");
      assert.ok(!/GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}|x-goog-api-key/.test(text), `key reference in built bundle ${name}`);
    }
  }
});
