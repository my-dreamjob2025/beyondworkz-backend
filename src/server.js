import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";
import { BUCKET } from "./config/s3.config.js";
import { getAllowedOrigins } from "./config/corsOrigins.js";
import { initSocket } from "./socket.js";

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);
  initSocket(httpServer, getAllowedOrigins());

  httpServer.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
    console.log("Realtime: Socket.IO enabled");
    if (BUCKET) {
      console.log(`S3 storage: enabled (bucket: ${BUCKET})`);
    } else {
      console.log("S3 storage: disabled (using local uploads/)");
    }
  });
};

startServer();
