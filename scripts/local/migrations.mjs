import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { local, root, schemas, connectLocal, reportError } from "./common.mjs";

export function review() {
  const directory = path.join(root, "drizzle");
  const journal = JSON.parse(fs.readFileSync(path.join(directory, "meta/_journal.json"), "utf8"));
  const entries = journal.entries.map((entry, index) => {
    if (entry.idx !== index || !/^\d{4}_[a-z0-9_]+$/.test(entry.tag)) throw new Error("Migration sequence is invalid.");
    const sql = fs.readFileSync(path.join(directory, entry.tag + ".sql"), "utf8");
    if (/\b(DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|RENAME\s+TABLE)\b/i.test(sql)) throw new Error("Migration review requires manual approval of destructive SQL.");
    const snapshot = JSON.parse(fs.readFileSync(path.join(directory, `meta/${String(index).padStart(4, "0")}_snapshot.json`), "utf8"));
    if (index > 0) {
      const previous = JSON.parse(fs.readFileSync(path.join(directory, `meta/${String(index - 1).padStart(4, "0")}_snapshot.json`), "utf8"));
      if (snapshot.prevId !== previous.id || entry.when <= journal.entries[index - 1].when) throw new Error("Migration snapshot/journal chain conflict.");
    }
    return { tag: entry.tag, timestamp: entry.when, hash: crypto.createHash("sha256").update(sql).digest("hex"), tablesCreated: [...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? `([^`]+)`/g)].map(match => match[1]) };
  });
  if (entries.flatMap(entry => entry.tablesCreated).length !== 27) throw new Error("Expected migration review baseline changed; inspect it before applying.");
  fs.mkdirSync(local, { recursive: true });
  fs.writeFileSync(path.join(local, "migration-review.json"), JSON.stringify(entries, null, 2));
  return entries;
}
async function main() {
  const entries = review();
  console.log(JSON.stringify({ migrations: entries.map(({ tag, tablesCreated }) => ({ tag, tablesCreated })), existingTableAddition: "inventory_blocks.releasedAt (nullable)", destructiveChanges: false }, null, 2));
  if (!process.argv.includes("--apply")) { console.log("Review only: no database connection or migration execution."); return; }
  for (const database of schemas) {
    const c = await connectLocal(database);
    try {
      const [tables] = await c.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
      const names = tables.map(row => row.name);
      let applied = [];
      if (names.includes("__drizzle_migrations")) [applied] = await c.query("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, id");
      if (names.length && !applied.length) throw new Error("Refusing a nonempty schema with no verified migration history.");
      if (applied.length > entries.length || applied.some((row, index) => row.hash !== entries[index].hash || Number(row.created_at) !== entries[index].timestamp)) throw new Error("Existing migration hashes/order differ. No migration was applied.");
      const allowed = new Set(entries.flatMap(entry => entry.tablesCreated).concat("__drizzle_migrations"));
      if (names.some(name => !allowed.has(name))) throw new Error("Unexpected tables exist in the local schema. Manual review is required.");
      const pendingTables = entries.slice(applied.length).flatMap(entry => entry.tablesCreated);
      if (pendingTables.some(name => names.includes(name))) throw new Error("A pending migration table already exists. Refusing a partial or conflicting migration; no SQL was applied.");
      console.log(`${database}: verified owned schema; ${entries.length - applied.length} pending migrations. Applying the reviewed history only.`);
      await migrate(drizzle(c), { migrationsFolder: path.join(root, "drizzle") });
      const [engines] = await c.query("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
      if (engines.some(row => row.engine !== "InnoDB")) throw new Error("Unexpected engine after local migration.");
      console.log(`${database}: migrations complete; ${engines.length - 1} application tables, InnoDB, no sample/user data inserted.`);
    } finally { await c.end(); }
  }
}
main().catch(reportError);
