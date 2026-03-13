import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { getProfile, updateProfile } from "../controllers/employee/profile.controller.js";

const router = Router();

router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

export default router;
