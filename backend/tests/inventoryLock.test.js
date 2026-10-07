// Lock fencing tests: a request that loses the per-flat lock (TTL expired, someone else took it)
// must not complete a confirmation. Runs the real controller and models against an in-memory
// MongoDB; nothing else is touched.
// Run: node --test tests/inventoryLock.test.js

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const conflicts = require("../services/bookingConflictService");
const realFindConflict = conflicts.findConflict;
let beforeCheckHook = null; // runs once after a conflict check, before the controller continues
conflicts.findConflict = async (args) => {
  const found = await realFindConflict(args);
  if (beforeCheckHook) {
    const hook = beforeCheckHook;
    beforeCheckHook = null;
    await hook(args);
  }
  return found;
};

const Booking = require("../models/Booking");
const { withFlatLock, InventoryLock } = require("../services/inventoryLock");
const { updateBooking } = require("../controllers/bookingController");

const realUpdateOne = Booking.updateOne.bind(Booking);
let beforeWriteHook = null; // runs once right before a CONFIRMED write
Booking.updateOne = async (filter, update, ...rest) => {
  if (beforeWriteHook && update?.$set?.status === "CONFIRMED") {
    const hook = beforeWriteHook;
    beforeWriteHook = null;
    await hook(filter);
  }
  return realUpdateOne(filter, update, ...rest);
};

let mongod;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("kolam_lock_test"));
});

after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const newBooking = (over = {}) =>
  Booking.create({ guestName: "Lock Test", phone: "9999999999", guests: 2, checkIn: "2033-03-10", checkOut: "2033-03-12", ...over });

// Calls the real PATCH controller with a minimal req/res.
const patch = async (id, body) => {
  let out;
  const res = {
    code: 200,
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      out = { status: this.code, body: payload };
      return this;
    },
  };
  await updateBooking({ params: { id: String(id) }, body }, res);
  return out;
};
const confirm = (id, flat, room) => patch(id, { status: "CONFIRMED", assignedFlatId: flat, assignedRoomKey: room });
const expireLock = (flat) => InventoryLock.updateOne({ _id: flat }, { $set: { expiresAt: new Date(Date.now() - 1) } });
const confirmedFor = (room, checkIn) => Booking.find({ status: "CONFIRMED", assignedRoomKey: room, checkIn: new Date(checkIn) });

test("J1. the lock expires after the conflict check and another request takes the room: the stale request is refused (409)", async () => {
  const stale = await newBooking({ checkIn: "2033-03-10", checkOut: "2033-03-12" });
  const rival = await newBooking({ checkIn: "2033-03-10", checkOut: "2033-03-12" });

  let rivalResult;
  beforeCheckHook = async () => {
    // The stale request has passed its conflict check and now "stalls": its lock expires and
    // a second request takes the flat, confirms the same room, and finishes.
    await expireLock("1A");
    rivalResult = await confirm(rival._id, "1A", "1A-R1");
  };
  const staleResult = await confirm(stale._id, "1A", "1A-R1");

  assert.equal(rivalResult.status, 200, JSON.stringify(rivalResult.body));
  assert.equal(staleResult.status, 409, JSON.stringify(staleResult.body));
  const confirmed = await confirmedFor("1A-R1", "2033-03-10");
  assert.equal(confirmed.length, 1, "only one confirmed booking for the room");
  assert.equal(String(confirmed[0]._id), String(rival._id));
  assert.equal((await Booking.findById(stale._id)).status, "PENDING", "the stale request wrote nothing");
});

test("J2. ownership is lost in the instant between the fence check and the write: the stale confirmation is undone (409)", async () => {
  const stale = await newBooking({ checkIn: "2033-04-10", checkOut: "2033-04-12" });
  const rival = await newBooking({ checkIn: "2033-04-10", checkOut: "2033-04-12" });

  let rivalResult;
  beforeWriteHook = async (filter) => {
    assert.equal(String(filter._id), String(stale._id), "the stalled write is the stale request's");
    await expireLock("1A");
    rivalResult = await confirm(rival._id, "1A", "1A-R2");
  };
  const staleResult = await confirm(stale._id, "1A", "1A-R2");

  assert.equal(rivalResult.status, 200, JSON.stringify(rivalResult.body));
  assert.equal(staleResult.status, 409, JSON.stringify(staleResult.body));
  const confirmed = await confirmedFor("1A-R2", "2033-04-10");
  assert.equal(confirmed.length, 1, "never two confirmed bookings for the room");
  assert.equal(String(confirmed[0]._id), String(rival._id));
  const undone = await Booking.findById(stale._id);
  assert.equal(undone.status, "PENDING", "the stale confirmation was reverted");
  assert.equal(undone.assignedFlatId, null);
  assert.equal(undone.assignedRoomKey, null);
});

test("J3. a stale request whose lock merely expired (nobody took it) is refused before writing", async () => {
  const stale = await newBooking({ checkIn: "2033-05-10", checkOut: "2033-05-12" });
  beforeCheckHook = async () => expireLock("1B");
  const result = await confirm(stale._id, "1B", "1B-R1");
  assert.equal(result.status, 409, JSON.stringify(result.body));
  assert.equal((await Booking.findById(stale._id)).status, "PENDING");
  // The booking can simply be confirmed again.
  assert.equal((await confirm(stale._id, "1B", "1B-R1")).status, 200);
});

test("J4. lock handle: only the current owner passes isHeld/isOwner; a stale owner's release keeps the newer lock", async () => {
  let handleA;
  let handleB;
  let bStillHeldAfterAFinished;
  const a = withFlatLock("2A", async (lock) => {
    handleA = lock;
    assert.equal(await lock.isHeld(), true);
    await expireLock("2A");
    assert.equal(await lock.isHeld(), false, "expired");
    await sleep(500); // B takes over meanwhile
    assert.equal(await lock.isOwner(), false, "taken over by B");
    assert.equal(await lock.isHeld(), false);
  });
  await sleep(100);
  const b = withFlatLock("2A", async (lock) => {
    handleB = lock;
    assert.equal(await lock.isHeld(), true);
    await sleep(700); // A finishes (and releases) while B still holds the lock
    bStillHeldAfterAFinished = (await lock.isHeld()) && (await lock.isOwner());
  });
  await Promise.all([a, b]);
  assert.ok(handleA && handleB);
  assert.equal(bStillHeldAfterAFinished, true, "A's release did not delete B's lock");
  assert.equal(await InventoryLock.countDocuments({ _id: "2A" }), 0, "released when done");
});

test("J5. different flats are independent and each flat's lock is released after use", async () => {
  const started = Date.now();
  let both = 0;
  let overlapped = false;
  await Promise.all(
    ["2B", "3A"].map((flat) =>
      withFlatLock(flat, async () => {
        both++;
        if (both === 2) overlapped = true;
        await sleep(150);
        both--;
      })
    )
  );
  assert.equal(overlapped, true);
  assert.ok(Date.now() - started < 400);
  assert.equal(await InventoryLock.countDocuments({ _id: { $in: ["2B", "3A"] } }), 0);
});

test("J6. expired lock documents are cleaned up by a TTL index (and the lock still works without it)", async () => {
  await InventoryLock.init();
  const indexes = await InventoryLock.collection.indexes();
  const ttl = indexes.find((index) => index.key && index.key.expiresAt === 1);
  assert.ok(ttl && ttl.expireAfterSeconds === 60, JSON.stringify(indexes));
});

test("J7. a confirmation that keeps its lock still works normally (no false refusals)", async () => {
  const booking = await newBooking({ checkIn: "2033-06-10", checkOut: "2033-06-12" });
  const result = await confirm(booking._id, "3B", "3B-R3");
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.booking.status, "CONFIRMED");
});
