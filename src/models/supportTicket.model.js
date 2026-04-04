import mongoose from "mongoose";
import crypto from "crypto";

const messageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorRole: { type: String, enum: ["employee", "employer", "admin"], required: true },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const supportTicketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    panel: { type: String, enum: ["employee", "employer"], required: true, index: true },
    ticketNumber: { type: String, required: true, unique: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    category: {
      type: String,
      enum: ["account", "billing", "jobs_applications", "technical", "other"],
      default: "other",
    },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    status: {
      type: String,
      enum: ["open", "in_progress", "awaiting_user", "resolved", "closed"],
      default: "open",
      index: true,
    },
    messages: [messageSchema],
  },
  { timestamps: true }
);

supportTicketSchema.index({ user: 1, updatedAt: -1 });
supportTicketSchema.index({ status: 1, updatedAt: -1 });

export function generateTicketNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `BW-${y}${m}${day}-${rand}`;
}

export default mongoose.model("SupportTicket", supportTicketSchema);
