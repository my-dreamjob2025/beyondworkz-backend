import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";
import { BUCKET } from "./config/s3.config.js";

const startServer = async () => {
  await connectDB();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
    if (BUCKET) {
      console.log(`S3 storage: enabled (bucket: ${BUCKET})`);
    } else {
      console.log("S3 storage: disabled (using local uploads/)");
    }
  });
};

startServer();
