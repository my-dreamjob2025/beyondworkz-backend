import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET, S3_PUBLIC_PREFIX } from "../../config/s3.config.js";
import EmployeeProfile from "../../models/employeeProfile.model.js";
import { sendResponse } from "../../utils/response.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "uploads");
const API_BASE = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;

const USE_LOCAL_STORAGE = !BUCKET;
const MAX_BYTES = Number(process.env.RESUME_MAX_BYTES) || 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = (process.env.ALLOWED_RESUME_TYPES || "application/pdf")
  .split(",")
  .map((s) => s.trim());
const PRESIGN_EXPIRES = Number(process.env.PRESIGN_EXPIRES_SECONDS) || 300;

function slugifyFileName(name) {
  return name
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "")
    .slice(0, 120);
}

/** Check if S3 is configured (for frontend to choose upload flow) */
export const getUploadMode = async (req, res) => {
  return sendResponse(res, 200, true, {
    mode: BUCKET ? "s3" : "local",
  });
};

/** Direct upload - used when S3 is not configured (local development) */
export const uploadDirect = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    if (!file) {
      return sendResponse(res, 400, false, { message: "No file uploaded" });
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      fs.unlinkSync(file.path);
      return sendResponse(res, 400, false, {
        message: "Unsupported file type. Only PDF is allowed.",
      });
    }
    if (file.size > MAX_BYTES) {
      fs.unlinkSync(file.path);
      return sendResponse(res, 400, false, {
        message: `File too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB`,
      });
    }

    const key = path.relative(UPLOADS_DIR, file.path).replace(/\\/g, "/");
    const url = `${API_BASE}/uploads/${key}`;

    let profile = await EmployeeProfile.findOne({ user: userId });
    if (!profile) {
      profile = await EmployeeProfile.create({
        user: userId,
        employeeType: "white_collar",
      });
    }

    const wc = profile.whiteCollarDetails || {};
    const oldResume = wc.resume;
    if (oldResume?.key) {
      const oldPath = path.join(UPLOADS_DIR, oldResume.key);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.warn("Failed to delete old resume:", e);
        }
      }
    }

    const resumeData = {
      key,
      url,
      size: file.size,
      contentType: file.mimetype,
      uploadedAt: new Date(),
    };

    const wcUpdated = { ...wc, resume: resumeData };
    const updateOps = { $set: { whiteCollarDetails: wcUpdated } };
    if (profile.availability === "" || !["full-time", "part-time", "weekends"].includes(profile.availability)) {
      updateOps.$unset = { availability: "" };
    }
    await EmployeeProfile.updateOne({ _id: profile._id }, updateOps);

    return sendResponse(res, 200, true, {
      message: "Resume uploaded successfully",
      data: resumeData,
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("uploadDirect:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

export const getPresign = async (req, res) => {
  try {
    if (!BUCKET) {
      return sendResponse(res, 503, false, {
        message: "S3 not configured. Use direct upload.",
        useDirectUpload: true,
      });
    }
    const userId = req.user.id;
    const { fileName, contentType, fileSize } = req.body;

    if (!fileName || !contentType) {
      return sendResponse(res, 400, false, {
        message: "fileName and contentType required",
      });
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return sendResponse(res, 400, false, {
        message: "Unsupported file type. Only PDF is allowed.",
      });
    }
    if (fileSize && Number(fileSize) > MAX_BYTES) {
      return sendResponse(res, 400, false, {
        message: `File too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB`,
      });
    }

    const safe = slugifyFileName(fileName);
    const rand = crypto.randomBytes(6).toString("hex");
    const key = `employee/${userId}/resumes/${Date.now()}_${rand}_${safe}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGN_EXPIRES,
    });

    const fileUrl = `${S3_PUBLIC_PREFIX}/${encodeURIComponent(key)}`;

    return sendResponse(res, 200, true, {
      uploadUrl,
      key,
      url: fileUrl,
      expiresIn: PRESIGN_EXPIRES,
    });
  } catch (err) {
    console.error("presign error:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

export const confirmResume = async (req, res) => {
  try {
    const userId = req.user.id;
    const { key, url, size, contentType } = req.body;

    if (!key || !url) {
      return sendResponse(res, 400, false, {
        message: "Missing required params: key, url",
      });
    }

    if (!key.startsWith(`employee/${userId}/resumes/`)) {
      return sendResponse(res, 400, false, { message: "Invalid key" });
    }

    let profile = await EmployeeProfile.findOne({ user: userId });
    if (!profile) {
      profile = await EmployeeProfile.create({
        user: userId,
        employeeType: "white_collar",
      });
    }

    const wc = profile.whiteCollarDetails || {};
    const oldResume = wc.resume;

    if (oldResume?.key && oldResume.key !== key) {
      try {
        const del = new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: oldResume.key,
        });
        await s3Client.send(del);
      } catch (err) {
        console.warn("Failed to delete old resume:", err);
      }
    }

    const resumeData = {
      key,
      url,
      size: size || undefined,
      contentType: contentType || "application/pdf",
      uploadedAt: new Date(),
    };

    profile.whiteCollarDetails = {
      ...wc,
      resume: resumeData,
    };
    await profile.save();

    return sendResponse(res, 200, true, {
      message: "Resume uploaded successfully",
      data: resumeData,
    });
  } catch (err) {
    console.error("confirmResume:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

export const getDownloadUrl = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await EmployeeProfile.findOne({ user: userId });
    const resume = profile?.whiteCollarDetails?.resume;

    if (!profile || !resume?.key) {
      return sendResponse(res, 404, false, { message: "Resume not found" });
    }

    if (USE_LOCAL_STORAGE) {
      return sendResponse(res, 200, true, {
        url: resume.url,
        expiresIn: 3600,
      });
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: resume.key,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return sendResponse(res, 200, true, { url, expiresIn: 60 });
  } catch (err) {
    console.error("getDownloadUrl:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

/** Detect if resume was stored locally (uploads/) vs S3 */
function isLocalResume(resume) {
  if (!resume?.url) return false;
  return (
    resume.url.includes("/uploads/") ||
    resume.url.startsWith(API_BASE) ||
    (resume.url.startsWith("http") && !resume.url.includes("s3") && !resume.url.includes(BUCKET || ""))
  );
}

export const deleteResume = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await EmployeeProfile.findOne({ user: userId });
    const resume = profile?.whiteCollarDetails?.resume;

    if (!profile || !resume?.key) {
      return sendResponse(res, 404, false, { message: "Resume not found" });
    }

    const storedLocally = isLocalResume(resume);

    if (USE_LOCAL_STORAGE || storedLocally) {
      const filePath = path.join(UPLOADS_DIR, resume.key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else if (BUCKET) {
      try {
        const del = new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: resume.key,
        });
        await s3Client.send(del);
      } catch (err) {
        if (err.Code === "AccessDenied") {
          console.warn(
            "deleteResume: S3 AccessDenied - IAM user lacks s3:DeleteObject. Resume removed from profile; file may remain in S3."
          );
          // Still remove from DB so user can re-upload; fix IAM permissions to clean up S3
        } else {
          console.error("deleteResume:", err);
          return sendResponse(res, 500, false, {
            message: "Failed to delete resume from storage.",
          });
        }
      }
    }

    const wc = { ...profile.whiteCollarDetails };
    delete wc.resume;
    await EmployeeProfile.updateOne(
      { _id: profile._id },
      { $set: { whiteCollarDetails: wc } }
    );

    return sendResponse(res, 200, true, { message: "Resume deleted" });
  } catch (err) {
    console.error("deleteResume:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};
