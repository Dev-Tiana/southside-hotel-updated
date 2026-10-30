import { spawn } from "node:child_process";
import path from "node:path";
import { root, readConfig, connectLocal, databaseUrl, schemas, reportError } from "./common.mjs";

async function main() {
  const c = await connectLocal(schemas[0], "app");
  await c.end();
  const env = { ...process.env };
  // Independent staff login; Manus and payment services stay disabled.
  for (const key of Object.keys(env)) if (/^(MANUS_|OAUTH_|PAYSTACK_|VITE_.*(?:OAUTH|APP_ID))/.test(key) || ["OWNER_OPEN_ID", "JWT_SECRET"].includes(key)) delete env[key];
  Object.assign(env, { DATABASE_URL: databaseUrl(readConfig(), schemas[0]), NODE_ENV: "production", HOST: "127.0.0.1", PORT: "3001", STAFF_AUTH_ORIGIN: "http://127.0.0.1:3001", STAFF_AUTH_ALLOW_LOCAL_HTTP: "1", SOUTHSIDE_PAYMENTS_MODE: "disabled", SOUTHSIDE_PAYMENT_MOCK: "", SOUTHSIDE_MEDIA_ROOT: path.join(root,".local/media-development"), DOTENV_CONFIG_PATH: ".local/no-env-file" });
  const child = spawn(process.execPath, ["dist/index.js"], { cwd: root, env, windowsHide: true, stdio: "inherit" });
  child.on("error", () => { console.error("Local application failed to start."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
main().catch(reportError);
