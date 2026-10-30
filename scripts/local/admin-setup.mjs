import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../../server/auth/password.mjs";
import { connectLocal, schemas, reportError } from "./common.mjs";

export async function createInitialAdministrator(c, input, authorized) {
  if (authorized !== true) throw new Error("Explicit local administrator authorization is required.");
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email) || email.length > 254 || !name || name.length > 160) throw new Error("Enter a valid email and staff name.");
  const passwordHash = await hashPassword(input.password);
  await c.beginTransaction();
  try {
    await c.execute("INSERT INTO staff_auth_setup (id) VALUES (1) ON DUPLICATE KEY UPDATE id = 1");
    const [setup] = await c.query("SELECT completedAt FROM staff_auth_setup WHERE id = 1 FOR UPDATE");
    const [admins] = await c.query("SELECT id FROM staff_credentials WHERE role = 'admin' LIMIT 1");
    if (setup[0].completedAt || admins.length) throw new Error("Initial administrator setup is already completed or requires manual review; no account was created.");
    const [existing] = await c.execute("SELECT id FROM users WHERE LOWER(email) = ? UNION SELECT userId FROM staff_credentials WHERE email = ?", [email, email]);
    if (existing.length) throw new Error("This email already exists. Identity reconciliation requires explicit review; no account was linked or promoted.");
    const [user] = await c.execute("INSERT INTO users (openId, name, email, loginMethod, role) VALUES (?, ?, ?, 'password', 'user')", [`staff_${crypto.randomUUID()}`, name, email]);
    await c.execute("INSERT INTO staff_credentials (userId, email, passwordHash, role, enabled) VALUES (?, ?, ?, 'admin', 1)", [user.insertId, email, passwordHash]);
    await c.execute("UPDATE staff_auth_setup SET completedAt = NOW() WHERE id = 1");
    await c.execute("INSERT INTO audit_logs (actorId, actorType, action, entityType, entityId, details) VALUES (?, 'local_operator', 'staff.initial_admin.authorized', 'staff_auth', ?, ?)", [user.insertId, String(user.insertId), JSON.stringify({ authorization: "Explicit interactive local setup confirmation", role: "admin" })]);
    await c.commit();
  } catch (error) { await c.rollback(); throw error; }
}
async function main() {
  if (!process.argv.includes("--authorize-initial-admin")) throw new Error("No account was created. Use the reviewed interactive admin-setup.ps1 process to explicitly authorize initial setup.");
  let body = "";
  for await (const chunk of process.stdin) { body += chunk; if (body.length > 4096) throw new Error("Invalid setup input."); }
  let input;
  try { input = JSON.parse(body); }
  catch { throw new Error("Invalid setup input; no credentials are displayed."); }
  if (input.confirmation !== "CREATE LOCAL ADMINISTRATOR") throw new Error("Explicit setup confirmation missing.");
  const c = await connectLocal(schemas[0]);
  try { await createInitialAdministrator(c, input, true); }
  finally { input.password = ""; await c.end(); }
  console.log("Authorized local administrator created. Sign in at http://127.0.0.1:3001/staff/login. No password or session was displayed.");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(reportError);
