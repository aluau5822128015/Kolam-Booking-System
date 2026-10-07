const { handleChat, ChatInputError } = require("../services/chatService");
const { checkAvailability, AvailabilityInputError } = require("../services/availabilityService");

// POST /api/chat  (public)
const chat = async (req, res) => {
  try {
    res.json(await handleChat(req.body));
  } catch (error) {
    if (error instanceof ChatInputError) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Chat error:", error.message);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// GET /api/public/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&roomType=master|queen|twin  (public)
const availability = async (req, res) => {
  try {
    const { checkIn, checkOut, roomType } = req.query;
    res.json(await checkAvailability({ checkIn, checkOut, roomType }));
  } catch (error) {
    if (error instanceof AvailabilityInputError) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Availability error:", error.message);
    res.status(500).json({ message: "Unable to check availability right now." });
  }
};

module.exports = { chat, availability };
