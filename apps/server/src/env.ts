// src/env.ts
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret && process.env.NODE_ENV === "production") {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

export const ENV = {
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:2567",
  PORT: Number(process.env.PORT) || 2567,
  MONGO_URI:
    process.env.MONGO_URI ||
    "mongodb://user:pass@localhost:27017/generals_hub?authSource=admin&directConnection=true",
  JWT_SECRET: jwtSecret || "your_jwt_secret_key_here",
};
