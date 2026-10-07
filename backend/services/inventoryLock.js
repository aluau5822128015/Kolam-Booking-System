// Short-lived per-flat lock, so two staff confirmations for the same flat can never run the
// "check for conflicts, then confirm" step at the same time.
//
// Why a lock and not a transaction or unique index: two confirmations write two DIFFERENT
// booking documents, so a transaction sees no write conflict and both commit; and overlapping
// date ranges cannot be expressed as a unique index. All conflicts (room vs room, room vs
// flat, flat vs flat) happen inside one flat, so one lock per flat is enough.
//
// The lock is one document per flat taken with an atomic upsert (the unique _id makes the
// loser fail). It works on a standalone MongoDB and on Atlas, and across several server
// instances. It expires by itself, so a crashed server cannot block a flat forever, and a TTL
// index removes expired lock documents.
//
// Fencing: a request that stalls longer than the TTL loses the lock to someone else. The
// callback gets a handle so it can prove it still owns the lock right before it writes
// (isHeld) and right after (isOwner). MongoDB cannot make one document's write conditional on
// another document without a transaction, so the caller uses both checks (see
// bookingController.updateBooking): refuse to write when the lock is no longer held, and undo
// the write if ownership was lost in the instant between the check and the write.

const crypto = require("node:crypto");
const mongoose = require("mongoose");

const LOCK_TTL_MS = 10 * 1000;
const RETRY_EVERY_MS = 40;
const MAX_WAIT_MS = 3 * 1000;
const CLEANUP_AFTER_SECONDS = 60; // expired lock documents are deleted this long after expiry

const lockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // flat id, e.g. "1A"
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);
// Housekeeping only: deleting an expired lock document is equivalent to it being expired.
lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: CLEANUP_AFTER_SECONDS });

const InventoryLock = mongoose.models.InventoryLock || mongoose.model("InventoryLock", lockSchema);
// An index problem must never crash the server; the lock itself does not depend on the index.
InventoryLock.on("error", (error) => console.error("Inventory lock index:", error.message));

class LockBusyError extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tryAcquire = async (flatId, owner) => {
  const now = new Date();
  try {
    // Matches only a missing or expired lock; otherwise the upsert collides on _id.
    await InventoryLock.findOneAndUpdate(
      { _id: flatId, expiresAt: { $lte: now } },
      { $set: { owner, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    if (error && error.code === 11000) return false; // held by someone else
    throw error;
  }
};

// Runs fn(lock) while holding the lock for flatId. Waits briefly for a lock held by another
// request; throws LockBusyError if it is still held after MAX_WAIT_MS.
//   lock.isHeld()  : this request still owns the lock and it has not expired
//   lock.isOwner() : the lock document is still ours (nobody has taken it over)
const withFlatLock = async (flatId, fn) => {
  const owner = crypto.randomUUID();
  const started = Date.now();

  while (!(await tryAcquire(flatId, owner))) {
    if (Date.now() - started > MAX_WAIT_MS) throw new LockBusyError("Flat is being updated by another request.");
    await sleep(RETRY_EVERY_MS);
  }

  const lock = {
    isHeld: async () => Boolean(await InventoryLock.exists({ _id: flatId, owner, expiresAt: { $gt: new Date() } })),
    isOwner: async () => Boolean(await InventoryLock.exists({ _id: flatId, owner })),
  };

  try {
    return await fn(lock);
  } finally {
    // Only removes our own lock (not one taken over after expiry).
    await InventoryLock.deleteOne({ _id: flatId, owner }).catch(() => {});
  }
};

module.exports = { withFlatLock, LockBusyError, InventoryLock, LOCK_TTL_MS };
