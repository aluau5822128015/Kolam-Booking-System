const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    guestName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    checkIn: {
      type: Date,
      required: true,
    },

    checkOut: {
      type: Date,
      required: true,
    },

    guests: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },

    roomType: {
      type: String,
      required: true,
      enum: ["king", "queen", "twin", "no-preference"],
    },

    specialRequest: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Rejected"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;