import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";
import logger from "./config/logger.js";

const startServer = async () => {
  await connectDB();

  app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port}`);
  });
};

startServer();
