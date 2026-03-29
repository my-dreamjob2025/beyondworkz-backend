import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireEmployee from "../middlewares/employee.middleware.js";
import { listPublicJobs, getPublicJob } from "../controllers/job/publicJobs.controller.js";
import { applyToJob } from "../controllers/job/applyToJob.controller.js";

const router = Router();

router.get("/", listPublicJobs);
router.post("/:jobId/apply", authMiddleware, requireEmployee, applyToJob);
router.get("/:jobId", getPublicJob);

export default router;
