import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { spawn } from "node:child_process";
import { hashPassword } from "../../server/auth/password.mjs";
import { root, readConfig, connectLocal, databaseUrl, schemas, reportError } from "./common.mjs";

async function main() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error("Port 3002 is occupied; no HTTP test request was sent.")));
    probe.listen(3002, "127.0.0.1", () => probe.close(resolve));
  });
  const c = await connectLocal(schemas[1], "test");
  const email = `http-${crypto.randomUUID()}@example.invalid`, password = `Fictional HTTP test ${crypto.randomUUID()}`;
  const base = "http://127.0.0.1:3002";
  let child, credentialId;
  try {
    const [user] = await c.execute("INSERT INTO users (openId, email, name, role) VALUES (?, ?, 'Fictional HTTP login check', 'user')", [crypto.randomUUID(), email]);
    const [credential] = await c.execute("INSERT INTO staff_credentials (userId, email, passwordHash, role, enabled) VALUES (?, ?, ?, 'user', 1)", [user.insertId, email, await hashPassword(password)]);
    credentialId = credential.insertId;
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(MANUS_|OAUTH_|PAYSTACK_)/.test(key) || key === "OWNER_OPEN_ID") delete env[key];
    Object.assign(env, { DATABASE_URL: databaseUrl(readConfig(), schemas[1], "test"), NODE_ENV: "production", HOST: "127.0.0.1", PORT: "3002", STAFF_AUTH_ORIGIN: base, STAFF_AUTH_ALLOW_LOCAL_HTTP: "1", SOUTHSIDE_PAYMENTS_MODE:"disabled", SOUTHSIDE_PAYMENT_MOCK:"", DOTENV_CONFIG_PATH: ".local/no-env-file" });
    child = spawn(process.execPath, ["dist/index.js"], { cwd: root, env, windowsHide: true, stdio: "ignore" });
    child.on("error", () => {});
    for (let attempt = 0; attempt < 60; attempt++) {
      if (child.exitCode !== null) throw new Error("The isolated HTTP test server could not start; check whether port 3002 is occupied.");
      try { const res = await fetch(base + "/api/health"); if (res.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const rpc = async (name, input, cookie, origin = base, post = true) => {
      const body = JSON.stringify({ json: input });
      const response = await fetch(base + "/api/trpc/" + name + (post ? "" : "?input=" + encodeURIComponent(body)), { method: post ? "POST" : "GET", headers: { "content-type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, ...(post ? { body } : {}) });
      return { status: response.status, cookie: response.headers.get("set-cookie"), body: await response.json() };
    };
    const denied = await rpc("auth.login", { email, password }, undefined, "https://attacker.invalid");
    assert.equal(denied.status, 403);
    const login = await rpc("auth.login", { email, password });
    assert.equal(login.status, 200);
    assert.ok(login.cookie?.includes("HttpOnly") && login.cookie.includes("SameSite=Strict"), "Protected session cookie missing");
    const cookie = login.cookie.split(";")[0]; // Never display or persist this bearer secret.
    const me = await rpc("auth.me", null, cookie, base, false);
    assert.equal(me.status, 200);
    assert.equal(me.body.result.data.json.role, "user");
    assert.equal((await rpc("admin.summary", null, cookie, base, false)).status, 403);
    const categoryDetails = { name: "Fictional denied category", description: "Permission check", maxOccupancy: 2, bedConfiguration: "Double", amenities: [], images: [], verification: "verified", reason: "Fictional HTTP authorization check" };
    assert.equal((await rpc("admin.category", { categoryId: 1 }, cookie, base, false)).status, 403);
    assert.equal((await rpc("admin.createCategory", { ...categoryDetails, slug: "denied-category" }, cookie)).status, 403);
    assert.equal((await rpc("admin.saveCategory", { ...categoryDetails, categoryId: 1, expectedRevision: "a".repeat(64), isActive: true }, cookie)).status, 403);
    assert.equal((await rpc("admin.categoryInventory", { categoryId: 1, expectedRevision: "a".repeat(64), sellableInventory: 1, reviewedCancellationIds: [], reconciliationAccepted: true, reason: categoryDetails.reason }, cookie)).status, 403);
    assert.equal((await rpc("admin.media", null, cookie, base, false)).status,403);
    assert.equal((await rpc("admin.notifications", null, cookie, base, false)).status,403);
    assert.equal((await rpc("admin.payments", null, undefined, base, false)).status,401);
    assert.equal((await rpc("admin.payments", null, cookie, base, false)).status,403);
    assert.equal((await rpc("admin.verifyPayment", {reference:`SST-${"a".repeat(32)}`}, cookie)).status,403);
    const paymentConfig=await rpc("payment.config",null,undefined,base,false);
    assert.deepEqual(paymentConfig.body.result.data.json,{enabled:false,mode:"disabled"});
    assert.equal((await fetch(base+"/api/paystack/initialize",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({submissionId:crypto.randomUUID(),requestId:crypto.randomUUID()})})).status,503);
    assert.equal((await rpc("admin.publishMedia", {id:1,rightsAcknowledged:true,reason:"Permission denial fixture"}, cookie)).status,403);
    const uploadHeaders={Origin:base,"content-type":"image/png","X-Media-Filename":"technical.png","X-Media-Alt":"Technical fixture"};
    assert.equal((await fetch(base+"/api/admin/media/upload",{method:"POST",headers:uploadHeaders,body:new Uint8Array([1])})).status,401);
    assert.equal((await fetch(base+"/api/admin/media/upload",{method:"POST",headers:{...uploadHeaders,Cookie:cookie},body:new Uint8Array([1])})).status,403);
    assert.equal((await rpc("auth.logout", null, cookie, "https://attacker.invalid")).status, 403);
    assert.equal((await rpc("auth.logout", null, cookie)).status, 200);
    assert.equal((await rpc("auth.me", null, cookie, base, false)).status, 401);
    assert.equal((await fetch(base+"/api/admin/media/upload",{method:"POST",headers:{...uploadHeaders,Cookie:cookie},body:new Uint8Array([1])})).status,401);
    assert.equal((await fetch(base + "/api/oauth/callback?code=retired&state=retired")).status, 410);
    console.log("Real HTTP authentication passed: password login, HttpOnly/Strict cookie, user lookup, ordinary-user denial, cross-origin denial, server logout/replay denial, and retired OAuth callback. No privileged account was created.");
  } finally {
    if (credentialId) {
      await c.execute("UPDATE staff_sessions SET revokedAt = NOW() WHERE credentialId = ?", [credentialId]);
      await c.execute("UPDATE staff_credentials SET enabled = 0 WHERE id = ?", [credentialId]);
    }
    if (child && child.exitCode === null) child.kill(); // Only this Node test server; never MySQL.
    await c.end();
  }
}
main().catch(reportError);
