import { otpBaseTemplate } from "../../utils/otpTemplate.js";

export function adminLoginEmailTemplate({ otp, firstName = "" }) {
  const greeting = firstName
    ? `Hi ${firstName}, use the code below to sign in to the Beyond Workz Admin console.`
    : "Use the code below to sign in to the Beyond Workz Admin console.";

  return otpBaseTemplate({
    title: "Admin login code",
    subtitle: "",
    greeting,
    bodyHtml: "",
    otp,
    footerText: "© Beyond Workz. Never share this code with anyone.",
    panel: "Admin Console",
  });
}
