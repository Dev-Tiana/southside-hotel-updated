import { randomBytes } from "node:crypto";
import { parse } from "cookie";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { staffCredentials, staffSessions, staffAuthLimits, users, auditLogs } from "../../drizzle/schema";
import { ServiceFailure, diagnose } from "../_core/diagnostics";
import { verifyPassword, dummyHash } from "./password.mjs";
import { ABSOLUTE_MS, IDLE_MS, STAFF_COOKIE, assertOrigin, cookieOptions, digest, normalizeEmail } from "./security";

function token(req: Request) {
  return parse(req.headers.cookie ?? "")[STAFF_COOKIE];
}
async function safe<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) {
    if (error instanceof TRPCError || error instanceof ServiceFailure) throw error;
    diagnose("database_unavailable");
    throw new ServiceFailure("database_unavailable");
  }
}
export async function authenticateStaff(req: Request) {
  const value = token(req);
  if (!value) return null; // Bearer headers and legacy Manus cookies are never accepted.
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new ServiceFailure("invalid_session");
  return safe(async () => {
    const db = await getDb(), now = new Date();
    const [row] = await db.select({ session: staffSessions, credential: staffCredentials, user: users }).from(staffSessions)
      .innerJoin(staffCredentials, eq(staffCredentials.id, staffSessions.credentialId)).innerJoin(users, eq(users.id, staffCredentials.userId))
      .where(and(eq(staffSessions.tokenHash, digest(value)), isNull(staffSessions.revokedAt), gt(staffSessions.expiresAt, now), gt(staffSessions.lastSeenAt, new Date(now.getTime() - IDLE_MS)), eq(staffCredentials.enabled, true)));
    if (!row) throw new ServiceFailure("invalid_session");
    await db.update(staffSessions).set({ lastSeenAt: now }).where(and(eq(staffSessions.tokenHash, digest(value)), isNull(staffSessions.revokedAt)));
    return { ...row.user, role: row.credential.role };
  });
}
async function reserveAttempt(email: string, req: Request) {
  const db = await getDb(), now = new Date();
  // Forwarded headers are untrusted; deployment must explicitly design proxy handling.
  // Every writer locks IP then account. Blocked IPs cannot create endless email buckets.
  const buckets = [{ key: digest(`ip:${req.socket?.remoteAddress ?? "unknown"}`), limit: 30 }, { key: digest(`email:${email}`), limit: 10 }];
  return db.transaction(async tx => {
    let blocked = false;
    for (const bucket of buckets) {
      await tx.insert(staffAuthLimits).values({ bucketKey: bucket.key, attempts: 0, windowStartedAt: now }).onDuplicateKeyUpdate({ set: { bucketKey: bucket.key } });
      const [row] = await tx.select().from(staffAuthLimits).where(eq(staffAuthLimits.bucketKey, bucket.key)).for("update");
      const expired = row.windowStartedAt.getTime() <= now.getTime() - 15 * 60 * 1000;
      const attempts = expired ? 0 : row.attempts;
      if (attempts >= bucket.limit) blocked = true;
      await tx.update(staffAuthLimits).set({ attempts: Math.min(attempts + 1, bucket.limit + 1), windowStartedAt: expired ? now : row.windowStartedAt }).where(eq(staffAuthLimits.bucketKey, bucket.key));
      if (blocked) return true;
    }
    return blocked;
  });
}
export async function loginStaff(req: Request, res: Response, email: string, password: string) {
  assertOrigin(req);
  return safe(async () => {
    const normalized = normalizeEmail(email);
    if (await reserveAttempt(normalized, req)) {
      await (await getDb()).insert(auditLogs).values({ actorType: "anonymous", action: "staff.login.throttled", entityType: "staff_auth" });
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
    }
    const db = await getDb();
    const [credential] = await db.select().from(staffCredentials).where(eq(staffCredentials.email, normalized));
    let valid: boolean;
    try { valid = await verifyPassword(credential?.passwordHash ?? dummyHash, password); }
    catch { throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Sign-in is temporarily unavailable." }); }
    if (!valid || !credential?.enabled) {
      await db.insert(auditLogs).values({ actorType: "anonymous", action: "staff.login.denied", entityType: "staff_auth" });
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
    }
    const value = randomBytes(32).toString("base64url"), now = new Date();
    await db.transaction(async tx => {
      const [current] = await tx.select().from(staffCredentials).where(eq(staffCredentials.id, credential.id)).for("update");
      if (!current?.enabled || current.passwordHash !== credential.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
      const old = token(req);
      if (old && /^[A-Za-z0-9_-]{43}$/.test(old)) await tx.update(staffSessions).set({ revokedAt: now }).where(eq(staffSessions.tokenHash, digest(old)));
      await tx.insert(staffSessions).values({ tokenHash: digest(value), credentialId: credential.id, lastSeenAt: now, expiresAt: new Date(now.getTime() + ABSOLUTE_MS) });
      await tx.update(users).set({ lastSignedIn: now }).where(eq(users.id, credential.userId));
      await tx.insert(auditLogs).values({ actorId: credential.userId, actorType: "staff", action: "staff.login", entityType: "staff_auth" });
    });
    res.cookie(STAFF_COOKIE, value, { ...cookieOptions(), maxAge: ABSOLUTE_MS });
    return { success: true as const };
  });
}
export async function logoutStaff(req: Request, res: Response) {
  assertOrigin(req);
  const value = token(req);
  await safe(async () => {
    if (value && /^[A-Za-z0-9_-]{43}$/.test(value)) {
      const db = await getDb();
      await db.transaction(async tx => {
        const [row] = await tx.select({ userId: staffCredentials.userId }).from(staffSessions).innerJoin(staffCredentials, eq(staffCredentials.id, staffSessions.credentialId)).where(eq(staffSessions.tokenHash, digest(value)));
        await tx.update(staffSessions).set({ revokedAt: new Date() }).where(eq(staffSessions.tokenHash, digest(value)));
        if (row) await tx.insert(auditLogs).values({ actorId: row.userId, actorType: "staff", action: "staff.logout", entityType: "staff_auth" });
      });
    }
  });
  res.clearCookie(STAFF_COOKIE, cookieOptions());
  return { success: true as const };
}
