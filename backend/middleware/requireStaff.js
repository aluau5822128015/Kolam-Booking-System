const jwt = require("jsonwebtoken");

const Staff = require("../models/Staff");

// Protects Front Office routes. Expects "Authorization: Bearer <token>".
// Fails closed: without JWT_SECRET nothing protected is reachable.
const requireStaff = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res
        .status(503)
        .json({ message: "Staff authentication is not configured." });
    }

    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
    } catch {
      return res.status(401).json({ message: "Session expired or invalid." });
    }

    // Re-check the account so disabled staff lose access immediately.
    const staff = await Staff.findById(payload.sub).lean();
    if (!staff || !staff.active) {
      return res.status(401).json({ message: "Session expired or invalid." });
    }

    req.staff = { id: String(staff._id), username: staff.username };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    res.status(500).json({ message: "Authentication failed." });
  }
};

module.exports = requireStaff;
