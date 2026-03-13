import User from "../../../models/user.model.js";
import { sendEmailWithSES } from "../../../config/ses.js";
import { sendResponse } from "../../../utils/response.js";
import { loginOtpHtmlTemplate } from "../../../templates/loginOtpTemplate.js";

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendResponse(res, 400, false, { message: "Email is required." });
    }

    const normEmail = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: normEmail }).select(
      "+otpHash +otpExpires +otpResendAfter +otpAttempts +role +employeeType +firstName"
    );

    if (!user) {
      return sendResponse(res, 404, false, { message: "User not found." });
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
      subject: "Your Verification Code (Resend) - Beyond Workz",
      html,
    });

    return sendResponse(res, 200, true, { message: "OTP resent successfully." });
  } catch (err) {
    console.error("resendOtp error:", err);
    return sendResponse(res, 500, false, {
      message: "Failed to resend OTP. Please try again later.",
    });
  }
};
