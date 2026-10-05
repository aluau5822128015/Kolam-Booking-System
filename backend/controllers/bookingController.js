const Booking = require("../models/Booking");

const createBooking = async (req, res) => {
  try {
    const booking = await Booking.create(req.body);

    res.status(201).json({
      message: "Booking request received successfully!",
      booking: booking,
    });
  } catch (error) {
    console.error("Booking creation error:", error.message);

    res.status(500).json({
      message: "Failed to create booking request.",
      error: error.message,
    });
  }
};

module.exports = {
  createBooking,
};