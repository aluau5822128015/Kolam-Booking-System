// Availability / conflict checking.
//
// Rules:
//  - Only CONFIRMED bookings occupy rooms (PENDING and REJECTED never do).
//  - Dates are half-open intervals [checkIn, checkOut): a stay ending on the
//    day another begins does NOT conflict.
//  - A FLAT booking occupies all rooms of its flat.
//  - Different flats never conflict.

const Booking = require("../models/Booking");

// Case-insensitive so any legacy "Confirmed" value is still honoured.
const CONFIRMED = /^confirmed$/i;

// Overlap of [aIn, aOut) and [bIn, bOut): aIn < bOut && aOut > bIn
const rangesOverlap = (aIn, aOut, bIn, bOut) => aIn < bOut && aOut > bIn;

// Returns the first CONFIRMED booking that conflicts with the given
// assignment, or null. `excludeId` skips the booking being confirmed.
const findConflict = async ({
  bookingType,
  assignedFlatId,
  assignedRoomKey,
  checkIn,
  checkOut,
  excludeId,
}) => {
  const query = {
    status: CONFIRMED,
    assignedFlatId,
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  if (bookingType === "ROOM") {
    // Conflicts with a whole-flat booking or the same room.
    query.$or = [{ bookingType: "FLAT" }, { assignedRoomKey }];
  }
  // For FLAT: any confirmed booking in the flat conflicts (ROOM or FLAT).

  return Booking.findOne(query).lean();
};

module.exports = { findConflict, rangesOverlap, CONFIRMED };
