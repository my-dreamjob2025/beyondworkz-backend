import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export async function sendEmailWithSES({ to, subject, text, html }) {
  const REGION = process.env.AWS_REGION;
  const FROM = process.env.SES_FROM_EMAIL;

  if (!REGION || !FROM) {
    throw new Error("SES not configured (missing AWS_REGION or SES_FROM_EMAIL)");
  }

  const client = new SESClient({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const messageId = `<${Date.now()}.${Math.random()
    .toString(36)
    .substr(2, 9)}@beyondworkz.com>`;

  const date = new Date();
  date.setHours(date.getHours() + 5 + 30);
  const dateStr = date.toUTCString();

  const params = {
    Destination: {
      ToAddresses: Array.isArray(to) ? to : [to],
    },
    Message: {
      Body: {
        Text: { Data: text || "" },
        ...(html ? { Html: { Data: html } } : {}),
      },
      Subject: { Data: `Beyond Workz: ${subject}` },
    },
    Source: `Beyond Workz <${FROM}>`,
    ReplyToAddresses: [`Beyond Workz <${FROM}>`],
    ReturnPath: FROM,
    Headers: [
      { Name: "From", Value: `Beyond Workz <${FROM}>` },
      { Name: "To", Value: Array.isArray(to) ? to.join(", ") : to },
      { Name: "Date", Value: dateStr },
      { Name: "Message-ID", Value: messageId },
      { Name: "X-Mailer", Value: "Beyond Workz SES Client v1.0" },
    ],
  };

  const cmd = new SendEmailCommand(params);
  return await client.send(cmd);
}
