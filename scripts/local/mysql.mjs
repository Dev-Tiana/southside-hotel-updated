import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { spawn } from "node:child_process";
import { local, root, marker, schemas, readConfig, connectLocal, reportError } from "./common.mjs";

const version = "8.4.13";
const basedir = path.join(local, `mysql-${version}-winx64`);
const executable = path.join(basedir, "bin", "mysqld.exe");
const datadir = path.join(local, "mysql-data");
const configPath = path.join(local, "database.json");
const pidPath = path.join(local, "mysql.pid");
const random = () => crypto.randomBytes(32).toString("base64url");
const slashes = value => value.replaceAll("\\", "/");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", () => reject(new Error("Port 3307 is occupied. Refusing to contact or replace that server.")));
    socket.listen(3307, "127.0.0.1", () => socket.close(resolve));
  });
}
function run(args, logName) {
  const log = fs.openSync(path.join(local, logName), "a");
  const child = spawn(executable, args, { cwd: root, windowsHide: true, detached: true, stdio: ["ignore", log, log] });
  fs.closeSync(log);
  return child;
}
async function start(bootstrap) {
  await freePort();
  const args = ["--no-defaults", `--basedir=${slashes(basedir)}`, `--datadir=${slashes(datadir)}`, "--port=3307", "--bind-address=127.0.0.1", "--mysqlx=OFF", "--default-storage-engine=InnoDB", "--default-time-zone=+00:00", "--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci", "--local-infile=0", "--skip-log-bin", `--pid-file=${slashes(pidPath)}`, `--log-error=${slashes(path.join(local, "mysql-error.log"))}`];
  args.push("--skip-name-resolve", "--no-monitor");
  if (bootstrap) args.push(`--init-file=${slashes(bootstrap)}`);
  const child = run(args, "mysql-console.log");
  let failed;
  child.once("error", () => { failed = true; });
  child.once("exit", () => { failed = true; });
  child.unref();
  for (let attempt = 0; attempt < 90; attempt++) {
    if (failed) throw new Error("The local MySQL process stopped. Inspect the private .local/mysql-error.log; no existing database was modified.");
    try {
      const connection = await connectLocal(schemas[0]);
      const [rows] = await connection.query("SELECT VERSION() AS version, @@default_storage_engine AS engine");
      await connection.end();
      if (bootstrap) fs.unlinkSync(bootstrap); // This exact generated private file contains bootstrap credentials.
      console.log(`Owned local MySQL ${rows[0].version} (${rows[0].engine}) is ready on 127.0.0.1:3307. No application migrations were executed.`);
      return;
    } catch { await delay(1000); }
  }
  throw new Error("Local MySQL did not become ready. No application migrations were executed; inspect its private error log.");
}
async function main() {
  const command = process.argv[2];
  if (command === "status") {
    const c = await connectLocal(schemas[0]);
    const [rows] = await c.query("SELECT VERSION() AS version, @@default_storage_engine AS engine");
    await c.end(); console.log(JSON.stringify({ ready: true, version: rows[0].version, engine: rows[0].engine, port: 3307 })); return;
  }
  if (command === "stop") {
    const verified = await connectLocal(schemas[0]);
    const [rows] = await verified.query("SELECT @@pid_file AS pidFile");
    await verified.end();
    if (path.resolve(rows[0].pidFile) !== pidPath) throw new Error("Refusing an unrecognized PID file.");
    const serverPid = fs.readFileSync(pidPath, "utf8").trim();
    if (!/^[1-9]\d*$/.test(serverPid)) throw new Error("Invalid local server PID.");
    // MySQL's native Windows shutdown event requests an orderly InnoDB shutdown.
    // The helper independently validates the executable; it never kills a process.
    const helper = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "RemoteSigned", "-File", path.join(root, "scripts/local/stop-mysql.ps1"), "-ServerProcessId", serverPid], { windowsHide: true, stdio: "inherit" });
    const code = await new Promise((resolve, reject) => { helper.once("error", reject); helper.once("exit", resolve); });
    if (code !== 0) throw new Error("Safe local shutdown failed; no process was forcibly terminated.");
    return;
  }
  if (!fs.existsSync(executable)) throw new Error("The verified portable MySQL archive must be extracted under .local first.");
  if (command === "start") { readConfig(); return start(); }
  if (command !== "init") throw new Error("Use: node scripts/local/mysql.mjs init|start|status|stop");
  if (fs.existsSync(configPath) || fs.existsSync(datadir)) throw new Error("Refusing to reinitialize an existing data directory/configuration. Use status/start; no automatic reset is provided.");
  await freePort(); fs.mkdirSync(local, { recursive: true });
  const config = { marker, host: "127.0.0.1", port: 3307, datadir,
    rootPassword: random(), owner: { user: "southside_owner", password: random() }, app: { user: "southside_app", password: random() }, test: { user: "southside_test", password: random() } };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { flag: "wx", mode: 0o600 });
  const initialized = run(["--no-defaults", `--basedir=${slashes(basedir)}`, `--datadir=${slashes(datadir)}`, "--initialize-insecure"], "mysql-initialize.log");
  const code = await new Promise((resolve, reject) => { initialized.once("error", () => reject(new Error("Unable to initialize the owned local database."))); initialized.once("exit", resolve); });
  if (code !== 0) throw new Error("Local initialization failed. Inspect .local/mysql-initialize.log; no automatic retry/reset will overwrite it.");
  // Initialization is offline (no listening socket). Startup secures root and
  // creates private DB accounts via init-file before accepting normal clients.
  const lines = [`ALTER USER 'root'@'localhost' IDENTIFIED BY '${config.rootPassword}'`];
  for (const database of schemas) lines.push(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  for (const role of ["owner", "app", "test"]) {
    const account = config[role];
    lines.push(`CREATE USER '${account.user}'@'127.0.0.1' IDENTIFIED BY '${account.password}'`);
    for (const database of role === "owner" ? schemas : [role === "app" ? schemas[0] : schemas[1]]) lines.push(`GRANT ${role === "owner" ? "ALL PRIVILEGES" : "SELECT, INSERT, UPDATE, DELETE"} ON \`${database}\`.* TO '${account.user}'@'127.0.0.1'`);
  }
  const bootstrap = path.join(local, "mysql-bootstrap.sql");
  fs.writeFileSync(bootstrap, lines.map(line => line + ";").join("\n"), { mode: 0o600 });
  await start(bootstrap);
}
main().catch(reportError);
