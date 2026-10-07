// Production-readiness tests: CORS, trust proxy, public booking validation and rate limit.
// Uses an in-memory MongoDB; each scenario starts its own server with different env settings.
// Run: npm test   (or: node --test tests/production.test.js)

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const { MongoMemoryServer } = require("mongodb-memory-server");

const PORTS = { main: 5094, defaultCors: 5093, wildcard: 5092, limited: 5091 };
const VERCEL = "https://kolam-test.vercel.app";

let mongod;
const servers = [];

const start = (port, extraEnv = {}, removeEnv = []) => {
  const env = {
    ...process.env,
    MONGODB_URI: mongod.getUri("kolam_prod_test"),
    PORT: String(port),
    JWT_SECRET: "test-only-secret-not-used-anywhere-else-0123456789",
    ...extraEnv,
  };
  removeEnv.forEach((name) => delete env[name]);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env,
    stdio: "ignore",
  });
  servers.push(child);
};

const waitFor = async (port) => {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server on ${port} did not start`);
};

const url = (port, p) => `http://localhost:${port}${p}`;

const preflight = async (port, origin) => {
  const res = await fetch(url(port, "/api/bookings"), {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
  });
  return res.headers.get("access-control-allow-origin");
};

const post = async (port, body, headers = {}) => {
  const res = await fetch(url(port, "/api/bookings"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const todayChennai = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const shift = (dayKey, n) => new Date(Date.parse(`${dayKey}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const guest = (over = {}) => ({
  guestName: "Test Guest",
  phone: "9999999999",
  checkIn: shift(todayChennai(), 10),
  checkOut: shift(todayChennai(), 12),
  guests: 2,
  roomType: "no-preference",
  ...over,
});

before(async () => {
  mongod = await MongoMemoryServer.create();
  start(PORTS.main, {
    CORS_ORIGIN: ` ${VERCEL}/ , http://localhost:5173 `,
    BOOKING_RATE_LIMIT_MAX: "50",
    CHAT_RATE_LIMIT_MAX: "2",
  });
  start(PORTS.defaultCors, { BOOKING_RATE_LIMIT_MAX: "50" }, ["CORS_ORIGIN"]);
  start(PORTS.wildcard, { CORS_ORIGIN: "*" });
  start(PORTS.limited, { BOOKING_RATE_LIMIT_MAX: "3" });
  for (const port of Object.values(PORTS)) await waitFor(port);
});

after(async () => {
  servers.forEach((child) => child.kill());
  if (mongod) await mongod.stop();
});

// ---------------- CORS ----------------

test("CORS: configured origins are allowed (spaces/trailing slash ignored); others are not", async () => {
  assert.equal(await preflight(PORTS.main, VERCEL), VERCEL);
  assert.equal(await preflight(PORTS.main, "http://localhost:5173"), "http://localhost:5173");
  assert.equal(await preflight(PORTS.main, "https://evil.example"), null);
  assert.equal(await preflight(PORTS.main, "http://localhost:5173.evil.example"), null);
});

test("CORS: with CORS_ORIGIN unset, only the local dev frontend is allowed", async () => {
  assert.equal(await preflight(PORTS.defaultCors, "http://localhost:5173"), "http://localhost:5173");
  assert.equal(await preflight(PORTS.defaultCors, VERCEL), null);
});

test("CORS: a wildcard setting is never honoured", async () => {
  assert.equal(await preflight(PORTS.wildcard, VERCEL), null);
  assert.equal(await preflight(PORTS.wildcard, "http://localhost:5173"), null);
});

// ---------------- trust proxy ----------------

test("trust proxy: rate limits are per real client IP (X-Forwarded-For), not per proxy", async () => {
  const chat = async (ip) => {
    const res = await fetch(url(PORTS.main, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], quickQuestion: "contact" }),
    });
    return res.status;
  };
  assert.deepEqual([await chat("203.0.113.1"), await chat("203.0.113.1"), await chat("203.0.113.1")], [200, 200, 429]);
  assert.equal(await chat("203.0.113.2"), 200, "a different client is not blocked by the first one");
});

// ---------------- public booking validation ----------------

test("booking validation: guest name length", async () => {
  assert.equal((await post(PORTS.main, guest({ guestName: "A" }))).status, 400);
  assert.equal((await post(PORTS.main, guest({ guestName: "A".repeat(101) }))).status, 400);
  assert.equal((await post(PORTS.main, guest({ guestName: "A".repeat(100) }))).status, 201);
});

test("booking validation: phone format", async () => {
  assert.equal((await post(PORTS.main, guest({ phone: "abc" }))).status, 400);
  assert.equal((await post(PORTS.main, guest({ phone: "12345" }))).status, 400);
  assert.equal((await post(PORTS.main, guest({ phone: "1".repeat(21) }))).status, 400);
  assert.equal((await post(PORTS.main, guest({ phone: "+91 87544 15469" }))).status, 201);
  assert.equal((await post(PORTS.main, guest({ phone: "9999999999" }))).status, 201);
});

test("booking validation: special request length", async () => {
  assert.equal((await post(PORTS.main, guest({ specialRequest: "x".repeat(1001) }))).status, 400);
  assert.equal((await post(PORTS.main, guest({ specialRequest: "x".repeat(1000) }))).status, 201);
});

test("booking validation: dates (no past check-in, check-out after check-in)", async () => {
  const today = todayChennai();
  const past = await post(PORTS.main, guest({ checkIn: shift(today, -1), checkOut: shift(today, 1) }));
  assert.equal(past.status, 400);
  assert.ok(past.body.errors.some((e) => e.includes("past")));
  assert.equal((await post(PORTS.main, guest({ checkIn: today, checkOut: shift(today, 1) }))).status, 201);
  assert.equal((await post(PORTS.main, guest({ checkIn: shift(today, 5), checkOut: shift(today, 4) }))).status, 400);
  assert.equal((await post(PORTS.main, guest({ checkIn: shift(today, 5), checkOut: shift(today, 5) }))).status, 400);
});

test("booking validation: guests still cannot set status or assignment", async () => {
  const r = await post(PORTS.main, guest({ status: "CONFIRMED", assignedFlatId: "1A", assignedRoomKey: "1A-R1" }));
  assert.equal(r.status, 201);
  assert.equal(r.body.booking.status, "PENDING");
  assert.equal(r.body.booking.assignedFlatId, null);
  assert.equal(r.body.booking.assignedRoomKey, null);
});

// ---------------- public booking rate limit ----------------

test("booking rate limit: normal use is fine, bursts get 429; staff routes are unaffected", async () => {
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await post(PORTS.limited, guest())).status);
  assert.deepEqual(statuses, [201, 201, 201, 429, 429]);
  const limited = await post(PORTS.limited, guest());
  assert.ok(limited.body.message.includes("front desk"));
  const staff = await fetch(url(PORTS.limited, "/api/bookings"));
  assert.equal(staff.status, 401, "GET is still guarded by login, not by the booking limiter");
});

test("booking rate limit: separate clients behind the proxy have separate buckets", async () => {
  const ok = async (ip) => (await post(PORTS.main, guest(), { "X-Forwarded-For": ip })).status;
  assert.equal(await ok("198.51.100.7"), 201);
  assert.equal(await ok("198.51.100.8"), 201);
});
