import { otpBaseTemplate } from "../../utils/otpTemplate.js";

export function employerLoginEmailTemplate({ otp, firstName = "" }) {
  const greeting = firstName
    ? `Hi ${firstName}, use the code below to sign in to your Beyond Workz Employer account.`
    : "Use the code below to sign in to your Beyond Workz Employer account.";

  return otpBaseTemplate({
    title: "Your Login Code",
    subtitle: "",
    greeting,
    bodyHtml: "",
    otp,
    footerText: "© Beyond Workz Employer Portal. Never share your OTP with anyone.",
    panel: "Employer Portal",
  });
}
