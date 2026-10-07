// Integration tests for the booking API.
// Starts the real server against an in-memory MongoDB (mongodb-memory-server).
// No real database (Atlas) is touched and nothing persists.
// Run: node --test tests/

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff");

const PORT = 5099;
const BASE = `http://localhost:${PORT}/api/bookings`;
const AUTH = `http://localhost:${PORT}/api/auth`;

let server;
let mongod;
let token;

const TEST_SECRET = "test-only-secret-not-used-anywhere-else-0123456789";
const TEST_USER = "test.staff";
const TEST_PASSWORD = "test-password-12345";

const api = async (method, url, body) => {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const guest = (over = {}) => ({
  guestName: "Test Guest",
  phone: "9999999999",
  checkIn: "2030-06-10",
  checkOut: "2030-06-12",
  guests: 2,
  roomType: "no-preference",
  ...over,
});

const create = async (over) => {
  const r = await api("POST", BASE, guest(over));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.booking;
};

const confirm = (id, flat, room) =>
  api("PATCH", `${BASE}/${id}`, {
    status: "CONFIRMED",
    assignedFlatId: flat,
    ...(room !== undefined ? { assignedRoomKey: room } : {}),
  });

before(async () => {
  mongod = await MongoMemoryServer.create();
  const testUri = mongod.getUri("kolam_test");
  server = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, MONGODB_URI: testUri, PORT: String(PORT), JWT_SECRET: TEST_SECRET, BOOKING_RATE_LIMIT_MAX: "1000" },
    stdio: "ignore",
  });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
    if (i === 39) throw new Error("test server did not start");
  }

  // Seed one staff account in the in-memory DB and log in through the real endpoint.
  const conn = await mongoose.createConnection(mongod.getUri("kolam_test")).asPromise();
  await conn.model("Staff", Staff.schema).create({
    username: TEST_USER,
    passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
  });
  await conn.close();
  const res = await api("POST", `${AUTH}/login`, { username: TEST_USER, password: TEST_PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  token = res.body.token;
});

after(async () => {
  if (server) server.kill();
  if (mongod) await mongod.stop();
});

test("1. POST /api/bookings still works with the legacy payload; defaults PENDING/ROOM", async () => {
  const r = await api("POST", BASE, guest({ roomType: "king" }));
  assert.equal(r.status, 201);
  assert.equal(r.body.booking.status, "PENDING");
  assert.equal(r.body.booking.bookingType, "ROOM");
  assert.equal(r.body.booking.assignedFlatId, null);
});

test("1b. public POST cannot self-confirm or self-assign", async () => {
  const r = await api(
    "POST",
    BASE,
    guest({ status: "CONFIRMED", assignedFlatId: "1A", assignedRoomKey: "1A-R1" })
  );
  assert.equal(r.status, 201);
  assert.equal(r.body.booking.status, "PENDING");
  assert.equal(r.body.booking.assignedFlatId, null);
  assert.equal(r.body.booking.assignedRoomKey, null);
});

test("2. GET /api/bookings lists bookings, filters work, bad filter 400", async () => {
  const all = await api("GET", BASE);
  assert.equal(all.status, 200);
  assert.ok(all.body.count >= 2);
  const pending = await api("GET", `${BASE}?status=pending`);
  assert.ok(pending.body.bookings.every((b) => b.status === "PENDING"));
  assert.equal((await api("GET", `${BASE}?status=bogus`)).status, 400);
});

test("3. PATCH rejects a booking without assignment; rejected is final", async () => {
  const b = await create();
  const r = await api("PATCH", `${BASE}/${b._id}`, { status: "REJECTED" });
  assert.equal(r.status, 200);
  assert.equal(r.body.booking.status, "REJECTED");
  const again = await confirm(b._id, "1A", "1A-R1");
  assert.equal(again.status, 409);
});

test("4. PATCH confirms with a valid room assignment", async () => {
  const b = await create();
  const r = await confirm(b._id, "1A", "1A-R1");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.booking.status, "CONFIRMED");
  assert.equal(r.body.booking.assignedRoomKey, "1A-R1");
});

test("5. overlapping dates on the same room -> 409", async () => {
  const b = await create({ checkIn: "2030-06-11", checkOut: "2030-06-13" });
  const r = await confirm(b._id, "1A", "1A-R1");
  assert.equal(r.status, 409);
  assert.ok(!JSON.stringify(r.body).includes("Mongo"));
  const still = await api("GET", `${BASE}?status=PENDING`);
  assert.ok(still.body.bookings.some((x) => x._id === b._id), "stays PENDING");
});

test("6. checkout/check-in boundary is allowed (both sides)", async () => {
  const later = await create({ checkIn: "2030-06-12", checkOut: "2030-06-14" });
  assert.equal((await confirm(later._id, "1A", "1A-R1")).status, 200);
  const earlier = await create({ checkIn: "2030-06-08", checkOut: "2030-06-10" });
  assert.equal((await confirm(earlier._id, "1A", "1A-R1")).status, 200);
});

test("7. different rooms in the same flat are allowed", async () => {
  const b = await create();
  assert.equal((await confirm(b._id, "1A", "1A-R2")).status, 200);
});

test("8. different flats are allowed", async () => {
  const b = await create();
  assert.equal((await confirm(b._id, "2A", "2A-R1")).status, 200);
});

test("9. FLAT booking blocks all 3 rooms; and FLAT vs FLAT conflicts", async () => {
  const flat = await create({ bookingType: "FLAT", checkIn: "2030-07-10", checkOut: "2030-07-12" });
  const c = await confirm(flat._id, "3A");
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.booking.assignedRoomKey, null);
  for (const room of ["3A-R1", "3A-R2", "3A-R3"]) {
    const r = await create({ checkIn: "2030-07-11", checkOut: "2030-07-13" });
    assert.equal((await confirm(r._id, "3A", room)).status, 409, room);
  }
  const f2 = await create({ bookingType: "FLAT", checkIn: "2030-07-09", checkOut: "2030-07-11" });
  assert.equal((await confirm(f2._id, "3A")).status, 409);
  const other = await create({ checkIn: "2030-07-11", checkOut: "2030-07-13" });
  assert.equal((await confirm(other._id, "3B", "3B-R1")).status, 200);
});

test("10. confirmed ROOM booking blocks an overlapping FLAT booking", async () => {
  const room = await create({ checkIn: "2030-08-10", checkOut: "2030-08-12" });
  assert.equal((await confirm(room._id, "1B", "1B-R2")).status, 200);
  const flat = await create({ bookingType: "FLAT", checkIn: "2030-08-11", checkOut: "2030-08-13" });
  assert.equal((await confirm(flat._id, "1B")).status, 409);
  const flatAfter = await create({ bookingType: "FLAT", checkIn: "2030-08-12", checkOut: "2030-08-14" });
  assert.equal((await confirm(flatAfter._id, "1B")).status, 200);
});

test("11. PENDING does not block a room", async () => {
  await create({ checkIn: "2030-09-10", checkOut: "2030-09-12" });
  const b = await create({ checkIn: "2030-09-10", checkOut: "2030-09-12" });
  assert.equal((await confirm(b._id, "2B", "2B-R1")).status, 200);
});

test("12. REJECTED does not block a room", async () => {
  const rej = await create({ checkIn: "2030-10-10", checkOut: "2030-10-12" });
  await api("PATCH", `${BASE}/${rej._id}`, { status: "REJECTED" });
  const b = await create({ checkIn: "2030-10-10", checkOut: "2030-10-12" });
  assert.equal((await confirm(b._id, "2B", "2B-R2")).status, 200);
});

test("13. invalid flat is rejected", async () => {
  const b = await create();
  assert.equal((await confirm(b._id, "9Z", "9Z-R1")).status, 400);
});

test("14. invalid room key is rejected", async () => {
  const b = await create();
  assert.equal((await confirm(b._id, "1A", "1A-R9")).status, 400);
});

test("15. room key from another flat is rejected", async () => {
  const b = await create();
  assert.equal((await confirm(b._id, "1A", "2A-R1")).status, 400);
});

test("16. invalid dates rejected on create", async () => {
  assert.equal((await api("POST", BASE, guest({ checkIn: "2030-06-12", checkOut: "2030-06-10" }))).status, 400);
  assert.equal((await api("POST", BASE, guest({ checkIn: "2030-06-12", checkOut: "2030-06-12" }))).status, 400);
  assert.equal((await api("POST", BASE, guest({ checkIn: "not-a-date" }))).status, 400);
});

test("17. CONFIRMED without assignment is rejected", async () => {
  const b = await create();
  assert.equal((await api("PATCH", `${BASE}/${b._id}`, { status: "CONFIRMED" })).status, 400);
  assert.equal(
    (await api("PATCH", `${BASE}/${b._id}`, { status: "CONFIRMED", assignedFlatId: "1A" })).status,
    400
  );
});

test("18. FLAT booking with a room assignment is rejected", async () => {
  const b = await create({ bookingType: "FLAT" });
  assert.equal((await confirm(b._id, "1A", "1A-R1")).status, 400);
});

test("19. room type mismatch is rejected; matching type allowed", async () => {
  const king = await create({ roomType: "king", checkIn: "2031-01-10", checkOut: "2031-01-12" });
  assert.equal((await confirm(king._id, "1A", "1A-R2")).status, 400);
  assert.equal((await confirm(king._id, "1A", "1A-R1")).status, 200);
});

test("20. safety: bad id, unknown id, forbidden fields, bad JSON, bad status", async () => {
  assert.equal((await api("PATCH", `${BASE}/abc`, { status: "REJECTED" })).status, 400);
  assert.equal((await api("PATCH", `${BASE}/aaaaaaaaaaaaaaaaaaaaaaaa`, { status: "REJECTED" })).status, 404);
  const b = await create();
  assert.equal((await api("PATCH", `${BASE}/${b._id}`, { guestName: "Hacker" })).status, 400);
  assert.equal((await api("PATCH", `${BASE}/${b._id}`, { status: "PENDING" })).status, 400);
  assert.equal(
    (await api("PATCH", `${BASE}/${b._id}`, { status: "REJECTED", assignedFlatId: "1A" })).status,
    400
  );
  const raw = await fetch(`${BASE}/${b._id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: "{bad",
  });
  const text = await raw.text();
  assert.equal(raw.status, 400);
  assert.ok(!text.includes(" at "), "no stack trace");
});

test("21. guests outside 1-3 and invalid enums are rejected", async () => {
  assert.equal((await api("POST", BASE, guest({ guests: 4 }))).status, 400);
  assert.equal((await api("POST", BASE, guest({ roomType: "suite" }))).status, 400);
  assert.equal((await api("POST", BASE, guest({ bookingType: "HOUSE" }))).status, 400);
  assert.equal((await api("POST", BASE, guest({ guestName: "" }))).status, 400);
});

// ---------- Staff authentication ----------

const withToken = async (t, fn) => {
  const saved = token;
  token = t;
  try {
    return await fn();
  } finally {
    token = saved;
  }
};

test("A1. GET and PATCH bookings require a token (401 without, with junk, with wrong-secret token)", async () => {
  const b = await create();
  await withToken(null, async () => {
    assert.equal((await api("GET", BASE)).status, 401);
    assert.equal((await api("PATCH", `${BASE}/${b._id}`, { status: "REJECTED" })).status, 401);
  });
  await withToken("not.a.jwt", async () => {
    assert.equal((await api("GET", BASE)).status, 401);
  });
  const forged = require("jsonwebtoken").sign({ sub: "aaaaaaaaaaaaaaaaaaaaaaaa" }, "wrong-secret");
  await withToken(forged, async () => {
    assert.equal((await api("GET", BASE)).status, 401);
  });
  // booking untouched
  const list = await api("GET", `${BASE}?status=PENDING`);
  assert.ok(list.body.bookings.some((x) => x._id === b._id));
});

test("A2. public POST /api/bookings stays open without a token", async () => {
  await withToken(null, async () => {
    const r = await api("POST", BASE, guest());
    assert.equal(r.status, 201);
  });
});

test("A3. login: wrong password, unknown user, missing fields", async () => {
  const bad = await api("POST", `${AUTH}/login`, { username: TEST_USER, password: "wrong-password-1" });
  const unknown = await api("POST", `${AUTH}/login`, { username: "nobody", password: "whatever-12345" });
  assert.equal(bad.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(bad.body.message, unknown.body.message, "no user enumeration");
  assert.ok(!bad.body.token);
  assert.equal((await api("POST", `${AUTH}/login`, {})).status, 400);
  assert.equal((await api("POST", `${AUTH}/login`, { username: { $ne: "" }, password: { $ne: "" } })).status, 400);
});

test("A4. /api/auth/me works with a valid token and not without", async () => {
  const ok = await api("GET", `${AUTH}/me`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.username, TEST_USER);
  await withToken(null, async () => {
    assert.equal((await api("GET", `${AUTH}/me`)).status, 401);
  });
});

test("A5. disabled staff lose access immediately", async () => {
  const conn = await mongoose.createConnection(mongod.getUri("kolam_test")).asPromise();
  const Model = conn.model("Staff", Staff.schema);
  await Model.updateOne({ username: TEST_USER }, { active: false });
  assert.equal((await api("GET", BASE)).status, 401);
  assert.equal((await api("POST", `${AUTH}/login`, { username: TEST_USER, password: TEST_PASSWORD })).status, 401);
  await Model.updateOne({ username: TEST_USER }, { active: true });
  await conn.close();
  assert.equal((await api("GET", BASE)).status, 200);
});

test("A6. password hash is never returned", async () => {
  const res = await fetch(`${AUTH}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: TEST_USER, password: TEST_PASSWORD }),
  });
  const text = await res.text();
  assert.ok(!text.includes("passwordHash") && !text.includes("$2"));
});

test("A7. repeated failed logins get rate limited (429), keep last", async () => {
  let last;
  for (let i = 0; i < 12; i++) {
    last = await api("POST", `${AUTH}/login`, { username: TEST_USER, password: "wrong-password-1" });
  }
  assert.equal(last.status, 429);
});
