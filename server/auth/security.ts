import { createHash } from "node:crypto";
import type { Request, CookieOptions } from "express";
import { TRPCError } from "@trpc/server";
import { ServiceFailure } from "../_core/diagnostics";

export { COOKIE_NAME as STAFF_COOKIE } from "../../shared/const";
export const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const IDLE_MS = 30 * 60 * 1000;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function configuration() {
  let origin: URL;
  try { origin = new URL(process.env.STAFF_AUTH_ORIGIN ?? ""); } catch { throw new ServiceFailure("auth_unavailable"); }
  const local = process.env.STAFF_AUTH_ALLOW_LOCAL_HTTP === "1" && origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname);
  if (origin.origin !== process.env.STAFF_AUTH_ORIGIN || (origin.protocol !== "https:" && !local)) throw new ServiceFailure("auth_unavailable");
  return { origin: origin.origin, local };
}
export function assertOrigin(req: Request) {
  const config = configuration();
  const remote = req.socket?.remoteAddress;
  if (config.local && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Local authentication requires loopback access." });
  if (req.headers.origin !== config.origin || req.headers["sec-fetch-site"] === "cross-site") throw new TRPCError({ code: "FORBIDDEN", message: "Request origin rejected." });
  if (!config.local && req.protocol !== "https" && !req.secure) throw new TRPCError({ code: "FORBIDDEN", message: "HTTPS is required for staff authentication." });
}
export function cookieOptions(): CookieOptions {
  return { httpOnly: true, secure: !configuration().local, sameSite: "strict", path: "/" };
}
export function staffCanRead(role: string) { return role === "admin" || role === "staff"; }
