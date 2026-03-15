import { otpBaseTemplate } from "../utils/otpTemplate.js";

export function loginOtpHtmlTemplate({ otp, firstName = "" }) {
  const greeting = firstName
    ? `Hi ${firstName}, use the code below to sign in to your Beyond Workz account.`
    : "Use the code below to sign in to your Beyond Workz account.";

  return otpBaseTemplate({
    title: "Your Login Code",
    subtitle: "",
    greeting,
    bodyHtml: "",
    otp,
    footerText: "© Beyond Workz. If you didn't request this, you can safely ignore this email.",
    panel: "",
  });
}
