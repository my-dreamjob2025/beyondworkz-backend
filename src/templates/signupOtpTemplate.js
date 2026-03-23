import { otpBaseTemplate } from "../utils/otpTemplate.js";

export function signupOtpHtmlTemplate({ otp, firstName = "" }) {
  const greeting = firstName
    ? `Hi ${firstName}, you're one step away! Use the code below to verify your email and complete your Beyond Workz registration.`
    : "You're one step away! Use the code below to verify your email and complete your Beyond Workz registration.";

  return otpBaseTemplate({
    title: "Verify Your Email",
    subtitle: "Complete your registration",
    greeting,
    bodyHtml:
      '<p style="margin:0 0 16px;font-size:14px;color:#475569;">Enter this OTP in the app to finish setting up your employee account and unlock personalized job recommendations.</p>',
    otp,
    footerText: "© Beyond Workz. If you didn't sign up, you can safely ignore this email.",
    panel: "",
  });
}
