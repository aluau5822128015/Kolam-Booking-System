const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const { BOOKING_STATUSES, BOOKING_TYPES } = require("../models/Booking");
const { findConflict } = require("../services/bookingConflictService");
const { withFlatLock, LockBusyError } = require("../services/inventoryLock");
const { isBlank } = require("../services/bookingRules");

// Fields a public guest may submit. Status and assignment are NEVER taken
// from the public request.
const CREATE_FIELDS = [
  "guestName",
  "phone",
  "checkIn",
  "checkOut",
  "guests",
  "roomType",
  "bookingType",
  "specialRequest",
];

// Fields Front Office may change.
const UPDATE_FIELDS = ["status", "assignedFlatId", "assignedRoomKey"];

// Matches legacy "Pending" values too.
const PENDING = /^pending$/i;
const CONFIRMED = /^confirmed$/i;

const pick = (source, fields) =>
  fields.reduce((result, field) => {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
    return result;
  }, {});

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const validationMessages = (error) =>
  Object.values(error.errors).map((item) => item.message);

// Sends a safe response for any error; never leaks stack traces or DB details.
const handleError = (res, error, fallbackMessage) => {
  if (error instanceof LockBusyError) {
    return res.status(409).json({
      message: "Another confirmation for this flat is in progress. Please try again in a moment.",
    });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      message: "Validation failed.",
      errors: validationMessages(error),
    });
  }

  console.error(fallbackMessage, error.message);
  return res.status(500).json({ message: fallbackMessage });
};

const createBooking = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ message: "Request body must be a JSON object." });
    }

    // Always starts as PENDING with no assignment.
    const booking = await Booking.create({
      ...pick(req.body, CREATE_FIELDS),
      status: "PENDING",
    });

    res.status(201).json({
      message: "Booking request received successfully!",
      booking: booking,
    });
  } catch (error) {
    handleError(res, error, "Failed to create booking request.");
  }
};

// Staff only (requireStaff middleware in the routes).
const getBookings = async (req, res) => {
  try {
    const filter = {};

    if (req.query.status !== undefined) {
      const status = String(req.query.status).toUpperCase();
      if (!BOOKING_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status filter." });
      }
      filter.status = new RegExp(`^${status}$`, "i");
    }

    if (req.query.bookingType !== undefined) {
      const bookingType = String(req.query.bookingType).toUpperCase();
      if (!BOOKING_TYPES.includes(bookingType)) {
        return res.status(400).json({ message: "Invalid bookingType filter." });
      }
      filter.bookingType = bookingType;
    }

    const bookings = await Booking.find(filter).sort({ createdAt: -1 });

    res.json({ count: bookings.length, bookings });
  } catch (error) {
    handleError(res, error, "Failed to fetch bookings.");
  }
};

// Staff only (requireStaff middleware in the routes).
const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ message: "Invalid booking id." });
    }

    if (!isPlainObject(req.body) || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "Request body must be a non-empty JSON object." });
    }

    const unknown = Object.keys(req.body).filter(
      (key) => !UPDATE_FIELDS.includes(key)
    );
    if (unknown.length > 0) {
      return res.status(400).json({
        message: `Fields cannot be updated: ${unknown.join(", ")}.`,
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Lifecycle: PENDING -> CONFIRMED or PENDING -> REJECTED. Final states are locked.
    if (booking.status !== "PENDING") {
      return res.status(409).json({
        message: `Booking is already ${booking.status} and can no longer be changed.`,
      });
    }

    const { status, assignedFlatId, assignedRoomKey } = req.body;
    let newStatus;

    if (status !== undefined) {
      newStatus = String(status).toUpperCase();
      if (!["CONFIRMED", "REJECTED"].includes(newStatus)) {
        return res.status(400).json({
          message: "status must be CONFIRMED or REJECTED.",
        });
      }
    }

    if (
      newStatus === "REJECTED" &&
      (assignedFlatId !== undefined || assignedRoomKey !== undefined)
    ) {
      return res.status(400).json({
        message: "A rejected booking cannot have a room assignment.",
      });
    }

    // Needed to undo a confirmation that loses its lock (see the fence below).
    const before = {
      assignedFlatId: booking.assignedFlatId ?? null,
      assignedRoomKey: booking.assignedRoomKey ?? null,
    };

    if (assignedFlatId !== undefined) {
      booking.assignedFlatId = isBlank(assignedFlatId) ? null : assignedFlatId;
    }
    if (assignedRoomKey !== undefined) {
      booking.assignedRoomKey = isBlank(assignedRoomKey) ? null : assignedRoomKey;
    }
    if (newStatus) {
      booking.status = newStatus;
    }

    // Dates, flat/room validity, room-belongs-to-flat, FLAT/ROOM rules.
    await booking.validate();

    const changes = {
      status: booking.status,
      assignedFlatId: booking.assignedFlatId,
      assignedRoomKey: booking.assignedRoomKey,
    };

    // Applies the change only if the booking is STILL pending (so a concurrent confirm/reject
    // cannot be overwritten). Returns the updated booking, or null if it was already decided.
    const applyChanges = async () => {
      const done = await Booking.updateOne({ _id: booking._id, status: PENDING }, { $set: changes });
      return done.matchedCount === 1 ? Booking.findById(booking._id) : null;
    };
    const alreadyDecided = async () => {
      const current = await Booking.findById(booking._id);
      return res.status(409).json({
        message: `Booking is already ${current ? current.status : "changed"} and can no longer be changed.`,
      });
    };

    if (newStatus !== "CONFIRMED") {
      const updated = await applyChanges();
      if (!updated) return alreadyDecided();
      return res.json({ message: "Booking updated.", booking: updated });
    }

    // CONFIRMED: the conflict check and the save must not interleave with another confirmation
    // for the same flat, so both run while holding that flat's lock.
    const checkConflict = () =>
      findConflict({
        bookingType: booking.bookingType,
        assignedFlatId: booking.assignedFlatId,
        assignedRoomKey: booking.assignedRoomKey,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        excludeId: booking._id,
      });

    const outcome = await withFlatLock(booking.assignedFlatId, async (lock) => {
      const conflict = await checkConflict();
      if (conflict) return { conflict };

      // Fence 1: a request that stalled past the lock's TTL may have lost the flat to another
      // request, so its conflict check above can no longer be trusted. Do not write.
      if (!(await lock.isHeld())) throw new LockBusyError("The flat lock expired before the booking was saved.");

      const updated = await applyChanges();

      // Fence 2: ownership lost in the instant between the check above and the write. Look
      // again; if another confirmed booking now occupies this inventory, undo this one.
      if (updated && !(await lock.isOwner())) {
        const late = await checkConflict();
        if (late) {
          await Booking.updateOne({ _id: booking._id, status: CONFIRMED }, { $set: { status: "PENDING", ...before } });
          return { conflict: late };
        }
      }
      return { updated };
    });

    if (outcome.conflict) {
      const conflict = outcome.conflict;
      const target =
        booking.bookingType === "FLAT"
          ? `Flat ${booking.assignedFlatId}`
          : `Room ${booking.assignedRoomKey}`;

      return res.status(409).json({
        message: `${target} is already occupied by a confirmed booking during these dates.`,
        conflict: {
          bookingType: conflict.bookingType,
          assignedFlatId: conflict.assignedFlatId,
          assignedRoomKey: conflict.assignedRoomKey,
          checkIn: conflict.checkIn,
          checkOut: conflict.checkOut,
        },
      });
    }
    if (!outcome.updated) return alreadyDecided();

    res.json({ message: "Booking updated.", booking: outcome.updated });
  } catch (error) {
    handleError(res, error, "Failed to update booking.");
  }
};

module.exports = {
  createBooking,
  getBookings,
  updateBooking,
};
