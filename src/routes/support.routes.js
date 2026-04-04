import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireEmployeeOrEmployer from "../middlewares/supportAccess.middleware.js";
import {
  listTickets,
  createTicket,
  getTicket,
  addReply,
} from "../controllers/support/supportTicket.controller.js";

const router = Router();

router.use(authMiddleware, requireEmployeeOrEmployer);

router.get("/tickets", listTickets);
router.post("/tickets", createTicket);
router.get("/tickets/:ticketId", getTicket);
router.post("/tickets/:ticketId/replies", addReply);

export default router;
