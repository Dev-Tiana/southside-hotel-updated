import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {root,local,readConfig,connectLocal,databaseUrl,schemas} from './common.mjs';

async function main(){
  const mode=process.argv[2];if(!['--preflight','--start'].includes(mode)||process.argv.length!==3)throw Error('Use --preflight or --start through the private Windows credential loader.');
  if(!/^sk_test_[A-Za-z0-9]+$/.test(process.env.PAYSTACK_SECRET_KEY??'')||!/^pk_test_[A-Za-z0-9]+$/.test(process.env.PAYSTACK_PUBLIC_KEY??''))throw Error('Matching test-prefixed keys must be entered privately. No values are displayed.');
  const c=await connectLocal(schemas[0],'app');let boundary;
  try{
    const[engines]=await c.query('SELECT TABLE_NAME name,ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    const snapshot=JSON.parse(fs.readFileSync(path.join(root,'drizzle/meta/0005_snapshot.json'),'utf8'));
    if(Object.keys(snapshot.tables).some(name=>!engines.some(r=>r.name===name&&r.engine==='InnoDB')))throw Error('Local schema readiness failed; no migrations will be run automatically.');
    const scopeFile=path.join(local,'phase9-payment-scope.json');
    if(fs.existsSync(scopeFile))boundary=JSON.parse(fs.readFileSync(scopeFile,'utf8'));
    else{const[rows]=await c.query('SELECT COALESCE(MAX(id),0) id FROM reservations');boundary={marker:'phase9-new-fictional-payments-v1',schema:schemas[0],minimumReservationId:Number(rows[0].id)};fs.writeFileSync(scopeFile,JSON.stringify(boundary,null,2),{flag:'wx'});}
    if(boundary.marker!=='phase9-new-fictional-payments-v1'||boundary.schema!==schemas[0]||!Number.isSafeInteger(boundary.minimumReservationId)||boundary.minimumReservationId<0)throw Error('The Phase 9 payment scope is invalid; manual review is required.');
  }finally{await c.end();}
  const env={...process.env};for(const key of Object.keys(env))if(/^(MANUS_|OAUTH_|PAYSTACK_|SOUTHSIDE_.*PAYMENT|VITE_.*(?:OAUTH|APP_ID))/.test(key)||['OWNER_OPEN_ID','JWT_SECRET','DATABASE_URL'].includes(key))delete env[key];
  Object.assign(env,{PAYSTACK_SECRET_KEY:process.env.PAYSTACK_SECRET_KEY,PAYSTACK_PUBLIC_KEY:process.env.PAYSTACK_PUBLIC_KEY,DATABASE_URL:databaseUrl(readConfig(),schemas[0]),NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3001',STAFF_AUTH_ORIGIN:'http://127.0.0.1:3001',STAFF_AUTH_ALLOW_LOCAL_HTTP:'1',SOUTHSIDE_MEDIA_ROOT:path.join(local,'media-development'),SOUTHSIDE_PAYMENTS_MODE:'test',SOUTHSIDE_PAYSTACK_CALLBACK_MODE:'omit',PAYSTACK_TEST_NETWORK_APPROVED:'1',SOUTHSIDE_PAYMENT_MOCK:'',SOUTHSIDE_PAYSTACK_WEBHOOKS:'disabled',SOUTHSIDE_PHASE9_BASELINE_ID:String(boundary.minimumReservationId),DOTENV_CONFIG_PATH:'.local/no-env-file'});
  console.log('Preflight passed: test-prefixed keys; test mode; owned southside_development; MySQL/InnoDB ready; loopback only; Phase 9 fictional scope; webhooks disabled. No Paystack API request has been made by this preflight.');
  if(mode==='--preflight')return;
  const child=spawn(process.execPath,['dist/index.js'],{cwd:root,env,windowsHide:true,stdio:'inherit'});
  child.on('error',()=>{console.error('The local test application could not start.');process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
  delete env.PAYSTACK_SECRET_KEY;delete env.PAYSTACK_PUBLIC_KEY;
}
main().catch(()=>{console.error('Private test preflight/start failed. Check the private credential store, owned MySQL readiness and port 3001. No secret values are displayed.');process.exitCode=1;});

