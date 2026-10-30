import { beforeEach, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { mysqlRepository } from "./repository";
import { getDb } from "../db";
import { assertOperationalDatabase } from "./compatibility";

vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("./compatibility", () => ({ assertOperationalDatabase: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); });

function database(failAudit = false) {
  const locks: Array<{ table: string; mode: string }> = [];
  let rolledBack = false;
  const tx = {
    select: () => ({ from: (table: Parameters<typeof getTableName>[0]) => ({ where: () => ({ for: async (mode: string) => {
      const name = getTableName(table); locks.push({ table: name, mode });
      return name === "room_categories" ? [{ id: 1, name: "Offline category" }] : [];
    } }) }) }),
    insert: () => ({ values: async () => { if (failAudit) throw new Error("private driver error with SQL"); return [{ insertId: 1 }]; } }),
  };
  const db = { transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>, _config: unknown) => {
    try { return await work(tx); } catch (error) { rolledBack = true; throw error; }
  }) };
  vi.mocked(getDb).mockResolvedValue(db as never);
  return { db, locks, rolledBack: () => rolledBack };
}

it("checks compatibility and acquires the category lock before all related rows", async () => {
  const { db, locks } = database();
  await mysqlRepository.withCategory(1, async unit => { await unit.audit("offline.test", 1, { safe: true }); });
  expect(assertOperationalDatabase).toHaveBeenCalledWith(db);
  expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "read committed", accessMode: "read write" });
  expect(locks[0]).toEqual({ table: "room_categories", mode: "update" });
  expect(locks.every(lock => lock.mode === "update")).toBe(true);
  expect(locks.map(lock => lock.table)).toContain("booking_holds");
  expect(locks.map(lock => lock.table)).toContain("inventory_blocks");
});

it("rolls back failed audit writes and sanitizes driver errors", async () => {
  const test = database(true);
  await expect(mysqlRepository.withCategory(1, unit => unit.audit("offline.test", 1, {}))).rejects.toMatchObject({ kind: "database_unavailable", message: "Service temporarily unavailable." });
  expect(test.rolledBack()).toBe(true);
});

it("refuses transactions if the database compatibility check fails", async () => {
  const { db } = database();
  vi.mocked(assertOperationalDatabase).mockRejectedValue(new Error("unsupported offline engine"));
  await expect(mysqlRepository.withCategory(1, async () => 1)).rejects.toMatchObject({ kind: "database_unavailable" });
  expect(db.transaction).not.toHaveBeenCalled();
});
