import path from "node:path";
import {spawn} from "node:child_process";
import {root,readConfig,connectLocal,databaseUrl,schemas,reportError} from "./common.mjs";
async function main(){
  if(!process.argv.includes("--mock"))throw Error("This launcher supports only the approved local mock. Paystack network calls remain disabled.");
  const c=await connectLocal(schemas[0],"app");await c.end();
  const env={...process.env};for(const key of Object.keys(env))if(/^(PAYSTACK_|MANUS_|OAUTH_)/.test(key)||["OWNER_OPEN_ID","JWT_SECRET"].includes(key))delete env[key];
  Object.assign(env,{DATABASE_URL:databaseUrl(readConfig(),schemas[0]),NODE_ENV:"production",HOST:"127.0.0.1",PORT:"3001",STAFF_AUTH_ORIGIN:"http://127.0.0.1:3001",STAFF_AUTH_ALLOW_LOCAL_HTTP:"1",SOUTHSIDE_MEDIA_ROOT:path.join(root,".local/media-development"),SOUTHSIDE_PAYMENTS_MODE:"mock",SOUTHSIDE_PAYMENT_MOCK:"owned-local-v1",DOTENV_CONFIG_PATH:".local/no-env-file"});
  const child=spawn(process.execPath,["dist/index.js"],{cwd:root,env,windowsHide:true,stdio:"inherit"});child.on("error",()=>{console.error("Mock preview failed to start.");process.exitCode=1;});child.on("exit",code=>{process.exitCode=code??1;});
}main().catch(reportError);
