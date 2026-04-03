import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireEmployee from "../middlewares/employee.middleware.js";
import { getProfile, updateProfile } from "../controllers/employee/profile.controller.js";
import { listMyApplications, getMyApplicationById } from "../controllers/employee/applications.controller.js";
import {
  getPresign,
  confirmResume,
  getDownloadUrl,
  deleteResume,
  uploadDirect,
} from "../controllers/employee/resume.controller.js";
import {
  getAvatarPresign,
  confirmAvatar,
  uploadAvatarDirect,
  updateAvatar,
  deleteAvatar,
} from "../controllers/employee/avatar.controller.js";
import { validateResumeBody, presignSchema } from "../middlewares/resumeValidate.middleware.js";
import { resumeUpload, avatarUpload } from "../middlewares/upload.middleware.js";

const router = Router();

router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

router.get("/applications", authMiddleware, requireEmployee, listMyApplications);
router.get("/applications/:applicationId", authMiddleware, requireEmployee, getMyApplicationById);

/* Resume upload - S3 presigned URL flow when S3_BUCKET is set */
router.post("/resume/presign", authMiddleware, validateResumeBody(presignSchema), getPresign);
router.post("/resume/confirm", authMiddleware, confirmResume);
/* Resume upload - direct to server when S3 not configured (local dev) */
router.post("/resume/upload", authMiddleware, resumeUpload.single("resume"), uploadDirect);
router.get("/resume/download", authMiddleware, getDownloadUrl);
router.delete("/resume", authMiddleware, deleteResume);

/* Avatar - S3 presigned URL flow */
router.post("/avatar/presign", authMiddleware, getAvatarPresign);
router.post("/avatar/confirm", authMiddleware, confirmAvatar);
/* Avatar - direct upload when S3 not configured */
router.post("/avatar/upload", authMiddleware, avatarUpload.single("avatar"), uploadAvatarDirect);
/* Avatar - update metadata (key, url) in User model */
router.patch("/avatar", authMiddleware, updateAvatar);
router.delete("/avatar", authMiddleware, deleteAvatar);

export default router;
