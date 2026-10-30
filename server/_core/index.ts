import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { readinessHandler } from "./readiness";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerMediaRoutes } from "../media/routes";
import { serveStatic, setupVite } from "./vite";
import {registerPaymentWebhook,registerPaymentRoutes} from "../payments/routes";

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api/trpc", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  const server = createServer(app);
  registerMediaRoutes(app);
  registerPaymentWebhook(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/ready", readinessHandler);
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerPaymentRoutes(app);
  app.get("/api/oauth/callback", (_req, res) => res.status(410).json({ error: "OAuth login has been retired. Use staff sign-in." }));
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => console.log(`Server listening on ${host}:${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
