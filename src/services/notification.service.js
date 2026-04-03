import mongoose from "mongoose";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { getIO } from "../socket.js";

function relativeTimeLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function formatNotificationDoc(doc) {
  const o = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!o) return {};
  return {
    id: String(o._id ?? o.id),
    type: o.type,
    title: o.title,
    message: o.message || "",
    read: !!o.read,
    unread: !o.read,
    createdAt: o.createdAt,
    timeLabel: relativeTimeLabel(o.createdAt),
    meta: o.meta && typeof o.meta === "object" ? o.meta : {},
  };
}

export async function createNotificationForUser({ userId, type, title, message, meta = {} }) {
  const uid = mongoose.Types.ObjectId.isValid(userId) ? userId : new mongoose.Types.ObjectId(userId);
  const doc = await Notification.create({
    user: uid,
    type,
    title,
    message,
    meta,
  });
  const payload = formatNotificationDoc(doc);
  const io = getIO();
  if (io) {
    io.to(`user:${String(uid)}`).emit("notification", { notification: payload });
  }
  return doc;
}

export async function notifyAdmins({ type, title, message, meta = {} }) {
  const admins = await User.find({ role: "admin" }).select("_id").lean();
  for (const a of admins) {
    await createNotificationForUser({
      userId: a._id,
      type,
      title,
      message,
      meta,
    });
  }
}
