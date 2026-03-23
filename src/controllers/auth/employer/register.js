import User from "../../../models/user.model.js";
import { sendOtpEmail } from "../../../config/ses.js";
import { sendResponse } from "../../../utils/response.js";
import { employerRegisterEmailTemplate } from "../../../templates/employer/employerRegisterTemplate.js";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const registerEmployer = async (req, res) => {
  try {
    const { email, agreeWhatsapp, agreeTerms } = req.body;

    if (!email) {
      return sendResponse(res, 400, false, { message: "Email is required." });
    }

    if (!agreeTerms) {
      return sendResponse(res, 400, false, {
        message: "You must agree to Terms & Conditions.",
      });
    }

    const normEmail = String(email).toLowerCase().trim();
    if (!EMAIL_REGEX.test(normEmail)) {
      return sendResponse(res, 400, false, { message: "Invalid email address." });
    }

    const existing = await User.findOne({ email: normEmail }).select("+role");

    if (existing) {
      if (existing.role === "employer") {
        return sendResponse(res, 409, false, {
          message: "An employer account with this email already exists. Please log in.",
        });
      }
      return sendResponse(res, 409, false, {
        message: "An account with this email already exists.",
      });
    }

    const user = await User.create({
      email: normEmail,
      role: "employer",
      isEmailVerified: false,
      whatsappConsent: !!agreeWhatsapp,
      termsConsent: !!agreeTerms,
    });

    const otp = await user.generateOTP();
    const html = employerRegisterEmailTemplate({ otp });

    await sendOtpEmail({
      to: normEmail,
      subject: "Verify Your Email - Beyond Workz Employer Registration",
      html,
      otp,
      label: "Employer registration",
    });

    return sendResponse(res, 200, true, {
      message: "Registration OTP sent to your email.",
    });
  } catch (err) {
    console.error("registerEmployer error:", err);
    const hint =
      process.env.NODE_ENV === "development"
        ? " Check server logs; if SES is misconfigured, OTP is printed when email send fails."
        : "";
    return sendResponse(res, 500, false, {
      message: `Registration failed. Please try again.${hint}`,
    });
  }
};
