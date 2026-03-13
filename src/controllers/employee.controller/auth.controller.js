import crypto from "crypto";
import User from "../models/user.model.js";
import { generateOTP } from "../utils/otp.js";
import { sendEmailWithSES } from "../utils/sendEmailWithSES.js";
import { generateToken } from "../utils/jwt.js";

export const employeeSignup = async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    let user = await User.findOne({ email });

    const otp = generateOTP();

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const otpExpiry = Date.now() + 5 * 60 * 1000;

    if (!user) {
      user = await User.create({
        firstName,
        lastName,
        email,
        phone,
        role: "employee",
        otp: hashedOtp,
        otpExpiresAt: otpExpiry,
      });
    } else {
      user.otp = hashedOtp;
      user.otpExpiresAt = otpExpiry;
      await user.save();
    }

    await sendEmailWithSES({
      to: email,
      subject: "OTP Verification",
      text: `Your OTP is ${otp}`,
      html: `<h2>Your OTP is ${otp}</h2>`,
    });

    res.json({
      message: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyEmployeeOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email }).select("+otp +otpExpiresAt");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (hashedOtp !== user.otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    if (user.otpExpiresAt < Date.now()) {
      return res.status(400).json({
        message: "OTP expired",
      });
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.lastLoginAt = new Date();
    user.isVerified = true;

    await user.save();

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
