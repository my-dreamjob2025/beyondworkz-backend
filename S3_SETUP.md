# S3 Bucket Setup (beyond-workz)

## Bucket Configuration

- **Bucket name:** `beyond-workz`
- **Region:** Asia Pacific (Mumbai) - `ap-south-1`

## Credentials

Use the same AWS credentials as jobportal-backend:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET=beyond-workz
S3_PUBLIC_PREFIX=https://beyond-workz.s3.ap-south-1.amazonaws.com
```

## Object Naming Convention

Files are stored with the following structure:

| Type   | Path Pattern                                      | Example                                      |
|--------|---------------------------------------------------|----------------------------------------------|
| Avatar | `employee/{userId}/avatar/{timestamp}_{random}_{filename}` | `employee/69b592c6.../avatar/1773516141660_abc123_logo.png` |
| Resume | `employee/{userId}/resumes/{timestamp}_{random}_{filename}` | `employee/69b592c6.../resumes/1773514984547_def456_Resume.pdf` |

- **timestamp:** Unix ms for uniqueness
- **random:** 6-char hex for collision avoidance
- **filename:** Slugified original name (alphanumeric, underscores, hyphens)

## Bucket Permissions

Ensure the IAM user (used by AWS_ACCESS_KEY_ID) has these permissions for the `beyond-workz` bucket:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject",
    "s3:DeleteObject"
  ],
  "Resource": "arn:aws:s3:::beyond-workz/*"
}
```

## Verification

After adding S3 vars to `.env` and restarting the server, you should see:

```
Server running on port 5001
S3 storage: enabled (bucket: beyond-workz)
```

New avatar and resume uploads will then be stored in S3 instead of local `uploads/`.
