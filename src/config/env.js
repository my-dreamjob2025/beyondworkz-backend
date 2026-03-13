import dotenv from "dotenv";

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5001,
  mongoUri: process.env.MONGO_URI || "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "",
  accessExpires: process.env.ACCESS_EXPIRES || "15m",
  refreshExpires: process.env.REFRESH_EXPIRES || "7d",
  awsRegion: process.env.AWS_REGION || "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  sesFromEmail: process.env.SES_FROM_EMAIL || "",
};

export default env;
