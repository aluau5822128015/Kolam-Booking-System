// Pure date + booking-to-room mapping logic for the occupancy calendar.
// Dates are handled as "YYYY-MM-DD" day keys. Bookings are stored at UTC midnight,
// so their day key is read in UTC; "today" is the staff member's local date.
// Occupancy follows the backend rule [checkIn, checkOut): the check-out day is free.

import { ROOMS, ROOM_TYPES } from "../../data/kolamConfig.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n) => String(n).padStart(2, "0");
const toUtcMs = (dayKey) => {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const bookingDayKey = (value) => new Date(value).toISOString().slice(0, 10);

export const localTodayKey = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const addDays = (dayKey, n) => new Date(toUtcMs(dayKey) + n * DAY_MS).toISOString().slice(0, 10);

// Whole days from a to b (b - a).
export const diffDays = (a, b) => Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);

export const buildDays = (startKey, count) =>
  Array.from({ length: count }, (_, i) => {
    const key = addDays(startKey, i);
    const date = new Date(toUtcMs(key));
    return {
      key,
      dow: DOW[date.getUTCDay()],
      dayNum: pad(date.getUTCDate()),
      month: MONTHS[date.getUTCMonth()],
      isWeekend: [0, 6].includes(date.getUTCDay()),
    };
  });

export const formatDayKey = (dayKey) => {
  const date = new Date(toUtcMs(dayKey));
  return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

// Calendar groups in the required order. R1 is shown as "Master Room".
export const ROOM_GROUPS = ["R1", "R2", "R3"].map((roomId) => ({
  roomId,
  title: ROOM_TYPES[roomId].label,
  rooms: ROOMS.filter((room) => room.roomId === roomId),
}));

// Rooms a booking occupies. Only CONFIRMED bookings occupy anything.
export const roomKeysOfBooking = (booking) => {
  if (booking.status !== "CONFIRMED" || !booking.assignedFlatId) return [];
  if (booking.bookingType === "FLAT") {
    return ROOMS.filter((room) => room.flatId === booking.assignedFlatId).map((room) => room.roomKey);
  }
  return booking.assignedRoomKey ? [booking.assignedRoomKey] : [];
};

// True if the booking occupies the night starting on dayKey.
export const occupiesDay = (booking, dayKey) =>
  bookingDayKey(booking.checkIn) <= dayKey && dayKey < bookingDayKey(booking.checkOut);

// Bars for one room row inside the visible window [startKey, startKey + dayCount).
// startCol is 0-based and span is the number of day columns covered.
export const barsForRoom = (roomKey, bookings, startKey, dayCount) =>
  bookings
    .filter((booking) => roomKeysOfBooking(booking).includes(roomKey))
    .map((booking) => {
      const inOffset = diffDays(startKey, bookingDayKey(booking.checkIn));
      const outOffset = diffDays(startKey, bookingDayKey(booking.checkOut));
      const startCol = Math.max(inOffset, 0);
      const endCol = Math.min(outOffset, dayCount);
      return {
        booking,
        startCol,
        span: endCol - startCol,
        clippedLeft: inOffset < 0,
        clippedRight: outOffset > dayCount,
      };
    })
    .filter((bar) => bar.span > 0);

// Confirmed booking occupying a room on a given day, if any.
export const bookingForRoomOnDay = (roomKey, bookings, dayKey) =>
  bookings.find(
    (booking) => roomKeysOfBooking(booking).includes(roomKey) && occupiesDay(booking, dayKey)
  ) || null;

// Confirmed bookings in a room on/after a day, soonest first.
export const upcomingForRoom = (roomKey, bookings, dayKey) =>
  bookings
    .filter(
      (booking) =>
        roomKeysOfBooking(booking).includes(roomKey) && bookingDayKey(booking.checkOut) > dayKey
    )
    .sort((a, b) => bookingDayKey(a.checkIn).localeCompare(bookingDayKey(b.checkIn)));

// Numbers shown above the calendar, all derived from real bookings.
export const summarize = (bookings, todayKey) => {
  const occupiedRooms = new Set(
    ROOMS.filter((room) => bookingForRoomOnDay(room.roomKey, bookings, todayKey)).map((room) => room.roomKey)
  );
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  return {
    occupied: occupiedRooms.size,
    available: ROOMS.length - occupiedRooms.size,
    pending: bookings.filter((b) => b.status === "PENDING").length,
    checkIns: confirmed.filter((b) => bookingDayKey(b.checkIn) === todayKey).length,
    checkOuts: confirmed.filter((b) => bookingDayKey(b.checkOut) === todayKey).length,
  };
};
