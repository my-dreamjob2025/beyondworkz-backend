import User from "../../../models/user.model.js";
import { sendResponse } from "../../../utils/response.js";
import { signAccess, signRefresh } from "../../../utils/jwt.js";

const MAX_OTP_ATTEMPTS = 5;
const PANEL = "employee";

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

    const refreshToken = signRefresh({ id: user._id, role: user.role, panel: PANEL });

    const accessToken = signAccess({
      id: user._id,
      email: user.email,
      role: user.role,
      employeeType: user.employeeType,
      profileCompletion: user.profileCompletion || 0,
    });

    return sendResponse(res, 200, true, {
      accessToken,
      refreshToken,
      expiresIn: 900,
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
