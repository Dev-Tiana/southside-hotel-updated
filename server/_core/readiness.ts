import type { Request, Response } from "express";
import { checkDatabaseReadiness } from "../db";

// Keep the public response identical for all database/configuration failures.
export async function readinessHandler(_req: Request, res: Response) {
  res.set("Cache-Control", "no-store");
  let ready = false;
  try { ready = await checkDatabaseReadiness(); } catch { /* fail closed */ }
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" });
}
