import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const UTF8 = "UTF-8";

/**
 * Send via Amazon SES (SendEmail API). Identity (Source / From domain) must be verified in SES.
 * Sandbox accounts: recipient addresses must also be verified.
 */
export async function sendEmailWithSES({ to, subject, text, html }) {
  const REGION = process.env.AWS_REGION?.trim();
  const FROM = process.env.SES_FROM_EMAIL?.trim();

  if (!REGION || !FROM) {
    throw new Error("SES not configured (missing AWS_REGION or SES_FROM_EMAIL)");
  }

  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  const clientConfig = { region: REGION };
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = { accessKeyId, secretAccessKey };
  }

  const client = new SESClient(clientConfig);

  const toAddresses = Array.isArray(to) ? to : [to];

  // SendEmail does NOT support arbitrary Headers — use SendRawEmail for that.
  // ReplyToAddresses must be bare email addresses (not "Name <email>").
  const params = {
    Destination: { ToAddresses: toAddresses },
    Message: {
      Subject: { Data: `Beyond Workz: ${subject}`, Charset: UTF8 },
      Body: {
        ...(text ? { Text: { Data: text, Charset: UTF8 } } : {}),
        ...(html ? { Html: { Data: html, Charset: UTF8 } } : {}),
      },
    },
    // SendEmail expects the SES-verified identity as the Source.
    // Use the raw email address (no display name), which avoids identity parsing issues.
    Source: FROM,
    ReplyToAddresses: [FROM],
    ReturnPath: FROM,
  };

  const out = await client.send(new SendEmailCommand(params));
  if (process.env.NODE_ENV !== "production") {
    console.info(`[SES] Sent OK MessageId=${out.MessageId} to=${toAddresses.join(", ")}`);
  }
  return out;
}

function isDevOtpFallback() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test" ||
    process.env.ALLOW_DEV_OTP_LOG === "true"
  );
}

/**
 * Sends an OTP email via SES.
 * - EMAIL_MODE=console: log OTP only (no AWS).
 * - On SES failure in dev/test: log OTP and succeed (see ALLOW_DEV_OTP_LOG for non-development local runs).
 */
export async function sendOtpEmail({ to, subject, html, otp, label = "OTP email" }) {
  if (process.env.EMAIL_MODE === "console") {
    console.info(`\n[EMAIL_MODE=console] ${label}\n  To: ${to}\n  OTP: ${otp}\n`);
    return;
  }

  const maxAttempts = Number(process.env.SES_SEND_RETRY_ATTEMPTS || 3);
  const baseDelayMs = Number(process.env.SES_SEND_RETRY_BASE_DELAY_MS || 700);

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendEmailWithSES({ to, subject, html });
      return; // success
    } catch (err) {
      lastErr = err;
      const code = err?.name || err?.Code || err?.code || "Error";
      const msg = err?.message || String(err);

      const shouldRetry =
        (err?.code === "ENOTFOUND" || err?.code === "EAI_AGAIN") &&
        attempt < maxAttempts;

      console.error(`[SES] ${label} failed [${code}] (attempt ${attempt}/${maxAttempts}):`, msg);
      if (err?.$metadata) {
        console.error(
          "[SES] requestId:",
          err.$metadata.requestId,
          "httpStatus:",
          err.$metadata.httpStatusCode
        );
      }

      // Common: sandbox / verification — verify recipient in SES; or From identity not verified
      if (code === "MessageRejected" || msg.includes("Email address is not verified")) {
        console.error(
          "[SES] Hint: In SES sandbox, verify the sender/recipient identities in SES console, or exit sandbox / use a verified test address."
        );
      }

      if (shouldRetry) {
        const delay = baseDelayMs * attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (isDevOtpFallback() && otp != null) {
        console.info(
          `\n[DEV] Email not delivered; use this OTP:\n  ${label}\n  To: ${to}\n  OTP: ${otp}\n`
        );
        return;
      }
      throw err;
    }
  }

  // Should be unreachable, but keeps lint happy.
  throw lastErr;
}
