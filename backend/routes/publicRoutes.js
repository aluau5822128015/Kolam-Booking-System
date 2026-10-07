const express = require("express");

const rateLimit = require("../middleware/rateLimit");
const { availability } = require("../controllers/chatController");

const router = express.Router();

// Public, no login. Returns only which rooms/flats are free, never booking details.
router.get(
  "/availability",
  rateLimit({ windowMs: 60 * 1000, max: Number(process.env.PUBLIC_RATE_LIMIT_MAX) || 30, message: "Too many requests. Please wait a moment." }),
  availability
);

module.exports = router;
