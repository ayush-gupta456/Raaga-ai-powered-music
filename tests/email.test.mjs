import {test} from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import {emailConfiguration,createEmailSender} from '../server/email.mjs';
import {authConfiguration} from '../server/auth.mjs';
const env={GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop'};
test('saved Gmail app password enables email without a Resend domain',()=>{
 const config=emailConfiguration(env);assert.equal(config.enabled,true);assert.equal(config.user,'create.personal456@gmail.com');assert.equal(config.password,'abcdefghijklmnop');assert.equal(config.provider,'gmail');assert.equal(authConfiguration({...env,MONGODB_URI:'test',BETTER_AUTH_SECRET:'test-secret-at-least-thirty-two-characters',BETTER_AUTH_URL:'https://raaga.test'}).email,true);
});
test('invalid Gmail configuration fails closed instead of silently falling back',()=>{
 assert.equal(emailConfiguration({GMAIL_APP_PASSWORD:'bad',RESEND_API_KEY:'present',AUTH_EMAIL_FROM:'sender@example.test'}).enabled,false);assert.equal(emailConfiguration({...env,GMAIL_USER:'bad\r\nuser@gmail.com'}).enabled,false);assert.equal(emailConfiguration({}).enabled,false);
});
test('Gmail SMTP uses strict TLS and authenticates with the saved app password',async()=>{
 let created=0;const sender=createEmailSender(env,{createTransport:options=>{created++;assert.equal(options.host,'smtp.gmail.com');assert.equal(options.port,465);assert.equal(options.secure,true);assert.equal(options.auth.user,'create.personal456@gmail.com');assert.equal(options.auth.pass,'abcdefghijklmnop');assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.logger,false);assert.equal(options.disableFileAccess,true);return {sendMail:async message=>{assert.equal(message.from.address,options.auth.user);assert.equal(message.from.name,'Raaga Studio');assert.equal(message.to.address,'listener@example.test');return {accepted:['listener@example.test']};}};}});
 await sender({to:'listener@example.test',subject:'Verify your Raaga email',text:'test-only verification'});await sender({to:'listener@example.test',subject:'Reset your Raaga password',text:'test-only reset'});assert.equal(created,1);
});
test('SMTP failures never expose credentials or provider responses',async()=>{
 const sender=createEmailSender(env,{createTransport:()=>({sendMail:async()=>{throw Error('secret password abcdefghijklmnop and server response');}})});await assert.rejects(()=>sender({to:'listener@example.test',subject:'Test',text:'Test'}),error=>!error.message.includes('abcdefghijklmnop')&&!error.message.includes('server response'));
 const rejected=createEmailSender(env,{createTransport:()=>({sendMail:async()=>({accepted:[]})})});await assert.rejects(()=>rejected({to:'listener@example.test',subject:'Test',text:'Test'}));
 await assert.rejects(()=>sender({to:'a@example.test,b@example.test',subject:'Test',text:'Test'}));
});
test('real Nodemailer composes the authenticated sender and only one recipient',async()=>{
 const sender=createEmailSender(env,{createTransport:()=>{const transport=nodemailer.createTransport({jsonTransport:true});return {sendMail:async message=>{const result=await transport.sendMail(message);const parsed=JSON.parse(result.message);assert.equal(parsed.from.address,'create.personal456@gmail.com');assert.equal(parsed.to.length,1);assert.equal(parsed.text,'Verification link stays in email');return {accepted:['listener@example.test']};}};}});await sender({to:'listener@example.test',subject:'Verify your Raaga email',text:'Verification link stays in email'});
});
test('Resend remains supported when Gmail has not been configured',async()=>{
 let sent=false;const sender=createEmailSender({RESEND_API_KEY:'test-only',AUTH_EMAIL_FROM:'sender@example.test'},{fetcher:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.deepEqual(JSON.parse(options.body).to,['listener@example.test']);sent=true;return Response.json({id:'test'});}});await sender({to:'listener@example.test',subject:'Test',text:'Test'});assert.equal(sent,true);
});
