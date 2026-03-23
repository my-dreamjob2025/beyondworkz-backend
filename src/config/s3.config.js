/**
 * S3 configuration for beyond-workz bucket
 *
 * Credentials (first match wins):
 *   AWS_S3_ACCESS_KEY_ID / AWS_S3_SECRET_ACCESS_KEY — recommended (separate from SES)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY — legacy fallback
 *
 * Bucket structure (naming convention):
 * - employee/{userId}/avatar/{timestamp}_{random}_{filename}  - Profile pictures
 * - employee/{userId}/resumes/{timestamp}_{random}_{filename} - Resume PDFs
 * - employer/{employerId}/...  - Future: employer logos, documents, etc.
 */

import { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.AWS_REGION || "ap-south-1";
const BUCKET = process.env.S3_BUCKET;
const S3_PUBLIC_PREFIX =
  process.env.S3_PUBLIC_PREFIX ||
  (BUCKET ? `https://${BUCKET}.s3.${REGION}.amazonaws.com` : "");

const s3AccessKeyId =
  process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const s3SecretAccessKey =
  process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

const s3Config = {
  region: REGION,
  ...(s3AccessKeyId &&
    s3SecretAccessKey && {
      credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
    }),
};

const s3Client = new S3Client(s3Config);

/** Generate presigned URL for viewing an S3 object (avatar, resume, etc.) - use when bucket is private */
async function getPresignedViewUrl(key, expiresIn = 3600) {
  if (!BUCKET || !key) return null;
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch {
    return null;
  }
}

/** Return avatar with presigned url if stored in S3 (bucket is private) */
async function avatarWithPresignedUrl(avatar) {
  if (!avatar?.key) return avatar;
  if (!BUCKET) return avatar;
  const presignedUrl = await getPresignedViewUrl(avatar.key);
  if (presignedUrl) {
    return { ...avatar, url: presignedUrl };
  }
  return avatar;
}

export { s3Client, REGION, BUCKET, S3_PUBLIC_PREFIX, getPresignedViewUrl, avatarWithPresignedUrl };
