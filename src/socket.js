import { Server } from "socket.io";
import { verifyAccess } from "./utils/jwt.js";

let io = null;

export function initSocket(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins.length ? corsOrigins : true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    try {
      const decoded = verifyAccess(token);
      socket.userId = String(decoded.id);
      socket.userRole = decoded.role;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);
  });

  return io;
}

export function getIO() {
  return io;
}
