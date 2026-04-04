import mongoose from "mongoose";
import SupportTicket from "../../models/supportTicket.model.js";
import { sendResponse } from "../../utils/response.js";
import { createNotificationForUser } from "../../services/notification.service.js";

const STATUSES = ["open", "in_progress", "awaiting_user", "resolved", "closed"];

function formatMessage(m) {
  return {
    id: String(m._id),
    authorRole: m.authorRole,
    body: m.body,
    createdAt: m.createdAt,
  };
}

function formatTicketFull(ticket) {
  const o = ticket.toObject ? ticket.toObject() : ticket;
  const u = o.user;
  const userSummary = u && typeof u === "object" && u.email
    ? {
        id: String(u._id),
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
      }
    : null;

  return {
    id: String(o._id),
    ticketNumber: o.ticketNumber,
    subject: o.subject,
    category: o.category,
    description: o.description,
    status: o.status,
    panel: o.panel,
    user: userSummary,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    messages: (o.messages || []).map(formatMessage),
  };
}

export const listTickets = async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status).trim() : "";
    const panel = req.query.panel ? String(req.query.panel).trim() : "";
    const q = req.query.q ? String(req.query.q).trim() : "";
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

    const filter = {};
    if (status && STATUSES.includes(status)) filter.status = status;
    if (panel === "employee" || panel === "employer") filter.panel = panel;
    if (q) {
      filter.$or = [
        { ticketNumber: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { subject: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      ];
    }

    const [rows, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "email firstName lastName role")
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);

    const tickets = rows.map((row) => ({
      id: String(row._id),
      ticketNumber: row.ticketNumber,
      subject: row.subject,
      category: row.category,
      status: row.status,
      panel: row.panel,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: row.user
        ? {
            id: String(row.user._id),
            email: row.user.email,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            role: row.user.role,
          }
        : null,
      replyCount: row.messages?.length || 0,
    }));

    return sendResponse(res, 200, true, {
      tickets,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("admin listTickets error:", err);
    return sendResponse(res, 500, false, { message: "Could not load tickets." });
  }
};

export const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return sendResponse(res, 400, false, { message: "Invalid ticket id." });
    }

    const doc = await SupportTicket.findById(ticketId).populate("user", "email firstName lastName role phone");
    if (!doc) {
      return sendResponse(res, 404, false, { message: "Ticket not found." });
    }

    return sendResponse(res, 200, true, { ticket: formatTicketFull(doc) });
  } catch (err) {
    console.error("admin getTicket error:", err);
    return sendResponse(res, 500, false, { message: "Could not load ticket." });
  }
};

export const patchTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return sendResponse(res, 400, false, { message: "Invalid ticket id." });
    }

    const { status } = req.body || {};
    if (!status || !STATUSES.includes(status)) {
      return sendResponse(res, 400, false, { message: "Valid status is required." });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return sendResponse(res, 404, false, { message: "Ticket not found." });
    }

    ticket.status = status;
    await ticket.save();
    await ticket.populate("user", "email firstName lastName role");

    return sendResponse(res, 200, true, { ticket: formatTicketFull(ticket) });
  } catch (err) {
    console.error("admin patchTicket error:", err);
    return sendResponse(res, 500, false, { message: "Could not update ticket." });
  }
};

export const addReply = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const body = String(req.body?.body || "").trim();

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return sendResponse(res, 400, false, { message: "Invalid ticket id." });
    }
    if (!body || body.length > 8000) {
      return sendResponse(res, 400, false, { message: "Message is required (max 8000 characters)." });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return sendResponse(res, 404, false, { message: "Ticket not found." });
    }

    ticket.messages.push({
      author: req.user.id,
      authorRole: "admin",
      body,
    });
    if (ticket.status === "open") ticket.status = "in_progress";
    await ticket.save();
    await ticket.populate("user", "email firstName lastName role");

    try {
      await createNotificationForUser({
        userId: ticket.user,
        type: "support_reply",
        title: "Support replied to your ticket",
        message: `Ticket ${ticket.ticketNumber}: you have a new message from our team.`,
        meta: { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber },
      });
    } catch (e) {
      console.error("admin addReply notify:", e);
    }

    return sendResponse(res, 200, true, { ticket: formatTicketFull(ticket) });
  } catch (err) {
    console.error("admin addReply error:", err);
    return sendResponse(res, 500, false, { message: "Could not send reply." });
  }
};
