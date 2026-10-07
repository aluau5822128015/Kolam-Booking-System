// Public availability. Reuses the booking conflict rules (findConflict), so it can never
// disagree with what Front Office is allowed to confirm:
// only CONFIRMED bookings block, [checkIn, checkOut) dates, FLAT blocks all rooms of a flat.
// Returns the minimum needed: which rooms/flats are free. No guest or booking details.

const { FLAT_IDS, ROOM_KEYS, flatIdOfRoomKey, roomTypeOfRoomKey } = require("../config/inventory");
const { findConflict } = require("./bookingConflictService");

const MAX_NIGHTS = 30;
const ROOM_TYPES = ["king", "queen", "twin"];

class AvailabilityInputError extends Error {}

const todayInChennai = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const parseDay = (value, label) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AvailabilityInputError(`${label} must be a date in YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AvailabilityInputError(`${label} is not a valid date.`);
  }
  return date;
};

// "master" is the guest-facing name for the king room type.
const normalizeRoomType = (roomType) => {
  if (roomType === undefined || roomType === null || roomType === "" || roomType === "no-preference") {
    return null;
  }
  const value = String(roomType).toLowerCase() === "master" ? "king" : String(roomType).toLowerCase();
  if (!ROOM_TYPES.includes(value)) {
    throw new AvailabilityInputError("roomType must be master, queen or twin.");
  }
  return value;
};

const checkAvailability = async ({ checkIn, checkOut, roomType }) => {
  const checkInDate = parseDay(checkIn, "checkIn");
  const checkOutDate = parseDay(checkOut, "checkOut");

  if (!(checkInDate < checkOutDate)) {
    throw new AvailabilityInputError("Check-in must be before check-out.");
  }
  if (checkIn < todayInChennai()) {
    throw new AvailabilityInputError("Check-in cannot be in the past.");
  }
  if ((checkOutDate - checkInDate) / 86400000 > MAX_NIGHTS) {
    throw new AvailabilityInputError(`Please check at most ${MAX_NIGHTS} nights at a time.`);
  }

  const type = normalizeRoomType(roomType);
  const roomKeys = ROOM_KEYS.filter((key) => !type || roomTypeOfRoomKey(key) === type);

  const roomChecks = await Promise.all(
    roomKeys.map(async (roomKey) => {
      const conflict = await findConflict({
        bookingType: "ROOM",
        assignedFlatId: flatIdOfRoomKey(roomKey),
        assignedRoomKey: roomKey,
        checkIn: checkInDate,
        checkOut: checkOutDate,
      });
      return conflict ? null : roomKey;
    })
  );

  const flatChecks = await Promise.all(
    FLAT_IDS.map(async (flatId) => {
      const conflict = await findConflict({
        bookingType: "FLAT",
        assignedFlatId: flatId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
      });
      return conflict ? null : flatId;
    })
  );

  const rooms = roomChecks
    .filter(Boolean)
    .map((roomKey) => ({
      flatId: flatIdOfRoomKey(roomKey),
      roomKey,
      roomType: roomTypeOfRoomKey(roomKey),
    }));
  const flats = flatChecks.filter(Boolean).map((flatId) => ({ flatId }));

  return {
    checkIn,
    checkOut,
    available: rooms.length > 0 || flats.length > 0,
    rooms,
    flats,
  };
};

module.exports = { checkAvailability, AvailabilityInputError };
