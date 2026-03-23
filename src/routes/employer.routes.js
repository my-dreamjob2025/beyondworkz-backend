import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireEmployer from "../middlewares/employer.middleware.js";
import {
  getMe,
  updateEmployerUser,
  updateCompanyProfile,
} from "../controllers/employer/profile.controller.js";

const router = Router();

router.get("/me", authMiddleware, requireEmployer, getMe);
router.patch("/profile", authMiddleware, requireEmployer, updateEmployerUser);
router.patch("/company", authMiddleware, requireEmployer, updateCompanyProfile);

export default router;
