import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET, S3_PUBLIC_PREFIX, avatarWithPresignedUrl } from "../../config/s3.config.js";
import User from "../../models/user.model.js";
import { sendResponse } from "../../utils/response.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "uploads");
const API_BASE = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;

const USE_LOCAL_STORAGE = !BUCKET;
const MAX_BYTES = Number(process.env.AVATAR_MAX_BYTES || process.env.RESUME_MAX_BYTES || 10 * 1024 * 1024); // 10MB
const ALLOWED_TYPES = (process.env.ALLOWED_AVATAR_TYPES || "image/jpeg,image/png,image/webp")
  .split(",")
  .map((s) => s.trim());
const PRESIGN_EXPIRES = Number(process.env.PRESIGN_EXPIRES_SECONDS) || 300;

function slugifyFileName(name) {
  return name
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "")
    .slice(0, 120);
}

/** Get presigned URL for S3 upload */
export const getAvatarPresign = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileName, contentType, fileSize } = req.body;

    if (!fileName || !contentType) {
      return sendResponse(res, 400, false, { message: "fileName and contentType required" });
    }
    if (!ALLOWED_TYPES.includes(contentType)) {
      return sendResponse(res, 400, false, { message: "Unsupported image type. Use JPEG, PNG, or WebP." });
    }
    if (fileSize && Number(fileSize) > MAX_BYTES) {
      return sendResponse(res, 400, false, {
        message: `Image too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB`,
      });
    }

    if (!BUCKET) {
      return sendResponse(res, 503, false, {
        message: "S3 not configured. Use direct upload.",
        useDirectUpload: true,
      });
    }

    const safe = slugifyFileName(fileName);
    const rand = crypto.randomBytes(6).toString("hex");
    const key = `employee/${userId}/avatar/${Date.now()}_${rand}_${safe}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRES });
    const fileUrl = `${S3_PUBLIC_PREFIX}/${encodeURIComponent(key)}`;

    return sendResponse(res, 200, true, {
      uploadUrl,
      key,
      url: fileUrl,
      expiresIn: PRESIGN_EXPIRES,
    });
  } catch (err) {
    console.error("getAvatarPresign:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

/** Confirm avatar after S3 upload */
export const confirmAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { key, url, size, contentType } = req.body;

    if (!key || !url) {
      return sendResponse(res, 400, false, { message: "Missing required params: key, url" });
    }
    if (!key.startsWith(`employee/${userId}/avatar/`)) {
      return sendResponse(res, 400, false, { message: "Invalid key" });
    }

    const user = await User.findById(userId);
    if (!user) return sendResponse(res, 404, false, { message: "User not found" });

    if (user.avatar?.key && user.avatar.key !== key) {
      try {
        const del = new DeleteObjectCommand({ Bucket: BUCKET, Key: user.avatar.key });
        await s3Client.send(del);
      } catch (err) {
        console.warn("Failed to delete old avatar:", err);
      }
    }

    const avatarData = {
      key,
      url,
      size: size || undefined,
      contentType: contentType || "image/jpeg",
      uploadedAt: new Date(),
    };
    user.avatar = avatarData;
    await user.save();

    const dataForClient = await avatarWithPresignedUrl(avatarData);

    return sendResponse(res, 200, true, {
      message: "Avatar updated successfully",
      data: dataForClient || avatarData,
    });
  } catch (err) {
    console.error("confirmAvatar:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

/** Direct upload (when S3 not configured) */
export const uploadAvatarDirect = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    if (!file) {
      return sendResponse(res, 400, false, { message: "No file uploaded" });
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      fs.unlinkSync(file.path);
      return sendResponse(res, 400, false, {
        message: "Unsupported image type. Use JPEG, PNG, or WebP.",
      });
    }
    if (file.size > MAX_BYTES) {
      fs.unlinkSync(file.path);
      return sendResponse(res, 400, false, {
        message: `Image too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB`,
      });
    }

    const key = path.relative(UPLOADS_DIR, file.path).replace(/\\/g, "/");
    const url = `${API_BASE}/uploads/${key}`;

    const user = await User.findById(userId);
    if (!user) return sendResponse(res, 404, false, { message: "User not found" });

    if (user.avatar?.key) {
      const oldPath = path.join(UPLOADS_DIR, user.avatar.key);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.warn("Failed to delete old avatar:", e);
        }
      }
    }

    const avatarData = {
      key,
      url,
      size: file.size,
      contentType: file.mimetype,
      uploadedAt: new Date(),
    };

    await User.updateOne({ _id: userId }, { $set: { avatar: avatarData } });

    return sendResponse(res, 200, true, {
      message: "Avatar updated successfully",
      data: avatarData,
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("uploadAvatarDirect:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

/** Update avatar metadata (key, url) - for syncing after upload or profile save */
export const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { key, url, size, contentType } = req.body;

    if (!key || !url) {
      return sendResponse(res, 400, false, { message: "key and url are required" });
    }
    if (!key.startsWith(`employee/${userId}/avatar/`)) {
      return sendResponse(res, 400, false, { message: "Invalid avatar key" });
    }

    const avatarData = {
      key,
      url,
      size: size || undefined,
      contentType: contentType || "image/jpeg",
      uploadedAt: new Date(),
    };

    await User.findByIdAndUpdate(userId, { $set: { avatar: avatarData } });

    return sendResponse(res, 200, true, {
      message: "Avatar updated successfully",
      data: avatarData,
    });
  } catch (err) {
    console.error("updateAvatar:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

/** Delete avatar */
export const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || !user.avatar?.key) {
      return sendResponse(res, 404, false, { message: "Avatar not found" });
    }

    if (USE_LOCAL_STORAGE) {
      const filePath = path.join(UPLOADS_DIR, user.avatar.key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      const del = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: user.avatar.key,
      });
      await s3Client.send(del);
    }

    await User.updateOne({ _id: userId }, { $unset: { avatar: "" } });

    return sendResponse(res, 200, true, { message: "Avatar deleted" });
  } catch (err) {
    console.error("deleteAvatar:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};
