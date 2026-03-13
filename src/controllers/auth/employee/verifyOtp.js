import User from "../../../models/user.model.js";
import Session from "../../../models/session.model.js";
import { sendResponse } from "../../../utils/response.js";
import { signAccess, signRefresh } from "../../../utils/jwt.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const MAX_OTP_ATTEMPTS = 5;
const PANEL = "employee";
const RT = "rt_employee";
const SID = "sid_employee";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const verifyEmployeeOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendResponse(res, 400, false, {
        message: "Email and OTP are required.",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+otpHash +otpExpires +otpAttempts +role +employeeType +profileCompletion");

    if (!user || user.role !== "employee") {
      return sendResponse(res, 403, false, { message: "Invalid account." });
    }

    if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      return sendResponse(res, 429, false, {
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    const valid = await user.verifyOTP(otp);
    if (!valid) {
      return sendResponse(res, 400, false, {
        message: "Invalid or expired OTP. Please try again.",
      });
    }

    const sessionId = crypto.randomUUID();
    const refreshToken = signRefresh({ id: user._id, sessionId });

    await Session.create({
      user: user._id,
      sessionId,
      refreshTokenHash: await bcrypt.hash(refreshToken, 10),
      panel: PANEL,
      userAgent: req.headers["user-agent"] || "",
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    const accessToken = signAccess({
      id: user._id,
      email: user.email,
      role: user.role,
      employeeType: user.employeeType,
      profileCompletion: user.profileCompletion || 0,
    });

    const isProd = process.env.NODE_ENV === "production";

    res.cookie(RT, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: REFRESH_TTL_MS,
    });

    res.cookie(SID, sessionId, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: REFRESH_TTL_MS,
    });

    return sendResponse(res, 200, true, {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        employeeType: user.employeeType,
        profileCompletion: user.profileCompletion || 0,
      },
    });
  } catch (err) {
    console.error("verifyEmployeeOtp error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};
