import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const directory = path.resolve(import.meta.dirname, "../../drizzle");
const read = (name: string) => readFileSync(path.join(directory, name), "utf8");
it("adds payment attempts/history without modifying historical financial schema",()=>{const sql=read("0005_test_payment_processing.sql");expect(sql.match(/CREATE TABLE /g)).toHaveLength(2);expect(sql.match(/ENGINE=InnoDB/g)).toHaveLength(2);expect(sql).not.toMatch(/ALTER TABLE `(reservations|payments|users|room_categories)`/);const before=JSON.parse(read("meta/0004_snapshot.json")),after=JSON.parse(read("meta/0005_snapshot.json"));expect(after.prevId).toBe(before.id);for(const name of Object.keys(before.tables))expect(after.tables[name]).toEqual(before.tables[name]);expect(Object.keys(after.tables)).toHaveLength(27);});
it("adds only retry and disabled-notification tables while preserving all historical schema",()=>{
  const sql=read("0004_booking_reliability.sql");expect(sql.match(/CREATE TABLE /g)).toHaveLength(2);expect(sql.match(/ENGINE=InnoDB/g)).toHaveLength(2);expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|TRUNCATE|INSERT)\s+(TABLE|FROM|INTO|`)/i);
  const before=JSON.parse(read("meta/0003_snapshot.json")),after=JSON.parse(read("meta/0004_snapshot.json"));expect(after.prevId).toBe(before.id);for(const name of Object.keys(before.tables))expect(after.tables[name]).toEqual(before.tables[name]);expect(Object.keys(after.tables)).toHaveLength(25);
});
it("keeps Phase 2 migrations additive and declares InnoDB for new tables", () => {
  const sql = read("0002_phase2_operations.sql");
  expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|RENAME|MODIFY)\s+(TABLE|FROM|INTO|COLUMN|`)/i);
  expect(sql.match(/CREATE TABLE /g)).toHaveLength(6);
  expect(sql.match(/ENGINE=InnoDB/g)).toHaveLength(6);
  expect(sql).toContain("ALTER TABLE `inventory_blocks` ADD `releasedAt` timestamp");
});
it("preserves existing reservation, financial, user, and history schema definitions", () => {
  const before = JSON.parse(read("meta/0001_snapshot.json"));
  const after = JSON.parse(read("meta/0002_snapshot.json"));
  expect(after.prevId).toBe(before.id);
  for (const name of Object.keys(before.tables)) {
    if (name !== "inventory_blocks") expect(after.tables[name]).toEqual(before.tables[name]);
  }
  for (const name of Object.keys(before.tables.inventory_blocks.columns)) {
    expect(after.tables.inventory_blocks.columns[name]).toEqual(before.tables.inventory_blocks.columns[name]);
  }
  expect(Object.keys(after.tables)).toHaveLength(19);
});
