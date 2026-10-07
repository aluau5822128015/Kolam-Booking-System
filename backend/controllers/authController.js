const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Staff = require("../models/Staff");

const TOKEN_LIFETIME = "8h";

// Limit login attempts per IP: 10 failures per 15 minutes (in memory, single server).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map();

const isBlocked = (ip) => {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
};

const recordFailure = (ip) => {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    failures.set(ip, { first: Date.now(), count: 1 });
  } else {
    entry.count += 1;
  }
};

// Hash used to spend the same time when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const login = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res
        .status(503)
        .json({ message: "Staff authentication is not configured." });
    }

    const ip = req.ip;
    if (isBlocked(ip)) {
      return res
        .status(429)
        .json({ message: "Too many failed attempts. Try again later." });
    }

    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const staff = await Staff.findOne({ username: username.trim().toLowerCase() });
    const valid = await bcrypt.compare(password, staff ? staff.passwordHash : DUMMY_HASH);

    // Same message for unknown user, wrong password and disabled account.
    if (!staff || !staff.active || !valid) {
      recordFailure(ip);
      return res.status(401).json({ message: "Invalid username or password." });
    }

    failures.delete(ip);

    const token = jwt.sign({ sub: String(staff._id) }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: TOKEN_LIFETIME,
    });

    res.json({ token, username: staff.username });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Login failed." });
  }
};

// Used by the frontend to check that a stored token is still valid.
const me = (req, res) => {
  res.json({ username: req.staff.username });
};

module.exports = { login, me };
