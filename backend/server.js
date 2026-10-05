const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/db");
const bookingRoutes = require("./routes/bookingRoutes");

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("Kolam backend is running!");
});

// Booking routes
app.use("/api/bookings", bookingRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Kolam backend running on port ${PORT}`);
});