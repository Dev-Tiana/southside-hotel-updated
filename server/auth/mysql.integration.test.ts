import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { authenticateStaff, loginStaff, logoutStaff } from "./service";
import { hashPassword } from "./password.mjs";
import { ABSOLUTE_MS, IDLE_MS, STAFF_COOKIE, digest } from "./security";
import { createInitialAdministrator } from "../../scripts/local/admin-setup.mjs";
import { appRouter } from "../routers";
import { createContext } from "../_core/context";

describe.skipIf(process.env.SOUTHSIDE_INTEGRATION !== "1")("isolated MySQL authentication", () => {
  let c: mysql.Connection, passwordHash: string;
  const password = `Fictional test only ${crypto.randomUUID()}`;
  const origin = "https://staff.integration.invalid";
  const testIp = `127.${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}`;
  beforeAll(async () => {
    process.env.STAFF_AUTH_ORIGIN = origin;
    process.env.STAFF_AUTH_ALLOW_LOCAL_HTTP = "0";
    const config = JSON.parse(fs.readFileSync(".local/database.json", "utf8"));
    const url = new URL(process.env.DATABASE_URL!);
    expect(config.marker).toBe("southside-owned-local-mysql-v1");
    expect(url.hostname).toBe("127.0.0.1"); expect(url.port).toBe("3307");
    expect(url.pathname).toBe("/southside_integration");
    expect(decodeURIComponent(url.username)).toBe(config.test.user);
    c = await mysql.createConnection(process.env.DATABASE_URL!);
    const [identity]: any = await c.query("SELECT @@datadir AS datadir, VERSION() AS version");
    expect(path.resolve(identity[0].datadir)).toBe(path.resolve(".local/mysql-data"));
    expect(identity[0].version).toMatch(/^8\./);
    passwordHash = await hashPassword(password);
  });
  afterAll(async () => { await c?.end(); });
  const request = (token?: string, suppliedOrigin = origin, ip = testIp) => ({ protocol: "https", headers: { origin: suppliedOrigin, cookie: token ? `${STAFF_COOKIE}=${token}` : undefined }, socket: { remoteAddress: ip } }) as any;
  async function fixture(enabled = true) {
    const email = `test-${crypto.randomUUID()}@example.invalid`;
    const [user]: any = await c.execute("INSERT INTO users (openId, name, email, role) VALUES (?, 'Fictional ordinary login test', ?, 'user')", [crypto.randomUUID(), email]);
    const [credential]: any = await c.execute("INSERT INTO staff_credentials (userId, email, passwordHash, role, enabled) VALUES (?, ?, ?, 'user', ?)", [user.insertId, email, passwordHash, enabled]);
    return { email, userId: user.insertId, credentialId: credential.insertId };
  }
  async function login(email: string, oldToken?: string) {
    let value = "", options: any;
    const result = await loginStaff(request(oldToken), { cookie: (name: string, token: string, opts: any) => { expect(name).toBe(STAFF_COOKIE); value = token; options = opts; } } as any, email, password);
    expect(result).toEqual({ success: true });
    expect(options).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
    return value;
  }
  it("accepts email/password, normalizes email, stores only token hashes and denies ordinary administrator access", async () => {
    const f = await fixture(), token = await login(f.email.toUpperCase());
    const [rows]: any = await c.execute("SELECT tokenHash, expiresAt FROM staff_sessions WHERE credentialId = ?", [f.credentialId]);
    expect(rows[0].tokenHash).toBe(digest(token)); expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + ABSOLUTE_MS - 5000);
    const user = await authenticateStaff(request(token));
    expect(user?.role).toBe("user"); expect(user).not.toHaveProperty("passwordHash");
    const ctx = await createContext({ req: request(token), res: {} } as never);
    await expect(appRouter.createCaller(ctx).admin.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("uses the same generic denial for unknown, wrong-password and disabled accounts", async () => {
    const enabled = await fixture(), disabled = await fixture(false);
    for (const [email, supplied] of [[enabled.email, "wrong password"], [disabled.email, password], [`missing-${crypto.randomUUID()}@example.invalid`, password]]) {
      await expect(loginStaff(request(), {} as any, email, supplied)).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
    }
  }, 15000);
  it("revokes a server session at logout and rejects replay", async () => {
    const f = await fixture(), token = await login(f.email);
    let cleared = false;
    await logoutStaff(request(token), { clearCookie: () => { cleared = true; } } as any);
    expect(cleared).toBe(true);
    await expect(authenticateStaff(request(token))).rejects.toMatchObject({ kind: "invalid_session" });
    const [rows]: any = await c.execute("SELECT revokedAt FROM staff_sessions WHERE tokenHash = ?", [digest(token)]);
    expect(rows[0].revokedAt).not.toBeNull();
  });
  it("rotates sessions on login instead of accepting a fixed token", async () => {
    const f = await fixture(), old = await login(f.email), next = await login(f.email, old);
    expect(next).not.toBe(old);
    await expect(authenticateStaff(request(old))).rejects.toMatchObject({ kind: "invalid_session" });
    expect((await authenticateStaff(request(next)))?.id).toBe(f.userId);
  });
  it.each(["absolute", "idle", "disabled"])("expires or rejects a session when %s", async mode => {
    const f = await fixture(), token = await login(f.email);
    if (mode === "absolute") await c.execute("UPDATE staff_sessions SET expiresAt = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE tokenHash = ?", [digest(token)]);
    if (mode === "idle") await c.execute("UPDATE staff_sessions SET lastSeenAt = ? WHERE tokenHash = ?", [new Date(Date.now() - IDLE_MS - 2000), digest(token)]);
    if (mode === "disabled") await c.execute("UPDATE staff_credentials SET enabled = 0 WHERE id = ?", [f.credentialId]);
    await expect(authenticateStaff(request(token))).rejects.toMatchObject({ kind: "invalid_session" });
  });
  it("ignores legacy cookies and bearer headers, and rejects forged independent cookies", async () => {
    expect(await authenticateStaff({ headers: { cookie: "webdev_app_session=old", authorization: "Bearer old" } } as any)).toBeNull();
    await expect(authenticateStaff(request(crypto.randomBytes(32).toString("base64url")))).rejects.toMatchObject({ kind: "invalid_session" });
    await expect(authenticateStaff(request("bad-format"))).rejects.toMatchObject({ kind: "invalid_session" });
  });
  it("rejects cross-origin sign-in/logout before database writes", async () => {
    const f = await fixture();
    await expect(loginStaff(request(undefined, "https://attacker.invalid"), {} as any, f.email, password)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(logoutStaff(request(undefined, "https://attacker.invalid"), {} as any)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("atomically limits concurrent attempts using shared persistent account buckets", async () => {
    const f = await fixture();
    // Preseed the threshold, then race the final allowed slot and one blocked slot.
    await c.execute("INSERT INTO staff_auth_limits (bucketKey, attempts, windowStartedAt) VALUES (?, 9, NOW())", [digest(`email:${f.email}`)]);
    const outcomes = await Promise.allSettled([testIp, "::1"].map(ip => loginStaff(request(undefined, origin, ip), {} as any, f.email, "incorrect")));
    const codes = outcomes.map(row => row.status === "rejected" ? row.reason.code : "unexpected");
    expect(codes.sort()).toEqual(["TOO_MANY_REQUESTS", "UNAUTHORIZED"].sort());
  });
  it("does not create an administrator without explicit authorization", async () => {
    await expect(createInitialAdministrator(c, {}, false)).rejects.toThrow(/authorization/);
  });
  it("refuses to link or promote an existing user with the same email", async () => {
    const f = await fixture();
    await expect(createInitialAdministrator(c, { email: f.email, name: "Fictional existing identity", password }, true)).rejects.toThrow(/already exists/);
    const [rows]: any = await c.execute("SELECT role FROM staff_credentials WHERE id = ?", [f.credentialId]);
    expect(rows[0].role).toBe("user");
  });
  it("refuses a completed setup guard without overwriting it", async () => {
    await c.beginTransaction();
    await c.execute("INSERT INTO staff_auth_setup (id, completedAt) VALUES (1, NOW()) ON DUPLICATE KEY UPDATE completedAt = NOW()");
    const proxy = new Proxy(c, { get(target, name) { if (name === "beginTransaction") return async () => {}; const value = (target as any)[name]; return typeof value === "function" ? value.bind(target) : value; } });
    await expect(createInitialAdministrator(proxy, { email: `blocked-${crypto.randomUUID()}@example.invalid`, name: "Fictional blocked setup", password }, true)).rejects.toThrow(/already completed/);
    // The helper rolled back the enclosing test transaction; no completed guard persists.
    const [rows]: any = await c.query("SELECT COUNT(*) AS count FROM staff_auth_setup WHERE completedAt IS NOT NULL");
    expect(Number(rows[0].count)).toBe(0);
  });
  it.skipIf(process.env.SOUTHSIDE_PRESERVE_ADMIN === "1")("checks initial setup and audit atomically but rolls back before privileged records can persist", async () => {
    const sentinel = new Error("Intentional rollback before privileged commit");
    const proxy = new Proxy(c, { get(target, name) { if (name === "commit") return async () => {
      const [rows]: any = await target.query("SELECT COUNT(*) AS count FROM staff_credentials WHERE role = 'admin'");
      expect(Number(rows[0].count)).toBe(1);
      throw sentinel;
    }; const value = (target as any)[name]; return typeof value === "function" ? value.bind(target) : value; } });
    await expect(createInitialAdministrator(proxy, { email: `initial-${crypto.randomUUID()}@example.invalid`, name: "Fictional rollback-only setup", password }, true)).rejects.toBe(sentinel);
    const [admins]: any = await c.query("SELECT COUNT(*) AS count FROM staff_credentials WHERE role = 'admin'");
    expect(Number(admins[0].count)).toBe(0);
    const [setup]: any = await c.query("SELECT COUNT(*) AS count FROM staff_auth_setup WHERE completedAt IS NOT NULL");
    expect(Number(setup[0].count)).toBe(0);
  });
});
