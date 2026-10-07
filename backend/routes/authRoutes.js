const express = require("express");

const router = express.Router();

const { login, me } = require("../controllers/authController");
const requireStaff = require("../middleware/requireStaff");

router.post("/login", login);
router.get("/me", requireStaff, me);

module.exports = router;
