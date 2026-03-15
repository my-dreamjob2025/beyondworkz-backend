/**
 * Shared OTP email template utilities.
 * XSS-safe escaping and consistent base layout for all OTP emails.
 */

const OTP_TTL_MINUTES = 10;

/**
 * Escape string for safe use in HTML (prevents XSS).
 */
export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Base OTP email layout - responsive, accessible, email-client compatible.
 */
export function otpBaseTemplate({ title, subtitle, greeting, bodyHtml, otp, footerText, panel = "" }) {
  const safeOtp = escapeHtml(otp);
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeGreeting = escapeHtml(greeting);
  const safeFooter = escapeHtml(footerText);

  const panelBadge = panel
    ? `<div style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:4px;letter-spacing:0.5px;">${escapeHtml(panel)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${safeTitle} - Beyond Workz</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f1f5f9;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 24px 24px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);">
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Beyond Workz</div>
              ${panelBadge}
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:28px 24px 24px;">
              <h1 style="margin:0 0 4px;font-size:20px;font-weight:600;color:#0f172a;">${safeTitle}</h1>
              ${safeSubtitle ? `<p style="margin:0 0 16px;font-size:14px;color:#64748b;">${safeSubtitle}</p>` : ""}
              <p style="margin:0 0 20px;font-size:15px;color:#334155;">${safeGreeting}</p>
              ${bodyHtml}
              <!-- OTP Box -->
              <div style="background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;text-align:center;margin:0 0 20px;">
                <span style="font-size:28px;font-weight:700;color:#0f172a;letter-spacing:6px;font-variant-numeric:tabular-nums;">${safeOtp}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#64748b;">Valid for <strong>${OTP_TTL_MINUTES} minutes</strong>. Do not share this code.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">${safeFooter}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
