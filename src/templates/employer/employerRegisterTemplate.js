import { otpBaseTemplate } from "../../utils/otpTemplate.js";

export function employerRegisterEmailTemplate({ otp, firstName = "" }) {
  const greeting = firstName
    ? `Hi ${firstName}, use the code below to verify your email and complete your Beyond Workz Employer registration.`
    : "Use the code below to verify your email and complete your Beyond Workz Employer registration.";

  return otpBaseTemplate({
    title: "Verify Your Email",
    subtitle: "Complete your employer registration",
    greeting,
    bodyHtml: "",
    otp,
    footerText: "© Beyond Workz Employer Portal. Never share your OTP with anyone.",
    panel: "Employer Portal",
  });
}
