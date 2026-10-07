// Unit tests for the chat date reader (no server, no database).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseStayDates,
  detectRoomType,
  detectOccupancy,
  isDateReply,
  mentionsDoubleRoom,
  mentionsStay,
  wantsRoom,
  wantsEntireFlat,
} = require("../services/dateParser");

const TODAY = "2026-10-07";
const parse = (...texts) => parseStayDates(texts, TODAY);

test("day-month ranges", () => {
  assert.deepEqual(parse("10 Dec to 12 Dec"), { checkIn: "2026-12-10", checkOut: "2026-12-12" });
  assert.deepEqual(parse("Is a room free from 10th December till 12th December?"), { checkIn: "2026-12-10", checkOut: "2026-12-12" });
  assert.deepEqual(parse("10 dec - 12 dec"), { checkIn: "2026-12-10", checkOut: "2026-12-12" });
});

test("two days in one month", () => {
  assert.deepEqual(parse("10-12 Dec"), { checkIn: "2026-12-10", checkOut: "2026-12-12" });
  assert.deepEqual(parse("rooms for 10 to 12 December 2027"), { checkIn: "2027-12-10", checkOut: "2027-12-12" });
});

test("every natural way of writing Oct 16 to 18 gives the same range", () => {
  const expected = { checkIn: "2026-10-16", checkOut: "2026-10-18" };
  for (const text of [
    "Oct 16 to 18",
    "October 16 to 18",
    "Oct 16th to 18th",
    "October 16th - 18th",
    "Oct 16-18",
    "Oct 16–18",
    "16 Oct to 18 Oct",
    "16th to 18th October",
    "16-18 Oct",
    "October 16 to October 18",
    "Oct 16 till 18",
    "i want room from oct 16th to 18th for double occupancy",
    "I want a room from Oct 16th to 18th",
    "I need accommodation from Oct 16 to 18",
    "Do you have a room from Oct 16 to 18?",
    "Looking for a room Oct 16–18",
  ]) {
    assert.deepEqual(parse(text), expected, text);
  }
});

test("a year is picked up from either date", () => {
  assert.deepEqual(parse("Oct 16 to 18 2027"), { checkIn: "2027-10-16", checkOut: "2027-10-18" });
  assert.deepEqual(parse("16th to 18th October 2027"), { checkIn: "2027-10-16", checkOut: "2027-10-18" });
});

test("occupancy: only explicit wording counts, and 'double room' / 'for 2 nights' do not", () => {
  assert.equal(detectOccupancy("for double occupancy"), "double");
  assert.equal(detectOccupancy("a room for 2 people"), "double");
  assert.equal(detectOccupancy("two guests please"), "double");
  assert.equal(detectOccupancy("we are a couple"), "double");
  assert.equal(detectOccupancy("single occupancy"), "single");
  assert.equal(detectOccupancy("1 person"), "single");
  assert.equal(detectOccupancy("travelling solo"), "single");
  assert.equal(detectOccupancy("do you have a double room"), null);
  assert.equal(detectOccupancy("a room for 2 nights"), null);
  assert.equal(detectOccupancy("Oct 16 to 18"), null);
  // "double room" is not a room type either
  assert.equal(detectRoomType("do you have a double room"), null);
  assert.equal(mentionsDoubleRoom("do you have a double room"), true);
  assert.equal(mentionsDoubleRoom("double occupancy"), false);
});

test("a plain date reply is recognised; questions about other things are not", () => {
  for (const text of ["22 Oct", "Oct 10 to 12 2031", "from 10 Oct to 12 Oct 2031", "tomorrow", "16th to 18th October", "12 oct please"]) {
    assert.equal(isDateReply(text), true, text);
  }
  for (const text of ["What day of the week is Oct 16?", "My birthday is Oct 16", "Is breakfast free on 16 Oct", "hello"]) {
    assert.equal(isDateReply(text), false, text);
  }
});

test("two single dates only combine when the second is after the first", () => {
  assert.deepEqual(parse("22 Oct", "16 Oct"), { checkIn: "2026-10-16", needsCheckout: true }, "not a reversed range");
  assert.deepEqual(parse("16 Oct", "22 Oct"), { checkIn: "2026-10-16", checkOut: "2026-10-22" });
});

test("room / stay intent words", () => {
  assert.equal(mentionsStay("I want a room"), true);
  assert.equal(mentionsStay("I need accommodation"), true);
  assert.equal(mentionsStay("What day is Oct 16?"), false);
  assert.equal(wantsRoom("I want a room"), true);
  assert.equal(wantsRoom("Looking for a room"), true);
  assert.equal(wantsRoom("Do you have a room from Oct 16"), true);
  assert.equal(wantsRoom("My birthday is Oct 16"), false);
  assert.equal(wantsRoom("How many rooms do you have?"), false);
  assert.equal(wantsRoom("What rooms do you have?"), false);
});

test("month-day ranges", () => {
  assert.deepEqual(parse("Dec 10 to Dec 12"), { checkIn: "2026-12-10", checkOut: "2026-12-12" });
  assert.deepEqual(parse("december 10 - december 12 2027"), { checkIn: "2027-12-10", checkOut: "2027-12-12" });
});

test("ISO and numeric (day/month) dates", () => {
  assert.deepEqual(parse("2031-10-10 to 2031-10-12"), { checkIn: "2031-10-10", checkOut: "2031-10-12" });
  assert.deepEqual(parse("10/12 to 12/12"), { checkIn: "2026-12-10", checkOut: "2026-12-12" });
  assert.deepEqual(parse("10/12/2026 to 12/12/2026"), { checkIn: "2026-12-10", checkOut: "2026-12-12" });
});

test("a year on one date applies to both; dates already passed this year roll to next year", () => {
  assert.deepEqual(parse("10 Oct to 12 Oct 2031"), { checkIn: "2031-10-10", checkOut: "2031-10-12" });
  assert.deepEqual(parse("3 Jan to 5 Jan"), { checkIn: "2027-01-03", checkOut: "2027-01-05" });
  assert.deepEqual(parse("28 Dec to 2 Jan"), { checkIn: "2026-12-28", checkOut: "2027-01-02" });
});

test("relative words and nights", () => {
  assert.deepEqual(parse("tomorrow for 2 nights"), { checkIn: "2026-10-08", checkOut: "2026-10-10" });
  assert.deepEqual(parse("from 10 Dec for 3 nights"), { checkIn: "2026-12-10", checkOut: "2026-12-13" });
  assert.deepEqual(parse("today to tomorrow"), { checkIn: "2026-10-07", checkOut: "2026-10-08" });
  assert.deepEqual(parse("day after tomorrow to 12 Oct"), { checkIn: "2026-10-09", checkOut: "2026-10-12" });
});

test("a single date asks for the check-out, and the next message can complete it", () => {
  assert.deepEqual(parse("10 Dec"), { checkIn: "2026-12-10", needsCheckout: true });
  assert.deepEqual(parse("10 Dec", "12 Dec"), { checkIn: "2026-12-10", checkOut: "2026-12-12" });
});

test("unreadable or invalid dates return null instead of guessing", () => {
  assert.equal(parse("is a room free next weekend?"), null);
  assert.equal(parse("hello there"), null);
  assert.equal(parse("31 Feb to 2 Mar"), null);
  assert.equal(parse("32 Dec to 33 Dec"), null);
});

test("room type and entire-flat detection", () => {
  assert.equal(detectRoomType("a master room please"), "king");
  assert.equal(detectRoomType("King room"), "king");
  assert.equal(detectRoomType("queen room"), "queen");
  assert.equal(detectRoomType("twin beds"), "twin");
  assert.equal(detectRoomType("any room"), null);
  assert.equal(wantsEntireFlat("do you have a flat free"), true);
  assert.equal(wantsEntireFlat("entire apartment"), true);
  assert.equal(wantsEntireFlat("queen room"), false);
});
