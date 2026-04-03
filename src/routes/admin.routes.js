import { Router } from "express";
import { loginAdmin } from "../controllers/admin/auth/loginAdmin.js";
import { verifyAdminOtp } from "../controllers/admin/auth/verifyAdminOtp.js";
import { requireAdmin } from "../middlewares/adminAuth.middleware.js";
import { adminMe } from "../controllers/admin/me.controller.js";
import { listEmployers, getEmployerById } from "../controllers/admin/employers.controller.js";
import { listJobSeekers, getJobSeekerById } from "../controllers/admin/jobSeekers.controller.js";
import { getDashboardStats } from "../controllers/admin/dashboard.controller.js";
import { listApplications, getApplicationById } from "../controllers/admin/applications.controller.js";

const router = Router();

router.post("/auth/login", loginAdmin);
router.post("/auth/verify-otp", verifyAdminOtp);

router.get("/me", requireAdmin, adminMe);
router.get("/dashboard-stats", requireAdmin, getDashboardStats);
router.get("/employers", requireAdmin, listEmployers);
router.get("/employers/:id", requireAdmin, getEmployerById);
router.get("/job-seekers", requireAdmin, listJobSeekers);
router.get("/job-seekers/:id", requireAdmin, getJobSeekerById);
router.get("/applications", requireAdmin, listApplications);
router.get("/applications/:id", requireAdmin, getApplicationById);

export default router;
