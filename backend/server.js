const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/db");
const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const publicRoutes = require("./routes/publicRoutes");

dotenv.config();

const app = express();

// Do not advertise the framework in every response.
app.disable("x-powered-by");

// Connect to MongoDB
connectDB();

// Behind Render's proxy, trust one proxy hop so req.ip is the real client IP
// (needed for the per-IP rate limits).
app.set("trust proxy", 1);

// Allowed browser origins, from CORS_ORIGIN (comma-separated, e.g.
// "https://your-site.vercel.app,http://localhost:5173"). Defaults to the local dev
// frontend when unset. Wildcards are never allowed.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter((origin) => origin && origin !== "*");

if (allowedOrigins.length === 0) {
  console.warn("CORS_ORIGIN has no valid origins; browser requests will be blocked.");
}

// Middleware
app.use(cors({ origin: allowedOrigins }));

app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("Kolam backend is running!");
});

// Health check for Render / uptime monitors: static, touches no secrets or database.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Staff authentication
app.use("/api/auth", authRoutes);

// Public guest chatbot and availability (no login)
app.use("/api/chat", chatRoutes);
app.use("/api/public", publicRoutes);

// Booking routes
app.use("/api/bookings", bookingRoutes);

// Safe fallback error handler (e.g. malformed JSON): no stack traces to clients.
app.use((err, req, res, next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    message: status === 500 ? "Internal server error." : "Invalid request.",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Kolam backend running on port ${PORT}`);
});