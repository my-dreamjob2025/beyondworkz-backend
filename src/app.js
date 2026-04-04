import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

import authRoutes from "./routes/auth.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import employerRoutes from "./routes/employer.routes.js";
import jobRoutes from "./routes/job.routes.js";
import applicationRoutes from "./routes/application.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import supportRoutes from "./routes/support.routes.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import { getAllowedOrigins } from "./config/corsOrigins.js";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    optionsSuccessStatus: 204,
  }),
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "beyondworkz-backend" });
});

app.use("/uploads", express.static(UPLOADS_DIR));

/**
 * Rate limit auth in production by default. In dev (NODE_ENV !== production) it is skipped so login/OTP
 * testing does not hit 429. Override: AUTH_RATE_LIMIT_ENABLED=true in dev, or DISABLE_AUTH_RATE_LIMIT=true
 * in production (e.g. temporary debugging).
 */
const authRateLimitActive =
  process.env.DISABLE_AUTH_RATE_LIMIT !== "true" &&
  process.env.DISABLE_AUTH_RATE_LIMIT !== "1" &&
  (process.env.NODE_ENV === "production" ||
    process.env.AUTH_RATE_LIMIT_ENABLED === "true" ||
    process.env.AUTH_RATE_LIMIT_ENABLED === "1");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "200", 10),
  skip: () => !authRateLimitActive,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/admin", authLimiter, adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/support", supportRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorMiddleware);

export default app;
