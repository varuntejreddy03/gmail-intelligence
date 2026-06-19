export const config = {
  port: Number(process.env.BACKEND_PORT || 4000),
  corsOrigin: process.env.AUTH_URL || "http://localhost:3000",
  internalSecret: process.env.BACKEND_INTERNAL_SECRET || "",
};
