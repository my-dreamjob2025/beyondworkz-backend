export function loginOtpHtmlTemplate({ otp, firstName = "" }) {
  const safeOtp = String(otp || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeName = String(firstName || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const TTL = 10;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Your Login OTP</title>
    <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  </head>
  <body style="margin:0;padding:20px 0;font-family:'Work Sans',sans-serif;background-color:#f4f4f4">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
      <tr>
        <td align="center" style="padding:24px;">
          <div style="font-size:24px;font-weight:700;color:#2563eb;">Beyond Workz</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <h2 style="color:#1e293b;font-size:26px;margin:0 0 16px;font-weight:700">Your Login OTP</h2>
          <p style="color:#1e293b;font-size:16px;margin:0 0 8px;">Hi ${safeName || "there"},</p>
          <p style="color:#475569;font-size:14px;margin:0 0 20px;">Use the code below to log in to your Beyond Workz account.</p>
          <div style="background-color:#e5e5ea;padding:18px 24px;border-radius:8px;text-align:center;margin:0 0 16px;">
            <span style="color:#1e293b;font-size:32px;font-weight:700;letter-spacing:8px;">${safeOtp}</span>
          </div>
          <p style="color:#475569;font-size:14px;margin:0 0 8px;">This code expires in <strong>${TTL} minutes</strong>.</p>
          <p style="color:#475569;font-size:14px;margin:0;">Didn't request this code? Please contact support.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">© Beyond Workz. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
