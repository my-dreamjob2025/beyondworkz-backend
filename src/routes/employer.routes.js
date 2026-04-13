import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireEmployer from "../middlewares/employer.middleware.js";
import {
  getMe,
  updateEmployerUser,
  updateCompanyProfile,
  submitEmployerVerification,
} from "../controllers/employer/profile.controller.js";
import {
  presignEmployerCompanyDoc,
  confirmEmployerCompanyDoc,
  uploadEmployerCompanyDocDirect,
  getEmployerCompanyDocViewUrl,
} from "../controllers/employer/employerDocuments.controller.js";
import { employerCompanyDocUpload } from "../middlewares/upload.middleware.js";
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
  getEmployerApplicationById,
  patchApplicationStatus,
  patchApplicationInterview,
} from "../controllers/employer/jobApplications.controller.js";

const router = Router();

router.get("/me", authMiddleware, requireEmployer, getMe);
router.patch("/profile", authMiddleware, requireEmployer, updateEmployerUser);
router.patch("/company", authMiddleware, requireEmployer, updateCompanyProfile);
router.post("/company/submit-verification", authMiddleware, requireEmployer, submitEmployerVerification);

router.post("/company/documents/presign", authMiddleware, requireEmployer, presignEmployerCompanyDoc);
router.post("/company/documents/confirm", authMiddleware, requireEmployer, confirmEmployerCompanyDoc);
router.get("/company/documents/:docType/view-url", authMiddleware, requireEmployer, getEmployerCompanyDocViewUrl);
router.post(
  "/company/documents/:docType/upload",
  authMiddleware,
  requireEmployer,
  (req, res, next) => {
    employerCompanyDocUpload.single("document")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "Upload failed",
        });
      }
      next();
    });
  },
  uploadEmployerCompanyDocDirect
);

router.get("/jobs", authMiddleware, requireEmployer, listEmployerJobs);
router.post("/jobs", authMiddleware, requireEmployer, createEmployerJob);
router.get("/jobs/:jobId", authMiddleware, requireEmployer, getEmployerJob);
router.put("/jobs/:jobId", authMiddleware, requireEmployer, updateEmployerJob);
router.patch("/jobs/:jobId/status", authMiddleware, requireEmployer, patchEmployerJobStatus);

router.get("/applications/summary", authMiddleware, requireEmployer, getApplicationSummary);
router.get("/applications/recent", authMiddleware, requireEmployer, listRecentApplications);
router.get("/applications", authMiddleware, requireEmployer, listEmployerApplications);
router.get("/applications/:applicationId", authMiddleware, requireEmployer, getEmployerApplicationById);
router.patch(
  "/applications/:applicationId/status",
  authMiddleware,
  requireEmployer,
  patchApplicationStatus
);
router.patch(
  "/applications/:applicationId/interview",
  authMiddleware,
  requireEmployer,
  patchApplicationInterview
);

export default router;
