const express = require("express");

const rateLimit = require("../middleware/rateLimit");
const { chat } = require("../controllers/chatController");

const router = express.Router();

router.post(
  "/",
  rateLimit({ windowMs: 60 * 1000, max: Number(process.env.CHAT_RATE_LIMIT_MAX) || 20, message: "Too many messages. Please wait a moment." }),
  chat
);

module.exports = router;
