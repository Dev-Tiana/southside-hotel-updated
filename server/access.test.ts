import { afterEach, describe, expect, it, vi } from "vitest";
import { adminProcedure, staffProcedure, router } from "./_core/trpc";
import { createContext, type TrpcContext } from "./_core/context";
import { ServiceFailure } from "./_core/diagnostics";
import { authenticateStaff } from "./auth/service";
vi.mock("./auth/service", () => ({ authenticateStaff: vi.fn() }));
const access = router({ privateData: adminProcedure.query(() => "allowed"), staffData: staffProcedure.query(() => "staff allowed"), write: adminProcedure.mutation(() => "saved") });
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllEnvs(); });
describe("independent staff authorization", () => {
  it.each([null, "user", "staff", "admin"] as const)("enforces role %s on the server", async role => {
    const ctx = { user: role ? { id: 1, role } : null } as TrpcContext;
    const caller = access.createCaller(ctx);
    if (role === "admin") expect(await caller.privateData()).toBe("allowed");
    else await expect(caller.privateData()).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
    if (role === "staff" || role === "admin") expect(await caller.staffData()).toBe("staff allowed");
    else await expect(caller.staffData()).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
  });
  it.each(["database_unavailable", "auth_unavailable", "invalid_session"] as const)("sanitizes %s in actual request context", async kind => {
    vi.mocked(authenticateStaff).mockRejectedValue(new ServiceFailure(kind));
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = await createContext({ req: { headers: { cookie: "secret-cookie" } }, res: {} } as never);
    await expect(access.createCaller(ctx).privateData()).rejects.toMatchObject({ code: kind === "invalid_session" ? "UNAUTHORIZED" : "SERVICE_UNAVAILABLE" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-cookie");
  });
  it("requires the configured origin for real authenticated mutations", async () => {
    vi.stubEnv("STAFF_AUTH_ORIGIN", "https://hotel.example");
    const ctx = { user: { id: 1, role: "admin" }, staffSession: true, req: { protocol: "https", headers: { origin: "https://attacker.example" } } } as TrpcContext;
    await expect(access.createCaller(ctx).write()).rejects.toMatchObject({ code: "FORBIDDEN" });
    ctx.req.headers.origin = "https://hotel.example";
    expect(await access.createCaller(ctx).write()).toBe("saved");
  });
});
