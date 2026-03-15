import { Router } from "express";

import { registerEmployee } from "../controllers/auth/employee/register.js";
import { loginEmployee } from "../controllers/auth/employee/login.js";
import { verifyEmployeeOtp } from "../controllers/auth/employee/verifyOtp.js";
import { redirectToGoogle, handleGoogleCallback } from "../controllers/auth/employee/googleOAuth.js";

import { registerEmployer } from "../controllers/auth/employer/register.js";
import { loginEmployer } from "../controllers/auth/employer/login.js";
import { verifyEmployerOtp } from "../controllers/auth/employer/verifyOtp.js";

import { resendOtp } from "../controllers/auth/common/resendOtp.js";
import { refresh } from "../controllers/auth/common/refresh.js";
import { logout } from "../controllers/auth/common/logout.js";

const router = Router();

// Employee auth
router.post("/employee/register", registerEmployee);
router.post("/employee/login", loginEmployee);
router.post("/employee/verify-otp", verifyEmployeeOtp);
router.get("/google", redirectToGoogle);
router.get("/google/callback", handleGoogleCallback);

// Employer auth
router.post("/employer/register", registerEmployer);
router.post("/employer/login", loginEmployer);
router.post("/employer/verify-otp", verifyEmployerOtp);

// Common
router.post("/resend-otp", resendOtp);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
