const mongoose = require("mongoose");

const { FLAT_IDS, ROOM_KEYS } = require("../config/inventory");
const { getAssignmentErrors, getDateErrors, todayInChennai } = require("../services/bookingRules");

const BOOKING_TYPES = ["ROOM", "FLAT"];
const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "REJECTED"];

const bookingSchema = new mongoose.Schema(
  {
    guestName: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "Guest name must be at least 2 characters."],
      maxlength: [100, "Guest name must be at most 100 characters."],
    },

    // 7-20 characters: digits, optional leading +, spaces and dashes.
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+?[0-9][0-9\s-]{6,19}$/, "Please enter a valid phone number."],
    },

    checkIn: {
      type: Date,
      required: true,
      cast: "checkIn must be a valid date.",
    },

    checkOut: {
      type: Date,
      required: true,
      cast: "checkOut must be a valid date.",
    },

    guests: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
      cast: "guests must be a number.",
    },

    // Guest's room preference. Not meaningful for FLAT bookings.
    roomType: {
      type: String,
      enum: ["king", "queen", "twin", "no-preference"],
      default: "no-preference",
    },

    // ROOM = one bedroom, FLAT = entire 3BHK flat.
    bookingType: {
      type: String,
      enum: BOOKING_TYPES,
      default: "ROOM",
    },

    // Set by Front Office. ROOM: flat + room key. FLAT: flat only.
    assignedFlatId: {
      type: String,
      enum: { values: FLAT_IDS, message: "Invalid flat: {VALUE}." },
      default: null,
    },

    assignedRoomKey: {
      type: String,
      enum: { values: ROOM_KEYS, message: "Invalid room key: {VALUE}." },
      default: null,
    },

    specialRequest: {
      type: String,
      trim: true,
      default: "",
      maxlength: [1000, "Special request must be at most 1000 characters."],
    },

    // Only CONFIRMED bookings occupy rooms.
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "PENDING",
      // Records created before this change stored "Pending"/"Confirmed"/"Rejected".
      get: (value) => (typeof value === "string" ? value.toUpperCase() : value),
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

// Cross-field rules: dates and room/flat assignment.
bookingSchema.pre("validate", function () {
  const errors = [
    ...getDateErrors(this),
    ...getAssignmentErrors(this),
  ];

  // New requests cannot start in the past (existing bookings may, e.g. a stay in progress).
  if (
    this.isNew &&
    this.checkIn instanceof Date &&
    !Number.isNaN(this.checkIn.getTime()) &&
    this.checkIn.toISOString().slice(0, 10) < todayInChennai()
  ) {
    errors.push("Check-in cannot be in the past.");
  }

  errors.forEach((message, index) => {
    this.invalidate(`booking_${index}`, message);
  });
});

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
module.exports.BOOKING_TYPES = BOOKING_TYPES;
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
