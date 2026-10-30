import { operationalTables } from "./management/compatibility";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ drizzle: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: mocks.drizzle }));
let db: typeof import("./db");
// Module loading on Windows can exceed a test's 5s assertion budget.
// Keep cold imports in setup; database operations themselves remain mocked.
beforeEach(async () => { db = await import("./db"); }, 20000);
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.resetAllMocks(); });

it("does not disguise missing configuration as empty data", async () => {
  vi.stubEnv("DATABASE_URL", "");
  for (const read of [db.listRoomCategories, db.listRoomDrafts, db.getAdminSummary]) {
    await expect(read()).rejects.toMatchObject({ kind: "database_unavailable" });
  }
  expect(await db.checkDatabaseReadiness()).toBe(false);
  expect(mocks.drizzle).not.toHaveBeenCalled();
});

it("sanitizes wrapped driver failures", async () => {
  vi.stubEnv("DATABASE_URL", "offline-only");
  mocks.drizzle.mockReturnValue({ select: () => { throw new Error("private infrastructure and SQL details"); } });
  await expect(db.listRoomCategories()).rejects.toMatchObject({ message: "Service temporarily unavailable." });
  await expect(db.getAdminSummary()).rejects.toMatchObject({ kind: "database_unavailable" });
  await expect(db.listRoomDrafts()).rejects.toMatchObject({ kind: "database_unavailable" });
  expect(await db.checkDatabaseReadiness()).toBe(false);
});

it("checks schema readiness without reading records", async () => {
  vi.stubEnv("DATABASE_URL", "offline-only");
  const limit = vi.fn().mockResolvedValue([]);
  mocks.drizzle.mockReturnValue({ execute: vi.fn().mockResolvedValueOnce([[{ version: "8.0.36" }], []]).mockResolvedValueOnce([operationalTables.map(name => ({ name, engine: "InnoDB" })), []]), select: () => ({ from: () => ({ limit }) }) });
  expect(await db.checkDatabaseReadiness()).toBe(true);
  expect(limit).toHaveBeenCalledTimes(27);
  expect(limit.mock.calls.every(([value]) => value === 0)).toBe(true);
});
