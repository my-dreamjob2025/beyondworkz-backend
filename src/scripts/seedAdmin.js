/**
 * Create or promote a user to admin (role: admin) for the admin console OTP login.
 *
 * Usage:
 *   npm run seed:admin
 *   npm run seed:admin -- you@company.com
 *
 * Uses MONGO_URI from .env (same as the API server).
 */
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";

const emailArg = process.argv[2];
const email = (emailArg || process.env.ADMIN_SEED_EMAIL || "admin@beyondworkz.com").toLowerCase().trim();

async function run() {
  await connectDB();

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      role: "admin",
      firstName: "Admin",
      lastName: "User",
    });
    console.log(`Created admin user: ${email}`);
  } else {
    user.role = "admin";
    if (!user.firstName) user.firstName = "Admin";
    if (!user.lastName) user.lastName = "User";
    await user.save();
    console.log(`Updated existing user to admin: ${email}`);
  }
  console.log("Sign in at the admin app; OTP is emailed (or logged if EMAIL_MODE=console).");
  await mongoose.connection.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
