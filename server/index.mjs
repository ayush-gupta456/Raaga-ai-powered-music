import express from 'express';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMusicAPI } from '../lib/music.mjs';
import { fromNodeHeaders } from 'better-auth/node';
import { getRequest, setResponse } from 'better-call/node';
import { createAuthService, authConfiguration } from './auth.mjs';

export function createApp({env=process.env,api=createMusicAPI(),port=3000,getAuth=createAuthService(env)}={}) {
 const app=express();app.disable('x-powered-by');
 const origin=env.BETTER_AUTH_URL?new URL(env.BETTER_AUTH_URL).origin:`http://127.0.0.1:${port}`;
 app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');next();});
 app.get('/api/app-auth/session',async(req,res)=>{
  try{const config=authConfiguration(env);if(!config.configured)return res.json({user:null,configured:false,email:false,google:false,openai:false});
   const auth=await getAuth();const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
   res.json({configured:true,email:config.email,google:config.google,openai:config.openai,user:session?.user?.emailVerified?{id:session.user.id,name:session.user.name,email:session.user.email}:null});
  }catch{res.status(503).json({error:'Sign-in is temporarily unavailable. Please try again later.'});}
 });
 app.all('/api/auth/*splat',async(req,res)=>{
  if(Number(req.headers['content-length']||0)>32000)return res.status(413).json({message:'The request is too large.'});
  try{const auth=await getAuth();return await setResponse(res,await auth.handler(getRequest({request:req,base:origin,bodySizeLimit:32000})));}catch{if(!res.headersSent)res.status(503).json({message:'Sign-in is not configured or is temporarily unavailable.'});}
 });
 const requireUser=async(req,res,next)=>{
  try{const auth=await getAuth();const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
   if(!session?.user?.emailVerified)return res.status(401).json({error:'Please sign in with a verified account.'});
   res.locals.user=session.user;next();
  }catch{res.status(503).json({error:'Sign-in is temporarily unavailable.'});}
 };
 app.use('/api/music',requireUser,express.raw({type:'application/json',limit:'32kb'}),async(req,res)=>{
  const controller=new AbortController();
  const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
  try {
   const headers=new Headers({'content-type':req.headers['content-type']||'',origin:req.headers.origin||''});
   if(req.headers['x-ace-music-key']!==undefined)headers.set('x-ace-music-key',req.headers['x-ace-music-key']);
   // Identity comes exclusively from the verified backend session, never browser headers.
   headers.set('oai-authenticated-user-id',res.locals.user.id);
   const request=new Request(origin+req.originalUrl,{method:req.method,headers,signal:controller.signal,...(['GET','HEAD'].includes(req.method)?{}:{body:req.body?.length?new Uint8Array(req.body):''})});
   const response=await api(request,env);
   res.status(response.status);response.headers.forEach((value,key)=>{if(!env.VERCEL||key!=='content-length')res.setHeader(key,value);});
   if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
  }catch{if(!res.headersSent)res.status(502).json({error:'The music service is unavailable. Please retry.'});else res.end();}
 });
 app.get('/google.svg',(_req,res)=>res.sendFile(resolve('public/google.svg')));
 app.get('/favicon.svg',(_req,res)=>res.sendFile(resolve('public/favicon.svg')));
 app.use(express.static(resolve('dist-node'),{etag:false,lastModified:false}));
 app.get('/studio',requireUser,(_req,res)=>res.sendFile(resolve('dist-node/index.html')));
 app.get(['/', '/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email'],(_req,res)=>res.sendFile(resolve('dist-node/index.html')));
 app.use((error,_req,res,_next)=>{res.status(error.status===413?413:400).json({error:error.status===413?'The song request is too large.':'Invalid request.'});});
 return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.env.PORT)||3000;
 createApp({port}).listen(port,'127.0.0.1',()=>console.log(`Raaga: http://127.0.0.1:${port}`));
}
