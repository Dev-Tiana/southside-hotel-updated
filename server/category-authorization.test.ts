import { afterEach, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { categories, createCategory } from "./management/categories";
import type { TrpcContext } from "./_core/context";
vi.mock("./management/categories", () => ({ categories: { detail: vi.fn(), save: vi.fn(), inventory: vi.fn() }, createCategory: vi.fn(), publicCategoryMedia: vi.fn(), publicBookingTerms: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const details = { name: "Fictional category", description: "Offline", maxOccupancy: 2, bedConfiguration: "Double", amenities: ["Desk"], verification: "verified" as const, images: [], reason: "Offline permission test" };
function caller(role?: "user" | "staff" | "admin") { return appRouter.createCaller({ req: {}, res: {}, user: role ? { id: 7, role } : null } as TrpcContext); }
it.each([undefined, "user", "staff"] as const)("denies category administration to %s", async role => {
  const code = role ? "FORBIDDEN" : "UNAUTHORIZED", c = caller(role);
  await expect(c.admin.category({ categoryId: 1 })).rejects.toMatchObject({ code });
  await expect(c.admin.createCategory({ ...details, slug: "offline" })).rejects.toMatchObject({ code });
  await expect(c.admin.saveCategory({ ...details, categoryId: 1, expectedRevision: "a".repeat(64), isActive: true })).rejects.toMatchObject({ code });
  await expect(c.admin.categoryInventory({ categoryId: 1, expectedRevision: "a".repeat(64), sellableInventory: 2, reviewedCancellationIds: [], reconciliationAccepted: true, reason: details.reason })).rejects.toMatchObject({ code });
  expect(createCategory).not.toHaveBeenCalled(); expect(categories.save).not.toHaveBeenCalled(); expect(categories.inventory).not.toHaveBeenCalled();
});
it("uses the authenticated administrator actor and validates input", async () => {
  await caller("admin").admin.createCategory({ ...details, slug: "offline", actorId: 999 } as never);
  expect(createCategory).toHaveBeenCalledWith({ ...details, slug: "offline" }, 7);
  await expect(caller("admin").admin.createCategory({ ...details, slug: "../../bad" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
