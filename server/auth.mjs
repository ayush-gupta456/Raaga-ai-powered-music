import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { MongoClient } from 'mongodb';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { decodeJwt } from 'jose';
import {emailConfiguration,createEmailSender} from './email.mjs';

// A registered website client is required. Never reuse Codex or Sites client IDs.
export function openAIProviderConfig(env) {
 const method=env.OPENAI_OAUTH_TOKEN_AUTH_METHOD||'client_secret_post';
 if(!['client_secret_post','client_secret_basic','none'].includes(method))throw Error('Unsupported OpenAI client authentication method.');
 return {
  providerId:'openai',name:'ChatGPT',clientId:env.OPENAI_OAUTH_CLIENT_ID,
  ...(method==='none'?{}:{clientSecret:env.OPENAI_OAUTH_CLIENT_SECRET}),
  tokenEndpointAuth:{method},discoveryUrl:'https://auth.openai.com/.well-known/openid-configuration',
  scopes:['openid','profile','email'],pkce:true,requireIdTokenVerification:true,
  requireEmailVerification:true,disableProviderLogout:true,
  // Generic OIDC verifies the signature, issuer, audience and nonce before this
  // callback. Require an ID token, rather than falling back to userinfo alone.
  getUserInfo:async tokens=>tokens.idToken?decodeJwt(tokens.idToken):null,
  accountSubject:({profile})=>{
   if(typeof profile.sub!=='string'||!profile.sub)throw Error('Missing verified OpenAI subject.');
   return JSON.stringify(['https://auth.openai.com',env.OPENAI_OAUTH_CLIENT_ID,profile.sub]);
  },
  mapProfileToUser:profile=>({emailVerified:profile.email_verified===true,name:typeof profile.name==='string'&&profile.name.trim()?profile.name:'Raaga listener'})
 };
}

export function authConfiguration(env) {
 const origin=new URL(env.BETTER_AUTH_URL||'http://127.0.0.1:3000').origin;
 const secure=origin.startsWith('https:');
 if(env.BETTER_AUTH_URL&&(env.NODE_ENV==='production'||env.VERCEL)&&!secure)throw Error('Production authentication requires HTTPS.');
 const configured=Boolean(env.MONGODB_URI&&env.BETTER_AUTH_SECRET?.length>=32&&env.BETTER_AUTH_URL);
 const openai=configured&&Boolean(env.OPENAI_OAUTH_CLIENT_ID&&(env.OPENAI_OAUTH_TOKEN_AUTH_METHOD==='none'||env.OPENAI_OAUTH_CLIENT_SECRET));
 return {origin,secure,configured,openai,email:configured&&emailConfiguration(env).enabled,google:configured&&Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET)};
}

export function buildAuth({env,database,sendMail,rateStorage='database',report=event=>console.info(JSON.stringify(event))}) {
 const config=authConfiguration(env);
 if(!config.configured)throw Error('Authentication is not configured.');
 return betterAuth({
  appName:'Raaga Studio',baseURL:config.origin,secret:env.BETTER_AUTH_SECRET,
  hooks:{before:createAuthMiddleware(async ctx=>{
   if(ctx.path!=='/send-verification-email')return;
   const email=ctx.body?.email;
   if(typeof email!=='string')return;
   try{const record=await ctx.context.internalAdapter.findUserByEmail(email.trim().toLowerCase());
    report({event:'auth_verification_request',account_state:!record?'missing':record.user.emailVerified?'already_verified':'pending_verification'});
   }catch{/* Diagnostics must not affect authentication. */}
  })},
  database,trustedOrigins:[config.origin],logger:{disabled:true},
  plugins:config.openai?[genericOAuth({config:[openAIProviderConfig(env)]})]:[],
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
    const sendMail=createEmailSender(env);
    return buildAuth({env,database:mongodbAdapter(db,{client}),sendMail});
   }catch(error){await client.close();throw error;}
  })().catch(error=>{pending=undefined;throw error;});
  return pending;
 };
}
