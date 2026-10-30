import path from "node:path";
import { spawn } from "node:child_process";
import { root, readConfig, connectLocal, databaseUrl, schemas, reportError } from "./common.mjs";

async function main() {
  const c = await connectLocal(schemas[1], "test");
  await c.end();
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(MANUS_|OAUTH_|PAYSTACK_)/.test(key) || ["OWNER_OPEN_ID", "JWT_SECRET"].includes(key)) delete env[key];
  Object.assign(env, { DATABASE_URL: databaseUrl(readConfig(), schemas[1], "test"), SOUTHSIDE_INTEGRATION: "1", HOST: "127.0.0.1", SOUTHSIDE_PAYMENTS_MODE: "mock", SOUTHSIDE_PAYMENT_MOCK: "owned-local-v1", STAFF_AUTH_ORIGIN: "http://127.0.0.1:3001", STAFF_AUTH_ALLOW_LOCAL_HTTP: "1", SOUTHSIDE_MEDIA_ROOT: path.join(root,".local/media-integration"), DOTENV_CONFIG_PATH: ".local/no-env-file" });
  if (process.argv.includes("--preserve-administrator")) env.SOUTHSIDE_PRESERVE_ADMIN = "1";
  const child = spawn(process.execPath, [path.join(root, "node_modules/vitest/vitest.mjs"), "run", "server/management/mysql.integration.test.ts", "server/auth/mysql.integration.test.ts", "server/payments/mysql.integration.test.ts"], { cwd: root, env, windowsHide: true, stdio: "inherit" });
  child.on("error", () => { console.error("Local integration runner failed to start."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
main().catch(reportError);
