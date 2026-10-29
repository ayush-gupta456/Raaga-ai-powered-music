import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryAdapter} from 'better-auth/adapters/memory';
import {buildAuth,authConfiguration,openAIProviderConfig} from '../server/auth.mjs';
import {createApp} from '../server/index.mjs';
const origin='http://127.0.0.1:3000';
const env={MONGODB_URI:'mongodb://test-only',BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:'test-only-secret-with-more-than-thirty-two-characters',RESEND_API_KEY:'test',AUTH_EMAIL_FROM:'test@example.com'};
function fixture(extra={}){
 const db={user:[],session:[],account:[],verification:[],rateLimit:[]},mail=[];
 const auth=buildAuth({env:{...env,...extra},database:memoryAdapter(db),sendMail:async message=>{mail.push(message);},rateStorage:'database'});
 const call=async(path,body,cookie='')=>auth.handler(new Request(origin+'/api/auth/'+path,{method:body?'POST':'GET',headers:{origin,'Content-Type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}));
 return {db,mail,auth,call};
}
const signup={name:'Raaga Test',email:'raaga-test@example.com',password:'a-long-test-password!'};
const cookieOf=r=>r.headers.get('set-cookie')?.split(';')[0]||'';
test('real Better Auth lifecycle using isolated in-memory adapter: verify, login, reset, logout',async()=>{
 const {call,mail,db}=fixture();
 assert.equal((await call('sign-up/email',signup)).status,200);
 assert.equal(db.user.length,1);assert.equal(db.user[0].emailVerified,false);
 assert.notEqual(db.account[0].password,signup.password);assert.ok(db.account[0].password.length>64);
 assert.equal((await call('sign-in/email',{email:signup.email,password:'wrong-password'})).status,401);
 assert.equal((await call('sign-in/email',{email:signup.email,password:signup.password})).status,403);
 assert.equal(mail.length>=1,true);
 const verifyURL=mail.find(m=>m.subject.includes('Verify')).text.match(/https?:\/\/\S+/)[0];
 assert.equal((await call('sign-up/email',signup)).status,200);assert.equal(db.user.length,1);
 const verified=await call('verify-email?token='+new URL(verifyURL).searchParams.get('token'));assert.equal(verified.status,200);
 const login=await call('sign-in/email',{email:signup.email,password:signup.password});assert.equal(login.status,200);
 const cookie=cookieOf(login);assert.match(cookie,/raaga.session_token=/);assert.match(login.headers.get('set-cookie'),/HttpOnly/i);assert.match(login.headers.get('set-cookie'),/SameSite=Lax/i);
 assert.ok((await (await call('get-session',null,cookie)).json()).user);
 assert.equal((await call('sign-out',{},cookie)).status,200);
 assert.equal(await (await call('get-session',null,cookie)).json(),null);
 await call('request-password-reset',{email:signup.email,redirectTo:origin+'/reset-password'});
 const resetURL=mail.find(m=>m.subject.includes('Reset')).text.match(/https?:\/\/\S+/)[0];
 const token=new URL(resetURL).pathname.split('/').pop();
 assert.equal((await call('reset-password',{newPassword:'another-long-password!',token})).status,200);
 assert.equal((await call('reset-password',{newPassword:'another-long-password!',token})).status,400);
 assert.equal((await call('sign-in/email',{email:signup.email,password:signup.password})).status,401);
 assert.equal((await call('sign-in/email',{email:signup.email,password:'another-long-password!'})).status,200);
});
test('origin checks, weak passwords and tampered Google token are rejected',async()=>{
 const {call,auth}=fixture({GOOGLE_CLIENT_ID:'test-client-id',GOOGLE_CLIENT_SECRET:'test-client-secret'});
 assert.equal((await call('sign-up/email',{...signup,password:'short'})).status,400);
 const attack=await auth.handler(new Request(origin+'/api/auth/sign-up/email',{method:'POST',headers:{origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify(signup)}));assert.equal(attack.status,403);
 assert.equal((await call('sign-in/social',{provider:'google',idToken:{token:'forged'}})).status>=400,true);
 assert.equal(auth.options.account.accountLinking.disableImplicitLinking,true);
});
test('production config requires HTTPS and credentials, and never enables an unconfigured provider',()=>{
 assert.throws(()=>authConfiguration({...env,NODE_ENV:'production'}));
 assert.equal(authConfiguration({}).configured,false);
 assert.equal(authConfiguration(env).google,false);
 assert.equal(authConfiguration({...env,GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret'}).google,true);
});
test('OpenAI sign-in is gated by registration and binds verified subject to issuer and client',async()=>{
 assert.equal(authConfiguration(env).openai,false);
 const registered={...env,OPENAI_OAUTH_CLIENT_ID:'oaiapp_test',OPENAI_OAUTH_CLIENT_SECRET:'test-only'};
 assert.equal(authConfiguration(registered).openai,true);
 const provider=openAIProviderConfig(registered);
 assert.equal(provider.requireIdTokenVerification,true);assert.equal(provider.pkce,true);
 assert.equal(provider.disableIdTokenNonceBinding,undefined);
 assert.equal(provider.discoveryUrl,'https://auth.openai.com/.well-known/openid-configuration');
 assert.equal(provider.requireEmailVerification,true);
 assert.equal(await provider.getUserInfo({accessToken:'not-an-id-token'}),null);
 assert.deepEqual(JSON.parse(provider.accountSubject({profile:{sub:'stable-id',email:'mutable@example.com'}})),['https://auth.openai.com','oaiapp_test','stable-id']);
 assert.throws(()=>provider.accountSubject({profile:{email:'mutable@example.com'}}));
 assert.equal(provider.mapProfileToUser({email_verified:'true'}).emailVerified,false);
 assert.throws(()=>openAIProviderConfig({...registered,OPENAI_OAUTH_TOKEN_AUTH_METHOD:'unsafe'}));
 const publicClient=openAIProviderConfig({...registered,OPENAI_OAUTH_TOKEN_AUTH_METHOD:'none'});assert.equal(publicClient.clientSecret,undefined);
});
test('Express rejects anonymous and forged identity requests to private music routes',async()=>{
 const app=createApp({env,getAuth:async()=>({api:{getSession:async()=>null}})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/music/status`,{headers:{'oai-authenticated-user-id':'forged'}});assert.equal(r.status,401);}finally{await new Promise(r=>server.close(r));}
});
test('Express auth HTTP adapter enforces sessions and logout using the real library',async()=>{
 const {auth,call,mail}=fixture();
 await call('sign-up/email',{...signup,email:'http-test@example.com'});
 const link=mail[0].text.match(/https?:\/\/\S+/)[0];
 await call('verify-email?token='+new URL(link).searchParams.get('token'));
 const app=createApp({env,getAuth:async()=>auth});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const logo=await fetch(base+'/google.svg');assert.equal(logo.status,200);assert.match(logo.headers.get('content-type'),/svg/);
  const login=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email:'http-test@example.com',password:signup.password})});
  assert.equal(login.status,200);const cookie=cookieOf(login);assert.ok(cookie);
  assert.equal((await fetch(base+'/api/music/status',{headers:{cookie}})).status,200);
  const safe=await (await fetch(base+'/api/app-auth/session',{headers:{cookie}})).json();assert.equal(safe.user.email,'http-test@example.com');assert.equal(safe.session,undefined);
  const logout=await fetch(base+'/api/auth/sign-out',{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(logout.status,200);
  assert.equal((await fetch(base+'/api/music/status',{headers:{cookie}})).status,401);
 }finally{await new Promise(r=>server.close(r));}
});
