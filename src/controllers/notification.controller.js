import mongoose from "mongoose";
import Notification from "../models/notification.model.js";
import { sendResponse } from "../utils/response.js";
import { formatNotificationDoc } from "../services/notification.service.js";

export const listNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const [rows, unreadCount] = await Promise.all([
      Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ user: userId, read: false }),
    ]);

    const notifications = rows.map((row) => formatNotificationDoc(row));

    return sendResponse(res, 200, true, { notifications, unreadCount });
  } catch (err) {
    console.error("listNotifications error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load notifications." });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, { message: "Invalid notification id." });
    }

    const updated = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { read: true },
      { new: true }
    ).lean();

    if (!updated) {
      return sendResponse(res, 404, false, { message: "Notification not found." });
    }

    return sendResponse(res, 200, true, { notification: formatNotificationDoc(updated) });
  } catch (err) {
    console.error("markNotificationRead error:", err);
    return sendResponse(res, 500, false, { message: "Failed to update notification." });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await Notification.updateMany({ user: userId, read: false }, { read: true });

    return sendResponse(res, 200, true, { modifiedCount: result.modifiedCount ?? 0 });
  } catch (err) {
    console.error("markAllNotificationsRead error:", err);
    return sendResponse(res, 500, false, { message: "Failed to mark notifications as read." });
  }
};
