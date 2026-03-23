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

  const safeBodyHtml = bodyHtml || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${safeTitle} - Beyond Workz</title>
  <meta name="color-scheme" content="light only"/>
  <meta name="supported-color-schemes" content="light only"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    body, table, td, p, a, h1 { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
    .container { max-width: 560px; }
    .card { border-radius: 16px; }
    .content { padding: 32px; }
    .otp { font-size: 36px; letter-spacing: 10px; }
    .meta { font-size: 13px; }
    @media only screen and (max-width: 600px) {
      .outer { padding: 12px !important; }
      .card { border-radius: 12px !important; }
      .header { padding: 24px 18px !important; }
      .content { padding: 22px 18px !important; }
      .otp-wrap { padding: 16px 14px !important; }
      .otp { font-size: 30px !important; letter-spacing: 8px !important; }
      .meta { font-size: 12px !important; }
      .footer { padding: 14px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#eef2f7;">
    <tr>
      <td align="center" class="outer" style="padding:22px 14px;">
        <table role="presentation" class="container card" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #dbe3ef;box-shadow:0 16px 44px rgba(15,23,42,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" class="header" style="padding:30px 24px 24px;background:linear-gradient(130deg,#2563eb 0%,#1d4ed8 55%,#1e40af 100%);">
              <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Beyond Workz</div>
              ${panelBadge}
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content" style="padding:32px;">
              <h1 style="margin:0 0 6px;font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;">${safeTitle}</h1>
              ${safeSubtitle ? `<p style="margin:0 0 18px;font-size:14px;color:#475569;font-weight:500;">${safeSubtitle}</p>` : ""}
              <p style="margin:0 0 18px;font-size:15px;color:#334155;">${safeGreeting}</p>
              ${safeBodyHtml}
              <!-- OTP Box -->
              <div class="otp-wrap" style="background:linear-gradient(180deg,#f8fbff 0%,#f2f6fc 100%);border:1px solid #dce5f4;border-radius:12px;padding:18px 24px;text-align:center;margin:0 0 16px;">
                <span class="otp" style="font-size:36px;font-weight:700;color:#0f172a;letter-spacing:10px;font-variant-numeric:tabular-nums;display:inline-block;">${safeOtp}</span>
              </div>
              <p class="meta" style="margin:0;font-size:13px;color:#64748b;">
                Valid for <strong>${OTP_TTL_MINUTES} minutes</strong>. For your security, do not share this code.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="footer" style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">${safeFooter}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
