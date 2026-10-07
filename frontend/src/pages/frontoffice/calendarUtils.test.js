// Run: node --test src/pages/frontoffice/calendarUtils.test.js  (from frontend/)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  barsForRoom,
  buildDays,
  bookingForRoomOnDay,
  localTodayKey,
  roomKeysOfBooking,
  summarize,
  ROOM_GROUPS,
} from "./calendarUtils.js";

const booking = (over) => ({
  _id: "x",
  guestName: "G",
  status: "CONFIRMED",
  bookingType: "ROOM",
  assignedFlatId: "1A",
  assignedRoomKey: "1A-R1",
  checkIn: "2030-10-07T00:00:00.000Z",
  checkOut: "2030-10-10T00:00:00.000Z",
  ...over,
});

test("inventory groups: 3 groups of 6, exact room keys, R1 titled Master Room", () => {
  assert.deepEqual(ROOM_GROUPS.map((g) => [g.title, g.rooms.length]), [
    ["Master Room", 6],
    ["Queen Room", 6],
    ["Twin Room", 6],
  ]);
  assert.deepEqual(ROOM_GROUPS[0].rooms.map((r) => r.roomKey), ["1A-R1", "1B-R1", "2A-R1", "2B-R1", "3A-R1", "3B-R1"]);
  assert.deepEqual(ROOM_GROUPS[1].rooms.map((r) => r.roomKey), ["1A-R2", "1B-R2", "2A-R2", "2B-R2", "3A-R2", "3B-R2"]);
  assert.deepEqual(ROOM_GROUPS[2].rooms.map((r) => r.roomKey), ["1A-R3", "1B-R3", "2A-R3", "2B-R3", "3A-R3", "3B-R3"]);
});

test("Oct 7 -> Oct 10 spans exactly Oct 7, 8, 9 (check-out day not covered)", () => {
  const bars = barsForRoom("1A-R1", [booking()], "2030-10-05", 14);
  assert.equal(bars.length, 1);
  assert.equal(bars[0].startCol, 2); // Oct 7 is the 3rd column
  assert.equal(bars[0].span, 3);
  assert.equal(bookingForRoomOnDay("1A-R1", [booking()], "2030-10-09") !== null, true);
  assert.equal(bookingForRoomOnDay("1A-R1", [booking()], "2030-10-10"), null);
});

test("back-to-back stays on the same room do not overlap", () => {
  const a = booking({});
  const b = booking({ checkIn: "2030-10-10T00:00:00.000Z", checkOut: "2030-10-12T00:00:00.000Z" });
  const bars = barsForRoom("1A-R1", [a, b], "2030-10-07", 7);
  assert.deepEqual(bars.map((x) => [x.startCol, x.span]), [[0, 3], [3, 2]]);
});

test("bars are clipped to the visible window", () => {
  const [bar] = barsForRoom("1A-R1", [booking()], "2030-10-08", 7);
  assert.equal(bar.startCol, 0);
  assert.equal(bar.span, 2);
  assert.equal(bar.clippedLeft, true);
  assert.equal(barsForRoom("1A-R1", [booking()], "2030-11-01", 7).length, 0);
});

test("PENDING and REJECTED never occupy rooms", () => {
  for (const status of ["PENDING", "REJECTED"]) {
    assert.deepEqual(roomKeysOfBooking(booking({ status })), []);
    assert.equal(barsForRoom("1A-R1", [booking({ status })], "2030-10-05", 14).length, 0);
  }
});

test("FLAT booking occupies all 3 rooms of its flat only", () => {
  const flat = booking({ bookingType: "FLAT", assignedRoomKey: null });
  assert.deepEqual(roomKeysOfBooking(flat), ["1A-R1", "1A-R2", "1A-R3"]);
  assert.equal(barsForRoom("1A-R2", [flat], "2030-10-07", 7).length, 1);
  assert.equal(barsForRoom("1B-R2", [flat], "2030-10-07", 7).length, 0);
});

test("summary counts come from real bookings and today", () => {
  const list = [
    booking({}), // 1A-R1 Oct 7-10
    booking({ _id: "f", bookingType: "FLAT", assignedFlatId: "2A", assignedRoomKey: null, checkIn: "2030-10-08T00:00:00.000Z", checkOut: "2030-10-09T00:00:00.000Z" }),
    booking({ _id: "p", status: "PENDING", assignedFlatId: null, assignedRoomKey: null }),
    booking({ _id: "r", status: "REJECTED" }),
  ];
  assert.deepEqual(summarize(list, "2030-10-08"), { occupied: 4, available: 14, pending: 1, checkIns: 1, checkOuts: 0 });
  assert.deepEqual(summarize(list, "2030-10-07"), { occupied: 1, available: 17, pending: 1, checkIns: 1, checkOuts: 0 });
  assert.deepEqual(summarize(list, "2030-10-10"), { occupied: 0, available: 18, pending: 1, checkIns: 0, checkOuts: 1 });
  assert.deepEqual(summarize([], "2030-10-10"), { occupied: 0, available: 18, pending: 0, checkIns: 0, checkOuts: 0 });
});

test("day headers and local today key", () => {
  const days = buildDays("2030-10-07", 3);
  assert.deepEqual(days.map((d) => `${d.dow} ${d.dayNum}`), ["Mon 07", "Tue 08", "Wed 09"]);
  assert.equal(localTodayKey(new Date(2030, 9, 7, 23, 59)), "2030-10-07");
});
