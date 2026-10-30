import { afterEach, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { hotelManagement } from "./management/service";
import type { TrpcContext } from "./_core/context";

vi.mock("./management/service", () => ({ hotelManagement: { execute: vi.fn(), snapshot: vi.fn(), history: vi.fn() } }));
afterEach(() => vi.resetAllMocks());
const base = { categoryId: 1, reason: "Offline authorized review" };
const commands = [
  { action: "room.create", label: "Offline101", isActive: true },
  { action: "room.active", roomId: 1, isActive: false },
  { action: "room.assign", roomId: 1, reservationId: 1 },
  { action: "room.release", assignmentId: 1 },
  { action: "rate.set", rateDate: null, amount: "100.00" },
  { action: "housekeeping.create", roomId: 1 },
  { action: "housekeeping.advance", taskId: 1, status: "in progress" },
  { action: "maintenance.create", roomId: 1, startDate: "2030-01-01", endDate: "2030-01-02" },
  { action: "maintenance.release", maintenanceId: 1 },
  { action: "maintenance.releaseBlock", blockId: 1 },
  { action: "reservation.create", name: "Offline Guest", email: "offline@example.test", phone: "0000000000", checkIn: "2030-01-01", checkOut: "2030-01-02", rooms: 1, adults: 1, children: 0, source: "staff" },
  { action: "reservation.status", reservationId: 1, expectedStatus: "confirmed", status: "cancellation requested" },
  { action: "reservation.amend", reservationId: 1, expectedRevision: "a".repeat(64), checkIn: "2030-01-01", checkOut: "2030-01-03", rooms: 1, adults: 1, children: 0 },
  { action: "inventory.reconcile", capacitySource: "category", reviewedCancellationIds: [] },
  { action: "hold.create", checkIn: "2030-01-01", checkOut: "2030-01-02", rooms: 1, minutes: 10 },
  { action: "hold.release", holdId: 1 },
  { action: "terms.approve", terms: "Offline approved hotel terms" },
];
function caller(role?: "user" | "staff" | "admin") {
  return appRouter.createCaller({ req: {}, res: {}, user: role ? { id: 7, role } : null } as TrpcContext);
}
it.each(commands)("denies anonymous and ordinary users for $action", async command => {
  for (const role of [undefined, "user", "staff"] as const) {
    await expect(caller(role).operations.execute({ ...base, ...command } as never)).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
  }
  expect(hotelManagement.execute).not.toHaveBeenCalled();
});
it.each([undefined, "user"] as const)("protects operational records and audit history for %s", async role => {
  await expect(caller(role).operations.snapshot({ categoryId: 1 })).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
  await expect(caller(role).operations.history({ categoryId: 1 })).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
  expect(hotelManagement.snapshot).not.toHaveBeenCalled(); expect(hotelManagement.history).not.toHaveBeenCalled();
});
it("uses the authenticated administrator ID, never a browser-supplied actor", async () => {
  vi.mocked(hotelManagement.execute).mockResolvedValue({ message: "Saved", details: {} });
  await caller("admin").operations.execute({ ...base, action: "room.create", label: "Offline101", isActive: true, actorId: 999 } as never);
  expect(hotelManagement.execute).toHaveBeenCalledWith({ categoryId: 1, action: "room.create", label: "Offline101", isActive: true }, 7);
});
it("rejects malformed input before a management write", async () => {
  await expect(caller("admin").operations.execute({ ...base, action: "rate.set", amount: "-1", rateDate: "2100-02-29" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(hotelManagement.execute).not.toHaveBeenCalled();
});
it("permits staff reads without permitting operational writes", async () => {
  vi.mocked(hotelManagement.snapshot).mockResolvedValue({ effectiveCapacity: 2 } as never);
  vi.mocked(hotelManagement.history).mockResolvedValue([]);
  expect(await caller("staff").operations.snapshot({ categoryId: 1 })).toEqual({ effectiveCapacity: 2 });
  expect(await caller("staff").operations.history({ categoryId: 1 })).toEqual([]);
});
