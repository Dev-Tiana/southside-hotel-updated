import { sql } from "drizzle-orm";
import { ServiceFailure } from "../_core/diagnostics";
import type { getDb } from "../db";

export const operationalTables = ["users", "room_categories", "room_rates", "inventory_blocks", "guests", "reservations", "reservation_status_history", "booking_holds", "payments", "contact_submissions", "media_assets", "hotel_settings", "audit_logs", "physical_rooms", "inventory_policies", "room_assignments", "housekeeping_tasks", "room_maintenance", "reservation_amendments"];
operationalTables.push("staff_credentials", "staff_sessions", "staff_auth_limits", "staff_auth_setup");
operationalTables.push("booking_submissions", "booking_notifications");
operationalTables.push("payment_attempts","payment_events");
export function supportedDatabase(version: string, engines: Array<{ name: string; engine: string | null }>) {
  const major = Number(/^(\d+)\./.exec(version)?.[1] ?? 0);
  return major >= 8 && !/mariadb/i.test(version) && operationalTables.every(name => engines.some(row => row.name === name && row.engine?.toLowerCase() === "innodb"));
}
export async function assertOperationalDatabase(db: Awaited<ReturnType<typeof getDb>>) {
  const [versionRows] = await db.execute(sql`SELECT VERSION() AS version`);
  const [engineRows] = await db.execute(sql`SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`);
  const version = (versionRows as unknown as Array<{ version: string }>)[0]?.version ?? "";
  if (!supportedDatabase(version, engineRows as unknown as Array<{ name: string; engine: string | null }>)) throw new ServiceFailure("database_unavailable");
}
