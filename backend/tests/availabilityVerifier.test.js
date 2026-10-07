// Unit tests for the availability verifier: what the AI says about availability is checked
// against the database result. Pure function, no database and no AI needed.
// Run: node --test tests/availabilityVerifier.test.js

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { verifyAvailabilityReply } = require("../services/availabilityVerifier");

const snapshot = (king, queen, twin, flat, types = ["king", "queen", "twin"]) => {
  const all = { king, queen, twin };
  return {
    checkIn: "2026-10-16",
    checkOut: "2026-10-18",
    nights: 2,
    span: "16 Oct 2026 to 18 Oct 2026 (2 nights)",
    total: 6,
    types,
    allByType: all,
    freeByType: Object.fromEntries(types.map((t) => [t, all[t]])),
    flatFree: flat,
  };
};

const CTX = { occupancy: "double", situations: [] };
const REAL = snapshot(4, 4, 5, 4); // Master 4, Queen 4, Twin 5, Entire flat 4
const NOTHING = snapshot(0, 0, 0, 0);

const verify = (reply, snapshots = [REAL], ctx = CTX) => verifyAvailabilityReply({ reply, snapshots, ctx });
const kind = (reply, out) => (out === reply ? "same" : out.startsWith(reply) ? "append" : "replace");
const check = (reply, expected, snapshots, ctx) => {
  const out = verify(reply, snapshots, ctx);
  assert.equal(kind(reply, out), expected, `${expected} expected for: ${reply}\n=> ${out}`);
  return out;
};
const DETERMINISTIC = /Here's what is free for|nothing free for/;

test("A. nothing free anywhere + the AI says something is available -> replaced with the deterministic answer", () => {
  for (const reply of [
    "Great news, we have rooms available!",
    "The Master Room is available for ₹4,200 for double occupancy.",
    "Yes, we do have rooms for those dates.",
    "Queen and Twin rooms are available, and so is the entire flat.",
    "We have 2 Queen rooms free.",
  ]) {
    const out = check(reply, "replace", [NOTHING]);
    assert.match(out, /nothing free for/, out);
    assert.ok(!/great news|we do have/i.test(out));
  }
});

test("A2. nothing free + an honest reply is kept; a vague reply gets the clear answer", () => {
  check("I am sorry, nothing is free for those dates. Please call the front desk.", "same", [NOTHING]);
  check("Sorry! Master Room: 0 rooms available. Queen Room: 0 rooms available. Twin Room: 0 rooms available. Entire Flat: 0 flats available.", "same", [NOTHING]);
  check("Please contact the front desk for more details.", "replace", [NOTHING]);
});

test("B. wrong Master count is replaced (digits, words, bedrooms, 'of our', fractions)", () => {
  for (const reply of [
    "Master Room: 6 rooms available. Queen Room: 4 rooms available. Twin Room: 5 rooms available. Entire Flat: 4 flats available.",
    "We have 6 Master bedrooms, 4 Queen rooms, 5 Twin rooms and 4 entire flats free.",
    "6 of our Master rooms are free, 4 Queen rooms, 5 Twin rooms and 4 entire flats.",
    "Seven Master rooms are free, 4 Queen rooms, 5 Twin rooms and 4 entire flats.",
    "Master Room: 3 of 6 free, Queen Room: 4 of 6 free, Twin Room: 5 of 6 free, Entire Flat: 4 of 6 free",
  ]) {
    assert.match(check(reply, "replace"), DETERMINISTIC);
  }
});

test("C. wrong Queen count is replaced", () => {
  assert.match(check("4 Master rooms, 3 Queen rooms, 5 Twin rooms and 4 entire flats are free.", "replace"), DETERMINISTIC);
  assert.match(check("Master Room: 4 rooms available. Queen Room: five rooms available. Twin Room: 5 rooms available. Entire Flat: 4 flats available.", "replace"), DETERMINISTIC);
});

test("D. wrong Twin count is replaced", () => {
  assert.match(check("4 Master rooms, 4 Queen rooms, 2 Twin rooms and 4 entire flats are free.", "replace"), DETERMINISTIC);
  assert.match(check("Master and Queen rooms: 4 each. Twin Room: 6 rooms available. Entire Flat: 4 flats available.", "replace"), DETERMINISTIC);
});

test("E. wrong Entire Flat count is replaced ('flats', 'entire apartments', whole flat wording)", () => {
  for (const reply of [
    "4 Master rooms, 4 Queen rooms, 5 Twin rooms and 3 entire flats are free.",
    "4 Master rooms, 4 Queen rooms, 5 Twin rooms and 6 entire apartments are free.",
    "Master Room: 4 rooms available. Queen Room: 4 rooms available. Twin Room: 5 rooms available. Entire Flat: 6 flats available.",
    "4 Master rooms, 4 Queen rooms, 5 Twin rooms and twelve whole 3BHK flats are available.",
  ]) {
    assert.match(check(reply, "replace"), DETERMINISTIC);
  }
});

test("F. qualitative 'available' for something with count 0 is replaced, wherever in the reply", () => {
  assert.match(check("Master rooms are available.", "replace", [snapshot(0, 4, 5, 4)]), DETERMINISTIC);
  assert.match(check("Master rooms are available, and Twin rooms are available too.", "replace", [snapshot(4, 4, 0, 4)]), DETERMINISTIC);
  assert.match(
    check("Master Room: 4 rooms available. Queen Room: 4 rooms available. Twin Room: 5 rooms available. The entire flat is also available!", "replace", [snapshot(4, 4, 5, 0)]),
    DETERMINISTIC
  );
  // Honest statements about a sold-out type are fine; the missing counts are added.
  const out = check("Master rooms are fully booked, but Queen Room: 4 rooms available, Twin Room: 5 rooms available, Entire Flat: 4 flats available.", "append", [snapshot(0, 4, 5, 4)]);
  assert.match(out, /Master Room: 0 rooms available/);
});

test("F2. a question about one room type still verifies every type and the flat", () => {
  const queenOnly = [snapshot(0, 4, 0, 4, ["queen"])];
  const ctx = { occupancy: "double", roomType: "queen", situations: [] };
  assert.match(check("Queen Room: 4 rooms available. And 6 entire flats are free too.", "replace", queenOnly, ctx), DETERMINISTIC);
  assert.match(check("Queen Room: 4 rooms available. Twin rooms: 6 free as well.", "replace", queenOnly, ctx), DETERMINISTIC);
  assert.match(check("Queen Room: 4 rooms available. Twin rooms are available as well.", "replace", queenOnly, ctx), DETERMINISTIC);
});

test("G. 'bedrooms', 'apartments', 'of our' and number-word wording is understood", () => {
  check("There are four Master rooms, four Queen rooms, five Twin rooms and four entire 3BHK flats available.", "same");
  check("We have 4 Master bedrooms, 4 Queen bedrooms, 5 Twin bedrooms and 4 entire apartments free.", "same");
  check("4 of our Master rooms are free, 4 Queen rooms, 5 Twin rooms and 4 entire flats.", "same");
  for (const [word, n] of [["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12]]) {
    check(`${word} Master rooms are free, 4 Queen rooms, 5 Twin rooms and 4 entire flats.`, "replace");
    check(`${n} Master rooms are free, 4 Queen rooms, 5 Twin rooms and 4 entire flats.`, "replace");
  }
});

test("H. prices, guest counts and bed counts are not read as availability counts", () => {
  const counts = "Master Room: 4 rooms available. Queen Room: 4 rooms available. Twin Room: 5 rooms available. Entire Flat: 4 flats available.";
  for (const noise of [
    "Master Room: ₹4,200 for double occupancy.",
    "Master Room: 4200 rupees for double occupancy.",
    "Twin Room: 2 guests fit comfortably.",
    "Twin Room: 2 single beds.",
    "Master Room - 3 guests with an extra bed.",
    "For your family of 5 I would suggest 2 Queen rooms.",
    "The entire flat is ₹12,600 for double occupancy.",
    "Entire Flat: ₹11,655 for single occupancy.",
    "Check-in is at 12:00 PM and check-out at 11:00 AM.",
  ]) {
    assert.equal(verify(`${noise} ${counts}`), `${noise} ${counts}`, `left untouched: ${noise}`);
  }
  // Pricing and normal wording survive when counts are only missing.
  const out = check("A Master, Queen or Twin Room is ₹4,200 for double occupancy and the entire flat is ₹12,600.", "append");
  assert.ok(out.startsWith("A Master, Queen or Twin Room is ₹4,200"));
  assert.match(out, /Master Room: 4 rooms available[\s\S]*Entire Flat: 4 flats available/);
});

test("correct replies are left exactly as written; missing counts are added from the database", () => {
  check("Master Room: 4 rooms available\nQueen Room: 4 rooms available\nTwin Room: 5 rooms available\nEntire Flat: 4 flats available", "same");
  check("We have 4 Master rooms, 4 Queen rooms, 5 Twin rooms and 4 entire flats free for those dates.", "same");
  check("Master Room: 4 of 6 free, Queen Room: 4 of 6 free, Twin Room: 5 of 6 free, Entire Flat: 4 of 6 free", "same");
  check("Master Room: 1 room available. Queen Room: 1 room available. Twin Room: 1 room available. Entire Flat: 1 flat available.", "same", [snapshot(1, 1, 1, 1)]);
  check("We have great availability for those dates.", "append");
  check("Master Room: 4 rooms available. Queen Room: 4 rooms available. Twin Room: 5 rooms available.", "append");
});

test("I. with several database results (tool calls for other dates), a claim must match one of them", () => {
  const other = snapshot(6, 6, 6, 6);
  check("For the other dates we have 6 Master rooms free.", "append", [REAL, other]);
  assert.match(check("We have 3 Master rooms free.", "replace", [REAL, other]), DETERMINISTIC);
  // "available" is a contradiction only when EVERY result says zero.
  check("Master rooms are available for the second range.", "append", [snapshot(0, 4, 5, 4), other]);
});

test("I2. without any database result the AI cannot state availability counts", () => {
  const out = check("Yes, we have 3 Queen rooms free on those dates.", "replace", []);
  assert.match(out, /check-in and check-out dates/);
  check("We have 6 Master rooms, 6 Queen rooms and 6 Twin rooms in total.", "same", []);
  check("Yes, parking is available for staying guests.", "same", []);
});
