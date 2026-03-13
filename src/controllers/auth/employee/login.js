import User from "../../../models/user.model.js";
import { sendEmailWithSES } from "../../../config/ses.js";
import { sendResponse } from "../../../utils/response.js";
import { loginOtpHtmlTemplate } from "../../../templates/loginOtpTemplate.js";

export const loginEmployee = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendResponse(res, 400, false, { message: "Email is required." });
    }

    const normEmail = String(email).toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normEmail)) {
      return sendResponse(res, 400, false, { message: "Invalid email address." });
    }

    const user = await User.findOne({ email: normEmail }).select(
      "+otpResendAfter +otpAttempts +firstName +role +employeeType"
    );

    if (!user) {
      return sendResponse(res, 404, false, {
        message: "No account found. Please register first.",
      });
    }

    if (user.role !== "employee") {
      return sendResponse(res, 403, false, {
        message: "This email is not associated with an employee account.",
      });
    }

    if (user.isBlocked) {
      return sendResponse(res, 403, false, {
        message: "Your account has been blocked. Please contact support.",
      });
    }

    if (user.otpResendAfter && new Date() < user.otpResendAfter) {
      const waitSec = Math.ceil((user.otpResendAfter - new Date()) / 1000);
      return sendResponse(res, 429, false, {
        message: `Please wait ${waitSec}s before requesting a new OTP.`,
        waitSeconds: waitSec,
      });
    }

    const otp = await user.generateOTP();
    const html = loginOtpHtmlTemplate({ otp, firstName: user.firstName || "" });

    await sendEmailWithSES({
      to: normEmail,
      subject: "Your Login OTP - Beyond Workz",
      html,
    });

    return sendResponse(res, 200, true, {
      message: "OTP sent to your email successfully.",
    });
  } catch (err) {
    console.error("loginEmployee error:", err);
    return sendResponse(res, 500, false, {
      message: "Failed to send OTP. Please try again.",
    });
  }
};
