import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {securityHeaders} from '../server/security.mjs';
import {createApp} from '../server/index.mjs';
import {authConfiguration} from '../server/auth.mjs';
test('browser security policy blocks framing, plugins, foreign form posts and untrusted scripts',()=>{
 const headers=securityHeaders({secure:true});assert.equal(headers['X-Frame-Options'],'DENY');assert.equal(headers['Referrer-Policy'],'no-referrer');assert.match(headers['Content-Security-Policy'],/object-src 'none'/);assert.match(headers['Content-Security-Policy'],/script-src 'self' https:\/\/\*\.posthog.com;/);assert.match(headers['Content-Security-Policy'],/form-action 'self'/);assert.match(headers['Content-Security-Policy'],/frame-ancestors 'none'/);assert.ok(!headers['Content-Security-Policy'].includes('unsafe-eval'));assert.ok(!headers['Content-Security-Policy'].includes("script-src 'unsafe-inline'"));assert.ok(headers['Strict-Transport-Security']);assert.equal(securityHeaders()['Strict-Transport-Security'],undefined);
});
test('Vercel requires HTTPS independently of NODE_ENV',()=>assert.throws(()=>authConfiguration({VERCEL:'1',BETTER_AUTH_URL:'http://raaga.test'})));
test('anonymous requests receive defensive headers and cannot access private music or environment files',async()=>{
 const app=createApp({env:{},getAuth:async()=>({api:{getSession:async()=>null}})});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{for(const path of ['/api/analytics/config','/api/music/status','/studio','/.env','/server/auth.mjs']){const r=await fetch(base+path,{redirect:'manual'});assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.ok(r.headers.get('content-security-policy'));if(path==='/api/music/status')assert.equal(r.status,401);if(path==='/studio'){assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/sign-in?reason=session-required');}if(path==='/.env'||path==='/server/auth.mjs')assert.equal(r.status,404);assert.equal(r.headers.get('x-powered-by'),null);}}finally{await new Promise(r=>server.close(r));}
});

test('studio navigations redirect missing, unverified and unavailable sessions to sign-in',async()=>{
 for(const [getSession,reason] of [[async()=>null,'session-required'],[async()=>({user:{id:'unverified',emailVerified:false}}),'verify-email'],[async()=>{throw Error('database unavailable');},'auth-unavailable']]){
  const app=createApp({env:{},pageFile:resolve('node-web/index.html'),getAuth:async()=>({api:{getSession}})});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{const response=await fetch(base+'/studio?next=https://untrusted.test',{redirect:'manual'});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/sign-in?reason='+reason);assert.match(response.headers.get('cache-control'),/no-store/);const page=await fetch(base+response.headers.get('location'));assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/text\/html/);const api=await fetch(base+'/api/music/status',{redirect:'manual'});assert.equal(api.status,reason==='auth-unavailable'?503:401);assert.equal(api.headers.get('location'),null);}finally{await new Promise(r=>server.close(r));}
 }
});

test('verified studio navigations still serve the application',async()=>{
 const app=createApp({env:{},pageFile:resolve('node-web/index.html'),getAuth:async()=>({api:{getSession:async()=>({user:{id:'verified',emailVerified:true}})}})});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{const response=await fetch(`http://127.0.0.1:${server.address().port}/studio`,{redirect:'manual'});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);}finally{await new Promise(r=>server.close(r));}
});
