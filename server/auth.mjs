import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { MongoClient } from 'mongodb';

export function authConfiguration(env) {
 const origin=new URL(env.BETTER_AUTH_URL||'http://127.0.0.1:3000').origin;
 const secure=origin.startsWith('https:');
 if(env.BETTER_AUTH_URL&&env.NODE_ENV==='production'&&!secure)throw Error('Production authentication requires HTTPS.');
 const configured=Boolean(env.MONGODB_URI&&env.BETTER_AUTH_SECRET?.length>=32&&env.BETTER_AUTH_URL);
 return {origin,secure,configured,email:configured&&Boolean(env.RESEND_API_KEY&&env.AUTH_EMAIL_FROM),google:configured&&Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET)};
}

export function buildAuth({env,database,sendMail,rateStorage='database'}) {
 const config=authConfiguration(env);
 if(!config.configured)throw Error('Authentication is not configured.');
 return betterAuth({
  appName:'Raaga Studio',baseURL:config.origin,secret:env.BETTER_AUTH_SECRET,
  database,trustedOrigins:[config.origin],logger:{disabled:true},
  emailAndPassword:{enabled:config.email,minPasswordLength:12,maxPasswordLength:128,requireEmailVerification:true,autoSignIn:false,revokeSessionsOnPasswordReset:true,resetPasswordTokenExpiresIn:1800,
   sendResetPassword:async({user,url})=>sendMail({to:user.email,subject:'Reset your Raaga password',text:`Reset your password using this link (expires in 30 minutes): ${url}\nIf you did not request this, ignore this email.`})},
  emailVerification:{sendOnSignUp:true,sendOnSignIn:true,autoSignInAfterVerification:false,expiresIn:3600,
   sendVerificationEmail:async({user,url})=>sendMail({to:user.email,subject:'Verify your Raaga email',text:`Verify your email to start creating music: ${url}\nThis link expires in one hour.`})},
  socialProviders:config.google?{google:{clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,prompt:'select_account',requireEmailVerification:true}}:{},
  // Never merge two identities solely because their email strings match.
  // Existing users sign in first, then explicitly link Google from their account menu.
  account:{encryptOAuthTokens:true,accountLinking:{enabled:true,trustedProviders:[],disableImplicitLinking:true,allowDifferentEmails:false}},
  session:{expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false}},
  advanced:{cookiePrefix:'raaga',useSecureCookies:config.secure,defaultCookieAttributes:{httpOnly:true,sameSite:'lax',secure:config.secure},ipAddress:{ipAddressHeaders:env.VERCEL?['x-vercel-forwarded-for']:[]}},
  rateLimit:{enabled:true,storage:rateStorage,window:60,max:60,customRules:{'/sign-in/email':{window:60,max:5},'/sign-up/email':{window:60,max:3},'/request-password-reset':{window:60,max:3},'/send-verification-email':{window:60,max:3}}},
  databaseHooks:{user:{create:{before:async user=>{if(!user.name?.trim()||user.name.trim().length>100)throw new APIError('BAD_REQUEST',{message:'Enter a name from 1 to 100 characters.'});return {data:{...user,email:user.email.trim().toLowerCase(),name:user.name.trim()}};}}}}
 });
}

export async function ensureAuthIndexes(db) {
 await Promise.all([
  db.collection('user').createIndex({email:1},{unique:true}),
  db.collection('session').createIndex({token:1},{unique:true}),
  db.collection('session').createIndex({expiresAt:1},{expireAfterSeconds:0}),
  db.collection('verification').createIndex({expiresAt:1},{expireAfterSeconds:0}),
  db.collection('account').createIndex({providerId:1,accountId:1},{unique:true}),
  db.collection('session').createIndex({userId:1}),
  db.collection('rateLimit').createIndex({key:1},{unique:true})
 ]);
}

export function createAuthService(env=process.env) {
 let pending;
 return async()=>{
  if(!pending)pending=(async()=>{
   if(!authConfiguration(env).configured)throw Error('Authentication is not configured.');
   const client=new MongoClient(env.MONGODB_URI,{maxPoolSize:5,serverSelectionTimeoutMS:8000,timeoutMS:15000});
   try{
    await client.connect();const db=client.db();await ensureAuthIndexes(db);
    const sendMail=async({to,subject,text})=>{
     const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.AUTH_EMAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(10000)});
     if(!response.ok)throw Error('Email delivery is unavailable.');
    };
    return buildAuth({env,database:mongodbAdapter(db,{client}),sendMail});
   }catch(error){await client.close();throw error;}
  })().catch(error=>{pending=undefined;throw error;});
  return pending;
 };
}
