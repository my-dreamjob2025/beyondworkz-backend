import crypto from "crypto";
import User from "../models/user.model.js";
import { generateOTP } from "../utils/otp.js";
import { sendEmailWithSES } from "../utils/sendEmailWithSES.js";

export async function sendOTP(email) {
  const otp = generateOTP();

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  const otpExpiry = Date.now() + 5 * 60 * 1000;

  let user = await User.findOne({ email });

  if (!user) {
    user = new User({ email });
  }

  user.otp = hashedOtp;
  user.otpExpiresAt = otpExpiry;

  await user.save();

  await sendEmailWithSES({
    to: email,
    subject: "OTP Verification",
    text: `Your OTP is ${otp}`,
    html: `<h2>Your OTP is ${otp}</h2>`,
  });

  return true;
}
