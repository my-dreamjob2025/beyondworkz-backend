import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET, S3_PUBLIC_PREFIX, getPresignedViewUrl } from "../../config/s3.config.js";
import EmployerProfile from "../../models/employerProfile.model.js";
import User from "../../models/user.model.js";
import { sendResponse } from "../../utils/response.js";
import { employerProfileEditLocked } from "../../utils/employerVerification.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "uploads");
const API_BASE = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;

const DOC_PARAM_TO_FIELD = {
  coi: "certificateOfIncorporation",
  pan: "companyPanCard",
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_BYTES = Number(process.env.EMPLOYER_DOC_MAX_BYTES) || 10 * 1024 * 1024;
const PRESIGN_EXPIRES = Number(process.env.PRESIGN_EXPIRES_SECONDS) || 300;

function slugifyFileName(name) {
  return name
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "")
    .slice(0, 120);
}

async function getEmployerProfileForUser(userId) {
  const user = await User.findById(userId).select("companyProfile").lean();
  if (!user?.companyProfile) return null;
  return EmployerProfile.findById(user.companyProfile);
}

function keyPrefixForUser(userId) {
  return `employer/${userId}/company-docs/`;
}

async function removeStoredFile(doc) {
  if (!doc?.key) return;
  const isLocal =
    doc.url?.includes("/uploads/") || doc.url?.startsWith(API_BASE) || (!BUCKET && doc.key);
  if (!BUCKET || isLocal) {
    const filePath = path.join(UPLOADS_DIR, doc.key.replace(/^\//, ""));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn("removeStoredFile local:", e);
      }
    }
    return;
  }
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.key }));
  } catch (e) {
    console.warn("removeStoredFile s3:", e);
  }
}

export const presignEmployerCompanyDoc = async (req, res) => {
  try {
    if (!BUCKET) {
      return sendResponse(res, 503, false, {
        message: "S3 not configured. Use direct upload.",
        useDirectUpload: true,
      });
    }

    const userId = req.user.id;
    const { docType, fileName, contentType, fileSize } = req.body || {};
    const field = DOC_PARAM_TO_FIELD[docType];
    if (!field) {
      return sendResponse(res, 400, false, { message: "docType must be coi or pan." });
    }
    if (!fileName || !contentType) {
      return sendResponse(res, 400, false, { message: "fileName and contentType are required." });
    }
    if (!ALLOWED_TYPES.includes(contentType)) {
      return sendResponse(res, 400, false, {
        message: "Unsupported type. Use PDF, JPEG, PNG, or WebP.",
      });
    }
    if (fileSize && Number(fileSize) > MAX_BYTES) {
      return sendResponse(res, 400, false, {
        message: `File too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB`,
      });
    }

    const profile = await getEmployerProfileForUser(userId);
    if (!profile) {
      return sendResponse(res, 404, false, { message: "Company profile not found." });
    }
    if (employerProfileEditLocked(profile)) {
      return sendResponse(res, 403, false, {
        message: "Your profile is under admin review. You cannot change documents until the review is complete.",
      });
    }

    const safe = slugifyFileName(fileName);
    const rand = crypto.randomBytes(6).toString("hex");
    const key = `${keyPrefixForUser(userId)}${docType}/${Date.now()}_${rand}_${safe}`;

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
    console.error("presignEmployerCompanyDoc:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

export const confirmEmployerCompanyDoc = async (req, res) => {
  try {
    const userId = req.user.id;
    const { docType, key, url, size, contentType, fileName } = req.body || {};
    const field = DOC_PARAM_TO_FIELD[docType];
    if (!field || !key || !url) {
      return sendResponse(res, 400, false, {
        message: "docType, key, and url are required.",
      });
    }
    const prefix = keyPrefixForUser(userId);
    if (!key.startsWith(prefix)) {
      return sendResponse(res, 400, false, { message: "Invalid storage key." });
    }

    const profile = await getEmployerProfileForUser(userId);
    if (!profile) {
      return sendResponse(res, 404, false, { message: "Company profile not found." });
    }
    if (employerProfileEditLocked(profile)) {
      return sendResponse(res, 403, false, {
        message: "Your profile is under admin review. You cannot change documents until the review is complete.",
      });
    }

    const prev = profile.verificationDocuments?.[field];
    if (prev?.key && prev.key !== key) {
      await removeStoredFile(prev);
    }

    const docData = {
      key,
      url,
      fileName: fileName ? String(fileName).slice(0, 200) : undefined,
      size: size ? Number(size) : undefined,
      contentType: contentType || "application/pdf",
      uploadedAt: new Date(),
    };

    profile.verificationDocuments = profile.verificationDocuments || {};
    profile.verificationDocuments[field] = docData;
    profile.markModified("verificationDocuments");
    await profile.save();

    return sendResponse(res, 200, true, {
      message: "Document saved.",
      verificationDocuments: profile.verificationDocuments,
    });
  } catch (err) {
    console.error("confirmEmployerCompanyDoc:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

export const uploadEmployerCompanyDocDirect = async (req, res) => {
  try {
    const userId = req.user.id;
    const docType = req.params.docType;
    const field = DOC_PARAM_TO_FIELD[docType];
    if (!field) {
      return sendResponse(res, 400, false, { message: "Invalid document type. Use coi or pan." });
    }

    const file = req.file;
    if (!file) {
      return sendResponse(res, 400, false, { message: "No file uploaded." });
    }

    const profile = await getEmployerProfileForUser(userId);
    if (!profile) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return sendResponse(res, 404, false, { message: "Company profile not found." });
    }
    if (employerProfileEditLocked(profile)) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return sendResponse(res, 403, false, {
        message: "Your profile is under admin review. You cannot change documents until the review is complete.",
      });
    }

    const prev = profile.verificationDocuments?.[field];
    if (prev?.key) {
      await removeStoredFile(prev);
    }

    const key = path.relative(UPLOADS_DIR, file.path).replace(/\\/g, "/");
    const docUrl = `${API_BASE}/uploads/${key}`;

    const docData = {
      key,
      url: docUrl,
      fileName: file.originalname,
      size: file.size,
      contentType: file.mimetype,
      uploadedAt: new Date(),
    };

    profile.verificationDocuments = profile.verificationDocuments || {};
    profile.verificationDocuments[field] = docData;
    profile.markModified("verificationDocuments");
    await profile.save();

    return sendResponse(res, 200, true, {
      message: "Document uploaded.",
      verificationDocuments: profile.verificationDocuments,
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    console.error("uploadEmployerCompanyDocDirect:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};

/** Presigned GET for employer to view their own doc (S3 private bucket). */
export const getEmployerCompanyDocViewUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { docType } = req.params;
    const field = DOC_PARAM_TO_FIELD[docType];
    if (!field) {
      return sendResponse(res, 400, false, { message: "Invalid document type." });
    }

    const profile = await getEmployerProfileForUser(userId);
    const doc = profile?.verificationDocuments?.[field];
    if (!doc?.key) {
      return sendResponse(res, 404, false, { message: "Document not found." });
    }

    if (doc.url?.includes("/uploads/") || (!BUCKET && doc.key)) {
      return sendResponse(res, 200, true, { url: doc.url, expiresIn: 3600 });
    }

    const url = await getPresignedViewUrl(doc.key, 3600);
    if (!url) {
      return sendResponse(res, 500, false, { message: "Could not generate link." });
    }
    return sendResponse(res, 200, true, { url, expiresIn: 3600 });
  } catch (err) {
    console.error("getEmployerCompanyDocViewUrl:", err);
    return sendResponse(res, 500, false, { message: "Server error" });
  }
};
