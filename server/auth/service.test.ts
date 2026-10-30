import { afterEach, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { authenticateStaff, loginStaff, logoutStaff } from "./service";
import { STAFF_COOKIE } from "./security";
vi.mock("../db", () => ({ getDb: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const request = () => ({ protocol: "https", headers: { origin: "https://hotel.example", cookie: `${STAFF_COOKIE}=${"a".repeat(43)}` }, socket: { remoteAddress: "127.0.0.1" } }) as any;
it("does not touch MySQL for anonymous, legacy-cookie or bearer-only requests", async () => {
  for (const headers of [{}, { cookie: "webdev_app_session=legacy" }, { authorization: "Bearer legacy" }]) expect(await authenticateStaff({ headers } as any)).toBeNull();
  expect(getDb).not.toHaveBeenCalled();
});
it.each(["authenticate", "login", "logout"])("sanitizes database failure during %s", async action => {
  vi.stubEnv("STAFF_AUTH_ORIGIN", "https://hotel.example");
  vi.mocked(getDb).mockRejectedValue(new Error("private mysql://user:password@internal SQL"));
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const res = { cookie: vi.fn(), clearCookie: vi.fn() } as any;
  const result = action === "authenticate" ? authenticateStaff(request()) : action === "login" ? loginStaff(request(), res, "test@example.invalid", "private test password") : logoutStaff(request(), res);
  await expect(result).rejects.toMatchObject({ kind: "database_unavailable", message: "Service temporarily unavailable." });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/password|internal|SQL/);
  expect(res.cookie).not.toHaveBeenCalled();
  expect(res.clearCookie).not.toHaveBeenCalled(); // Never falsely report successful revocation.
});
