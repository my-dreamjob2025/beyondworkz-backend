import jwt from "jsonwebtoken";
import "../config/env.js"; // ensures dotenv.config() runs before env vars are read

export const signAccess = (payload) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not configured");
  return jwt.sign(payload, secret, {
    expiresIn: process.env.ACCESS_EXPIRES || "15m",
  });
};

export const signRefresh = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not configured");
  return jwt.sign(payload, secret, {
    expiresIn: process.env.REFRESH_EXPIRES || "7d",
  });
};

export const verifyAccess = (token) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not configured");
  return jwt.verify(token, secret);
};

export const verifyRefresh = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not configured");
  return jwt.verify(token, secret);
};
