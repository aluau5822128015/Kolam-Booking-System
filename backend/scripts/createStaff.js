// Sets the ONE shared Front Office login (email + password given out by management).
// Usage: node scripts/createStaff.js <email>
// Any other staff account is disabled, so only this email can log in.
// Run it again with the same email to change the password.
// The password is typed at a hidden prompt; it is never stored in files or shell history.

const readline = require("node:readline");
const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Staff = require("../models/Staff");

const MIN_LENGTH = 10;

const askHidden = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });

(async () => {
  const username = (process.argv[2] || "").trim().toLowerCase();
  if (!username) {
    console.error("Usage: node scripts/createStaff.js <email>");
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
    console.error("Please use a valid email address.");
    process.exit(1);
  }

  const password = await askHidden("Password: ");
  if (password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }
  const again = await askHidden("Repeat password: ");
  if (again !== password) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await Staff.findOne({ username });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.active = true;
    await existing.save();
    console.log(`Updated password for staff "${username}".`);
  } else {
    await Staff.create({ username, passwordHash });
    console.log(`Created staff "${username}".`);
  }

  // One shared login only: disable every other staff account.
  const others = await Staff.updateMany({ username: { $ne: username } }, { active: false });
  if (others.modifiedCount > 0) {
    console.log(`Disabled ${others.modifiedCount} other staff account(s).`);
  }

  await mongoose.disconnect();
})().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
