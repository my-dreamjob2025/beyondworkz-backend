import express from "express";
import {
  employeeSignup,
  employeeLogin,
  verifyEmployeeOTP,
} from "../controllers/employeeAuth.controller.js";

const router = express.Router();

router.post("/signup", employeeSignup);

router.post("/login", employeeLogin);

router.post("/verify-otp", verifyEmployeeOTP);

export default router;
