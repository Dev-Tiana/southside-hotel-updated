import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ServiceFailure } from "./_core/diagnostics";
import { readinessHandler } from "./_core/readiness";
import * as db from "./db";

vi.mock("./db", () => ({
  getAdminSummary: vi.fn(), listRoomDrafts: vi.fn(), listRoomCategories: vi.fn(),
  searchAvailability: vi.fn(), createReservation: vi.fn(),
  createContactSubmission: vi.fn(), checkDatabaseReadiness: vi.fn(),
}));
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
function context(role?: "user" | "admin"): TrpcContext {
  return { req: {}, res: {}, user: role ? { id: 1, role } : null } as TrpcContext;
}

describe("actual staff procedures", () => {
  it.each([undefined, "user"] as const)("blocks role %s before database access", async role => {
    const caller = appRouter.createCaller(context(role));
    const code = role ? "FORBIDDEN" : "UNAUTHORIZED";
    await expect(caller.admin.summary()).rejects.toMatchObject({ code });
    await expect(caller.admin.roomDrafts()).rejects.toMatchObject({ code });
    expect(db.getAdminSummary).not.toHaveBeenCalled();
    expect(db.listRoomDrafts).not.toHaveBeenCalled();
  });
  it("allows administrators to fetch summary and room drafts", async () => {
    const summary = { configured: true, arrivals: 0 };
    vi.mocked(db.getAdminSummary).mockResolvedValue(summary as never);
    vi.mocked(db.listRoomDrafts).mockResolvedValue([]);
    const caller = appRouter.createCaller(context("admin"));
    expect(await caller.admin.summary()).toEqual(summary);
    expect(await caller.admin.roomDrafts()).toEqual([]);
  });
  it.each(["database_unavailable", "oauth_unavailable", "invalid_session"] as const)("preserves %s on auth.me", async kind => {
    const ctx = context();
    ctx.authFailure = new ServiceFailure(kind);
    await expect(appRouter.createCaller(ctx).auth.me()).rejects.toMatchObject({
      code: kind === "invalid_session" ? "UNAUTHORIZED" : "SERVICE_UNAVAILABLE",
    });
  });
  it("does not return a provisional catalogue or zero summary during an outage", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(db.listRoomCategories).mockRejectedValue(new ServiceFailure("database_unavailable"));
    vi.mocked(db.getAdminSummary).mockRejectedValue(new ServiceFailure("database_unavailable"));
    vi.mocked(db.listRoomDrafts).mockRejectedValue(new ServiceFailure("database_unavailable"));
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.hotel.rooms()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable." });
    await expect(caller.admin.summary()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(caller.admin.roomDrafts()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});

describe("public readiness handler", () => {
  it.each([true, false, "throw"] as const)("responds safely when probe is %s", async outcome => {
    if (outcome === "throw") vi.mocked(db.checkDatabaseReadiness).mockRejectedValue(new Error("private-host credentials SQL"));
    else vi.mocked(db.checkDatabaseReadiness).mockResolvedValue(outcome);
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await readinessHandler({} as never, res as never);
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(outcome === true ? 200 : 503);
    expect(res.json).toHaveBeenCalledWith({ status: outcome === true ? "ready" : "unavailable" });
  });
});

describe("reservation input validation", () => {
  const input = { checkIn: "2096-02-29", checkOut: "2096-03-01", adults: 1, children: 0, rooms: 1 };
  it.each([
    { checkIn: "2096-03-01", checkOut: "2096-03-01" },
    { checkIn: "2096-03-02", checkOut: "2096-03-01" },
    { checkIn: "2000-01-01", checkOut: "2000-01-02" },
  ])("returns a meaningful validation error for invalid stays", async dates => {
    await expect(appRouter.createCaller(context()).booking.search({ ...input, ...dates })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.searchAvailability).not.toHaveBeenCalled();
  });
  it.each(["2096-02-29", "2400-02-29"])("accepts leap date %s through tRPC", async checkIn => {
    vi.mocked(db.searchAvailability).mockResolvedValue({ configured: true, nights: 1, rooms: [] });
    await appRouter.createCaller(context()).booking.search({ ...input, checkIn, checkOut: `${checkIn.slice(0, 4)}-03-01` });
    expect(db.searchAvailability).toHaveBeenCalledOnce();
  });
  it.each(["2100-02-29", "2095-02-29", "2096-04-31", "2096-2-29"])("rejects invalid date %s before database access", async checkIn => {
    await expect(appRouter.createCaller(context()).booking.search({ ...input, checkIn })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.searchAvailability).not.toHaveBeenCalled();
  });
});
