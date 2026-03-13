export function employerRegisterEmailTemplate({ otp }) {
  const safeOtp = String(otp || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const TTL = 10;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Employer Registration OTP</title>
    <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  </head>
  <body style="margin:0;padding:20px 0;font-family:'Work Sans',sans-serif;background-color:#f4f4f4">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
      <tr>
        <td align="center" style="padding:24px;">
          <div style="font-size:24px;font-weight:700;color:#2563eb;">Beyond Workz</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Employer Portal</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <h3 style="color:#1e293b;font-size:18px;margin:0 0 4px;font-weight:400">COMPLETE YOUR REGISTRATION</h3>
          <h2 style="color:#1e293b;font-size:26px;margin:0 0 16px;font-weight:700">Verify Your Email</h2>
          <p style="color:#475569;font-size:14px;margin:0 0 20px;">Use the verification code below to complete your Beyond Workz Employer account registration.</p>
          <div style="background-color:#e5e5ea;padding:18px 24px;border-radius:8px;text-align:center;margin:0 0 16px;">
            <span style="color:#1e293b;font-size:32px;font-weight:700;letter-spacing:8px;">${safeOtp}</span>
          </div>
          <p style="color:#475569;font-size:14px;margin:0 0 8px;">This code expires in <strong>${TTL} minutes</strong>.</p>
          <p style="color:#475569;font-size:14px;margin:0;">Never share this code with anyone. Beyond Workz will never ask for your OTP.</p>
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
