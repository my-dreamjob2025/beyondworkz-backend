import User from "../../../models/user.model.js";
import { sendOtpEmail } from "../../../config/ses.js";
import { sendResponse } from "../../../utils/response.js";
import { signupOtpHtmlTemplate } from "../../../templates/signupOtpTemplate.js";

export const registerEmployee = async (req, res) => {
  try {
    const {
      firstName,
      lastName = "",
      email,
      phone,
      city,
      workStatus,
      employeeType = "whitecollar",
      years = "00",
      months = "00",
    } = req.body;

    if (!firstName || !email) {
      return sendResponse(res, 400, false, {
        message: "First name and email are required.",
      });
    }

    const normEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normEmail)) {
      return sendResponse(res, 400, false, { message: "Invalid email address." });
    }

    if (!["whitecollar", "bluecollar"].includes(employeeType)) {
      return sendResponse(res, 400, false, {
        message: "Employee type must be 'whitecollar' or 'bluecollar'.",
      });
    }

    const alreadyVerified = await User.findOne({
      email: normEmail,
      isEmailVerified: true,
    });
    if (alreadyVerified) {
      return sendResponse(res, 409, false, {
        message: "This email is already registered. Please log in.",
      });
    }

    let user = await User.findOne({ email: normEmail });
    if (!user) {
      user = new User({
        email: normEmail,
        role: "employee",
        employeeType,
      });
    }

    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
    if (phone) user.phone = phone.trim();
    if (city) user.city = city.trim();
    if (workStatus) user.workStatus = workStatus;
    if (workStatus === "Experienced") {
      user.years = String(years).padStart(2, "0");
      user.months = String(months).padStart(2, "0");
    }

    await user.save();

    const otp = await user.generateOTP();

    const html = signupOtpHtmlTemplate({ otp, firstName: user.firstName });
    await sendOtpEmail({
      to: normEmail,
      subject: "Verify Your Email - Beyond Workz Registration",
      html,
      otp,
      label: "Employee registration",
    });

    return sendResponse(res, 200, true, {
      message: "OTP sent to your email. Please verify to complete registration.",
      email: normEmail,
    });
  } catch (err) {
    console.error("registerEmployee error:", err);
    return sendResponse(res, 500, false, {
      message: "Registration failed. Please try again.",
    });
  }
};
