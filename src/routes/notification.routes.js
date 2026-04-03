import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/", listNotifications);
router.patch("/:id/read", markNotificationRead);
router.post("/read-all", markAllNotificationsRead);

export default router;
