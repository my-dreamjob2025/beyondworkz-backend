import User from "../../../models/user.model.js";
import { sendOtpEmail } from "../../../config/ses.js";
import { sendResponse } from "../../../utils/response.js";
import { employerLoginEmailTemplate } from "../../../templates/employer/employerLoginTemplate.js";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const loginEmployer = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendResponse(res, 400, false, { message: "Email is required." });
    }

    const normEmail = String(email).toLowerCase().trim();
    if (!EMAIL_REGEX.test(normEmail)) {
      return sendResponse(res, 400, false, { message: "Invalid email address." });
    }

    const user = await User.findOne({ email: normEmail }).select(
      "+otpResendAfter +role +firstName +otpAttempts"
    );

    if (!user) {
      return sendResponse(res, 404, false, {
        message: "Employer account not found. Please register.",
      });
    }

    if (user.role !== "employer") {
      return sendResponse(res, 403, false, {
        message: "This email is not associated with an employer account.",
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
    const html = employerLoginEmailTemplate({ otp, firstName: user.firstName || "" });

    await sendOtpEmail({
      to: normEmail,
      subject: "Your Employer Login OTP - Beyond Workz",
      html,
      otp,
      label: "Employer login",
    });

    return sendResponse(res, 200, true, {
      message: "Login OTP sent to your email.",
    });
  } catch (err) {
    console.error("loginEmployer error:", err);
    return sendResponse(res, 500, false, { message: "Failed to send OTP." });
  }
};
