import mongoose from "mongoose";
import SupportTicket, { generateTicketNumber } from "../../models/supportTicket.model.js";
import { sendResponse } from "../../utils/response.js";
import { notifyAdmins } from "../../services/notification.service.js";
import User from "../../models/user.model.js";

const CATEGORIES = ["account", "billing", "jobs_applications", "technical", "other"];

function panelFromRole(role) {
  if (role === "employee") return "employee";
  if (role === "employer") return "employer";
  return null;
}

function formatMessage(m) {
  return {
    id: String(m._id),
    authorRole: m.authorRole,
    body: m.body,
    createdAt: m.createdAt,
  };
}

function formatTicket(ticket, { includeDescription = true } = {}) {
  const o = ticket.toObject ? ticket.toObject() : ticket;
  const msgs = Array.isArray(o.messages) ? o.messages : [];
  return {
    id: String(o._id),
    ticketNumber: o.ticketNumber,
    subject: o.subject,
    category: o.category,
    ...(includeDescription ? { description: o.description } : {}),
    status: o.status,
    panel: o.panel,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    messages: msgs.map(formatMessage),
  };
}

export const listTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const panel = panelFromRole(req.user.role);
    const rows = await SupportTicket.find({ user: userId, panel })
      .sort({ updatedAt: -1 })
      .select("ticketNumber subject category status panel createdAt updatedAt messages")
      .lean();

    const tickets = rows.map((row) => {
      const last =
        row.messages?.length > 0 ? row.messages[row.messages.length - 1].createdAt : row.updatedAt;
      return {
        id: String(row._id),
        ticketNumber: row.ticketNumber,
        subject: row.subject,
        category: row.category,
        status: row.status,
        panel: row.panel,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        replyCount: row.messages?.length || 0,
        lastActivityAt: last,
      };
    });

    return sendResponse(res, 200, true, { tickets });
  } catch (err) {
    console.error("listTickets error:", err);
    return sendResponse(res, 500, false, { message: "Could not load tickets." });
  }
};

export const createTicket = async (req, res) => {
  try {
    const panel = panelFromRole(req.user.role);
    if (!panel) {
      return sendResponse(res, 403, false, { message: "Invalid role." });
    }

    const subject = String(req.body?.subject || "").trim();
    const description = String(req.body?.description || "").trim();
    let category = String(req.body?.category || "other").trim();

    if (!subject || subject.length > 300) {
      return sendResponse(res, 400, false, { message: "Subject is required (max 300 characters)." });
    }
    if (!description || description.length > 8000) {
      return sendResponse(res, 400, false, { message: "Description is required (max 8000 characters)." });
    }
    if (!CATEGORIES.includes(category)) category = "other";

    let ticketNumber = generateTicketNumber();
    for (let i = 0; i < 5; i += 1) {
      try {
        const doc = await SupportTicket.create({
          user: req.user.id,
          panel,
          ticketNumber,
          subject,
          category,
          description,
          status: "open",
          messages: [],
        });

        const u = await User.findById(req.user.id).select("email firstName lastName").lean();
        const who = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() || u?.email || "User";

        try {
          await notifyAdmins({
            type: "support_new_ticket",
            title: "New support ticket",
            message: `${ticketNumber} — ${subject} (${panel}, ${who})`,
            meta: { ticketId: String(doc._id), ticketNumber, panel },
          });
        } catch (e) {
          console.error("createTicket notifyAdmins:", e);
        }

        return sendResponse(res, 201, true, { ticket: formatTicket(doc) });
      } catch (e) {
        if (e?.code === 11000) {
          ticketNumber = generateTicketNumber();
        } else {
          throw e;
        }
      }
    }

    return sendResponse(res, 500, false, { message: "Could not create ticket. Try again." });
  } catch (err) {
    console.error("createTicket error:", err);
    return sendResponse(res, 500, false, { message: "Could not create ticket." });
  }
};

export const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const panel = panelFromRole(req.user.role);
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return sendResponse(res, 400, false, { message: "Invalid ticket id." });
    }

    const doc = await SupportTicket.findOne({
      _id: ticketId,
      user: req.user.id,
      panel,
    });

    if (!doc) {
      return sendResponse(res, 404, false, { message: "Ticket not found." });
    }

    return sendResponse(res, 200, true, { ticket: formatTicket(doc) });
  } catch (err) {
    console.error("getTicket error:", err);
    return sendResponse(res, 500, false, { message: "Could not load ticket." });
  }
};

export const addReply = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const panel = panelFromRole(req.user.role);
    const body = String(req.body?.body || "").trim();

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return sendResponse(res, 400, false, { message: "Invalid ticket id." });
    }
    if (!body || body.length > 8000) {
      return sendResponse(res, 400, false, { message: "Message is required (max 8000 characters)." });
    }

    const ticket = await SupportTicket.findOne({
      _id: ticketId,
      user: req.user.id,
      panel,
    });

    if (!ticket) {
      return sendResponse(res, 404, false, { message: "Ticket not found." });
    }

    if (ticket.status === "closed") {
      return sendResponse(res, 400, false, { message: "This ticket is closed. Open a new ticket if you still need help." });
    }

    ticket.messages.push({
      author: req.user.id,
      authorRole: panel,
      body,
    });
    if (ticket.status === "resolved" || ticket.status === "awaiting_user") {
      ticket.status = "open";
    }
    await ticket.save();

    try {
      await notifyAdmins({
        type: "support_ticket_reply",
        title: "Customer replied on ticket",
        message: `${ticket.ticketNumber}: new message from ${panel}.`,
        meta: { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber },
      });
    } catch (e) {
      console.error("addReply notifyAdmins:", e);
    }

    return sendResponse(res, 200, true, { ticket: formatTicket(ticket) });
  } catch (err) {
    console.error("addReply error:", err);
    return sendResponse(res, 500, false, { message: "Could not send reply." });
  }
};
