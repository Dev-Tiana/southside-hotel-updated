// Public GET-only UI verification. Never authenticates, uploads or submits bookings.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {auditBrowser,pause} from './audit-browser.mjs';
import {local} from './common.mjs';
const b=await auditBrowser(9224);const results=[];
async function navigate(route){await b.send('Page.navigate',{url:'http://127.0.0.1:3001'+route});await b.wait("document.readyState==='complete'&&!!document.querySelector('main')");await pause(800);}
async function size(width){await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await pause(150);assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);}
async function shot(name){const r=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(local,`phase10-presentation-${name}.png`),Buffer.from(r.data,'base64'));}
try{
 for(const route of ['/','/accommodation','/about','/facilities','/gallery']){
  await navigate(route);for(const width of [1440,390]){await size(width);await shot(`${route.slice(1)||'home'}-${width}`);results.push({route,width,noOverflow:true});}
 }
 await navigate('/gallery');
 for(const width of [1440,390]){
  await size(width);await b.wait("!!document.querySelector('.media-gallery-tile')");
  await b.evaluate("(()=>{const tile=document.querySelector('.media-gallery-tile');tile.focus();tile.click();return true;})()");await b.wait("document.querySelector('.media-viewer')?.open");
  await b.wait("document.querySelector('.media-viewer figure')?.dataset.unavailable==='true'");
  assert.equal(await b.evaluate("document.querySelector('.media-viewer header p').textContent.trim()"),'1 / 4');
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});await b.wait("document.querySelector('.media-viewer header p')?.textContent.trim()==='2 / 4'");
  await shot(`viewer-${width}`);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await b.wait("!document.querySelector('.media-viewer')?.open");
  assert.equal(await b.evaluate("document.body.style.overflow==='hidden'"),false);
  assert.equal(await b.evaluate("document.activeElement===document.querySelector('.media-gallery-tile')"),true);
 }
 await navigate('/accommodation');const room=await b.wait("document.querySelector('a[href^=\"/rooms/\"]')?.getAttribute('href')");await navigate(room);await b.wait("!!document.querySelector('.detail-art .media-gallery-tile')");for(const width of [1440,390])await size(width);
 await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const duration=await b.evaluate("(()=>{const img=document.createElement('img');const tile=document.querySelector('.media-gallery-tile');tile.append(img);const duration=getComputedStyle(img).transitionDuration;img.remove();return duration;})()");
 // Existing global accessibility CSS uses 0.01ms !important instead of literal zero.
 assert.ok(parseFloat(duration)<=0.001);await b.send('Emulation.setEmulatedMedia',{features:[]});
 const result={pages:results,galleryDesktopMobile:true,keyboardNavigation:true,escapeCloses:true,bodyScrollRestored:true,missingFullImageMessage:true,roomGallery:true,reducedMotion:true,noAuthenticationOrWrites:true};fs.writeFileSync(path.join(local,'phase10-presentation-results.json'),JSON.stringify(result));console.log(JSON.stringify(result));
}finally{b.close();}
