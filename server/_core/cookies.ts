import type { CookieOptions, Request } from "express";
import { cookieOptions } from "../auth/security";

export function getSessionCookieOptions(_req: Request): CookieOptions {
  return cookieOptions();
}
