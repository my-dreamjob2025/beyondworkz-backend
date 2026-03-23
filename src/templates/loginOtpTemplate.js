import { otpBaseTemplate } from "../utils/otpTemplate.js";

export function loginOtpHtmlTemplate({ otp, firstName = "" }) {
  const greeting = firstName
    ? `Hi ${firstName}, use the code below to sign in to your Beyond Workz account.`
    : "Use the code below to sign in to your Beyond Workz account.";

  return otpBaseTemplate({
    title: "Your Login Code",
    subtitle: "",
    greeting,
    bodyHtml:
      '<p style="margin:0 0 16px;font-size:14px;color:#475569;">Use this one-time code to securely sign in to your employee account.</p>',
    otp,
    footerText: "© Beyond Workz. If you didn't request this, you can safely ignore this email.",
    panel: "",
  });
}
