import {test} from 'node:test';
import assert from 'node:assert/strict';
import {securityHeaders} from '../server/security.mjs';
import {createApp} from '../server/index.mjs';
import {authConfiguration} from '../server/auth.mjs';
test('browser security policy blocks framing, plugins, foreign form posts and untrusted scripts',()=>{
 const headers=securityHeaders({secure:true});assert.equal(headers['X-Frame-Options'],'DENY');assert.equal(headers['Referrer-Policy'],'no-referrer');assert.match(headers['Content-Security-Policy'],/object-src 'none'/);assert.match(headers['Content-Security-Policy'],/script-src 'self' https:\/\/\*\.posthog.com;/);assert.match(headers['Content-Security-Policy'],/form-action 'self'/);assert.match(headers['Content-Security-Policy'],/frame-ancestors 'none'/);assert.ok(!headers['Content-Security-Policy'].includes('unsafe-eval'));assert.ok(!headers['Content-Security-Policy'].includes("script-src 'unsafe-inline'"));assert.ok(headers['Strict-Transport-Security']);assert.equal(securityHeaders()['Strict-Transport-Security'],undefined);
});
test('Vercel requires HTTPS independently of NODE_ENV',()=>assert.throws(()=>authConfiguration({VERCEL:'1',BETTER_AUTH_URL:'http://raaga.test'})));
test('anonymous requests receive defensive headers and cannot access private music or environment files',async()=>{
 const app=createApp({env:{},getAuth:async()=>({api:{getSession:async()=>null}})});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{for(const path of ['/api/analytics/config','/api/music/status','/studio','/.env','/server/auth.mjs']){const r=await fetch(base+path);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.ok(r.headers.get('content-security-policy'));if(path==='/api/music/status'||path==='/studio')assert.equal(r.status,401);if(path==='/.env'||path==='/server/auth.mjs')assert.equal(r.status,404);assert.equal(r.headers.get('x-powered-by'),null);}}finally{await new Promise(r=>server.close(r));}
});
