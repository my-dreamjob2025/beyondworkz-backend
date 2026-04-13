import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_BASE = path.join(__dirname, "..", "..", "uploads");

const MAX_BYTES = Number(process.env.RESUME_MAX_BYTES) || 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user?.id || "anonymous";
    const dir = path.join(UPLOADS_BASE, "employee", String(userId), "resumes");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    const safe = (file.originalname || "resume")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "")
      .slice(0, 100);
    cb(null, `${Date.now()}_${safe}`);
  },
});

export const resumeUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

const AVATAR_MAX_BYTES = Number(process.env.AVATAR_MAX_BYTES) || 10 * 1024 * 1024; // 10MB
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user?.id || "anonymous";
    const dir = path.join(UPLOADS_BASE, "employee", String(userId), "avatar");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const safe = (file.originalname || "avatar")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "")
      .slice(0, 80);
    cb(null, `${Date.now()}_${safe}`);
  },
});

export const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (AVATAR_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

const EMPLOYER_DOC_MAX_BYTES = Number(process.env.EMPLOYER_DOC_MAX_BYTES) || 10 * 1024 * 1024;
const EMPLOYER_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const employerCompanyDocStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user?.id || "anonymous";
    const dir = path.join(UPLOADS_BASE, "employer", String(userId), "company-docs");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = (file.originalname || "document")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "")
      .slice(0, 100);
    cb(null, `${Date.now()}_${safe || "document.pdf"}`);
  },
});

export const employerCompanyDocUpload = multer({
  storage: employerCompanyDocStorage,
  limits: { fileSize: EMPLOYER_DOC_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (EMPLOYER_DOC_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPEG, PNG, or WebP files are allowed"));
    }
  },
});
