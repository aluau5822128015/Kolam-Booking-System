const express = require("express");

const router = express.Router();

const requireStaff = require("../middleware/requireStaff");
const rateLimit = require("../middleware/rateLimit");

const {
  createBooking,
  getBookings,
  updateBooking,
} = require("../controllers/bookingController");

// Public booking request from the website.
router.post(
  "/",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: Number(process.env.BOOKING_RATE_LIMIT_MAX) || 10,
    message: "Too many booking requests. Please try again in a few minutes or call our front desk.",
  }),
  createBooking
);

// Front Office endpoints: staff login required.
router.get("/", requireStaff, getBookings);
router.patch("/:id", requireStaff, updateBooking);

module.exports = router;
