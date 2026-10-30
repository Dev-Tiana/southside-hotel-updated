import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword, validPassword, dummyHash } from "./password.mjs";
import { assertOrigin, cookieOptions, configuration, digest, staffCanRead } from "./security";
import { readFileSync } from "node:fs";
afterEach(() => vi.unstubAllEnvs());
describe("Argon2id password storage", () => {
  it("uses independent random salts and verifies without storing plaintext", async () => {
    const password = "offline passphrase never deployed";
    const a = await hashPassword(password), b = await hashPassword(password);
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(a).not.toContain(password);
    expect(await verifyPassword(a, password)).toBe(true);
    expect(await verifyPassword(a, "incorrect passphrase")).toBe(false);
    expect(await verifyPassword(dummyHash, password)).toBe(false);
  }, 15000);
  it.each(["", "short", "x".repeat(129)])("rejects unsuitable password length", async password => {
    expect(validPassword(password)).toBe(false);
    await expect(hashPassword(password)).rejects.toThrow(/15 to 128/);
  });
  it("does not truncate passwords and rejects malformed hash parameters", async () => {
    expect(validPassword("x".repeat(128))).toBe(true);
    expect(await verifyPassword("$argon2id$untrusted-cost", "password")).toBe(false);
  });
});
describe("cookie, origin and permission policy", () => {
  it("defaults to HTTPS-only host-only HttpOnly Strict cookies", () => {
    vi.stubEnv("STAFF_AUTH_ORIGIN", "https://hotel.example");
    expect(cookieOptions()).toEqual({ secure: true, httpOnly: true, sameSite: "strict", path: "/" });
  });
  it("requires explicit loopback configuration for local HTTP", () => {
    vi.stubEnv("STAFF_AUTH_ORIGIN", "http://127.0.0.1:3001");
    expect(() => configuration()).toThrow();
    vi.stubEnv("STAFF_AUTH_ALLOW_LOCAL_HTTP", "1");
    expect(cookieOptions().secure).toBe(false);
    expect(() => assertOrigin({ headers: { origin: "http://127.0.0.1:3001" }, socket: { remoteAddress: "192.0.2.10" } } as never)).toThrow(/loopback/);
    expect(() => assertOrigin({ headers: { origin: "http://127.0.0.1:3001" }, socket: { remoteAddress: "127.0.0.1" } } as never)).not.toThrow();
  });
  it.each([undefined, "null", "https://attacker.example"])("rejects origin %s", origin => {
    vi.stubEnv("STAFF_AUTH_ORIGIN", "https://hotel.example");
    expect(() => assertOrigin({ headers: { origin } } as never)).toThrow(/origin/);
  });
  it("requires an exact HTTPS origin outside loopback", () => {
    vi.stubEnv("STAFF_AUTH_ALLOW_LOCAL_HTTP", "1");
    vi.stubEnv("STAFF_AUTH_ORIGIN", "http://hotel.example");
    expect(() => configuration()).toThrow();
  });
  it("restricts dashboard reads to authorized staff and administrators", () => {
    expect(staffCanRead("user")).toBe(false);
    expect(staffCanRead("staff")).toBe(true);
    expect(staffCanRead("admin")).toBe(true);
    expect(digest("token")).toHaveLength(64);
  });
});
it("keeps the migration additive and preserves all historical tables", () => {
  const before = JSON.parse(readFileSync("drizzle/meta/0002_snapshot.json", "utf8"));
  const after = JSON.parse(readFileSync("drizzle/meta/0003_snapshot.json", "utf8"));
  for (const name of Object.keys(before.tables)) expect(after.tables[name]).toEqual(before.tables[name]);
  const sql = readFileSync("drizzle/0003_independent_staff_auth.sql", "utf8");
  expect(sql.match(/ENGINE=InnoDB/g)).toHaveLength(4);
  expect(sql).not.toMatch(/\b(?:DROP|INSERT|TRUNCATE|MODIFY)\b/i);
});
