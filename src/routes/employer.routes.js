import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireEmployer from "../middlewares/employer.middleware.js";
import {
  getMe,
  updateEmployerUser,
  updateCompanyProfile,
} from "../controllers/employer/profile.controller.js";
import {
  listEmployerJobs,
  getEmployerJob,
  createEmployerJob,
  updateEmployerJob,
  patchEmployerJobStatus,
} from "../controllers/employer/jobPosting.controller.js";
import {
  getApplicationSummary,
  listRecentApplications,
  listEmployerApplications,
  patchApplicationStatus,
} from "../controllers/employer/jobApplications.controller.js";

const router = Router();

router.get("/me", authMiddleware, requireEmployer, getMe);
router.patch("/profile", authMiddleware, requireEmployer, updateEmployerUser);
router.patch("/company", authMiddleware, requireEmployer, updateCompanyProfile);

router.get("/jobs", authMiddleware, requireEmployer, listEmployerJobs);
router.post("/jobs", authMiddleware, requireEmployer, createEmployerJob);
router.get("/jobs/:jobId", authMiddleware, requireEmployer, getEmployerJob);
router.put("/jobs/:jobId", authMiddleware, requireEmployer, updateEmployerJob);
router.patch("/jobs/:jobId/status", authMiddleware, requireEmployer, patchEmployerJobStatus);

router.get("/applications/summary", authMiddleware, requireEmployer, getApplicationSummary);
router.get("/applications/recent", authMiddleware, requireEmployer, listRecentApplications);
router.get("/applications", authMiddleware, requireEmployer, listEmployerApplications);
router.patch(
  "/applications/:applicationId/status",
  authMiddleware,
  requireEmployer,
  patchApplicationStatus
);

export default router;
