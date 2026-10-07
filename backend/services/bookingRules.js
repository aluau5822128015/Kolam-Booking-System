// Pure validation rules for booking dates and room/flat assignment.
// No database access, so it can be reused by the model, controllers and
// future availability / chatbot code.

const {
  isValidFlatId,
  isValidRoomKey,
  flatIdOfRoomKey,
  roomTypeOfRoomKey,
} = require("../config/inventory");

// Today's date (YYYY-MM-DD) in the property's timezone.
const todayInChennai = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const isBlank = (value) => value === undefined || value === null || value === "";

// Returns an array of human-readable error strings (empty = valid).
const getAssignmentErrors = ({
  bookingType,
  status,
  roomType,
  assignedFlatId,
  assignedRoomKey,
}) => {
  const errors = [];
  const hasFlat = !isBlank(assignedFlatId);
  const hasRoom = !isBlank(assignedRoomKey);

  if (hasFlat && !isValidFlatId(assignedFlatId)) {
    errors.push(`Invalid flat: ${String(assignedFlatId)}.`);
  }

  if (hasRoom && !isValidRoomKey(assignedRoomKey)) {
    errors.push(`Invalid room key: ${String(assignedRoomKey)}.`);
  }

  if (
    hasFlat &&
    hasRoom &&
    isValidFlatId(assignedFlatId) &&
    isValidRoomKey(assignedRoomKey) &&
    flatIdOfRoomKey(assignedRoomKey) !== assignedFlatId
  ) {
    errors.push(
      `Room ${assignedRoomKey} does not belong to flat ${assignedFlatId}.`
    );
  }

  if (hasRoom && !hasFlat) {
    errors.push("assignedFlatId is required when assignedRoomKey is given.");
  }

  if (bookingType === "FLAT" && hasRoom) {
    errors.push("A FLAT booking cannot have a room assignment.");
  }

  if (status === "CONFIRMED") {
    if (!hasFlat) {
      errors.push("assignedFlatId is required to confirm a booking.");
    }

    if (bookingType === "ROOM") {
      if (!hasRoom) {
        errors.push("assignedRoomKey is required to confirm a ROOM booking.");
      } else if (
        isValidRoomKey(assignedRoomKey) &&
        roomType &&
        roomType !== "no-preference" &&
        roomTypeOfRoomKey(assignedRoomKey) !== roomType
      ) {
        errors.push(
          `Room ${assignedRoomKey} is a ${roomTypeOfRoomKey(
            assignedRoomKey
          )} room but the guest requested ${roomType}.`
        );
      }
    }
  }

  return errors;
};

const getDateErrors = ({ checkIn, checkOut }) => {
  const errors = [];

  if (checkIn instanceof Date && checkOut instanceof Date) {
    if (!(checkIn < checkOut)) {
      errors.push("Check-in must be before check-out.");
    }
  }

  return errors;
};

module.exports = { getAssignmentErrors, getDateErrors, isBlank, todayInChennai };
