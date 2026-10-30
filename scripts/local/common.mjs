import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const local = path.join(root, ".local");
export const schemas = ["southside_development", "southside_integration"];
export const marker = "southside-owned-local-mysql-v1";
export function readConfig() {
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(local, "database.json"), "utf8")); }
  catch { throw new Error("Private local database configuration is missing or invalid; its contents are not displayed."); }
  if (config.marker !== marker || config.host !== "127.0.0.1" || config.port !== 3307 || path.resolve(config.datadir) !== path.join(local, "mysql-data")) throw new Error("Refusing an unrecognized database configuration.");
  return config;
}
export function databaseUrl(config, database, account = "app") {
  if (!schemas.includes(database)) throw new Error("Refusing an unrecognized local schema.");
  const credentials = config[account];
  return `mysql://${encodeURIComponent(credentials.user)}:${encodeURIComponent(credentials.password)}@127.0.0.1:3307/${database}?timezone=Z`;
}
export async function connectLocal(database, account = "owner") {
  const config = readConfig();
  if (!schemas.includes(database)) throw new Error("Refusing a non-development database.");
  let connection;
  try {
    const credentials = account === "root" ? { user: "root", password: config.rootPassword } : config[account];
    connection = await mysql.createConnection({ host: config.host, port: config.port, database, user: credentials.user, password: credentials.password, timezone: "Z", connectTimeout: 5000 });
    const [rows] = await connection.query("SELECT @@datadir AS datadir, @@port AS port, VERSION() AS version");
    if (path.resolve(rows[0].datadir) !== path.resolve(config.datadir) || rows[0].port !== 3307 || Number(rows[0].version.split(".")[0]) < 8 || /mariadb/i.test(rows[0].version)) throw new Error("Ownership mismatch");
    await connection.query("SET time_zone = '+00:00'");
    return connection;
  } catch {
    if (connection) await connection.end().catch(() => {});
    throw new Error("Owned local MySQL is unavailable or failed its ownership/compatibility checks. No data operation was performed.");
  }
}
export function reportError(error) {
  // Do not print connection objects, SQL, URLs, passwords or original causes.
  console.error(error instanceof Error && !('sql' in error) && !('sqlMessage' in error) ? error.message : "Local database operation failed; no credentials or SQL are displayed.");
  process.exitCode = 1;
}
