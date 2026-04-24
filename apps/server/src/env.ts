// src/infra/config/env.ts
export const ENV = {
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:2567",
  PORT: Number(process.env.PORT) || 2567,
  MONGO_URI:
    process.env.MONGO_URI ||
    "mongodb://user:pass@localhost:27017/generals_hub?authSource=admin&directConnection=true",
  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key_here",
};
