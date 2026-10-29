import nodemailer from 'nodemailer';
// App-specific default requested by the owner. Override with GMAIL_USER when rotating accounts.
const DEFAULT_GMAIL_USER='create.personal456@gmail.com';
export function emailConfiguration(env){
 const password=(env.GMAIL_APP_PASSWORD||'').replace(/\s/g,'');
 const user=(env.GMAIL_USER||DEFAULT_GMAIL_USER).trim();
 if(env.GMAIL_APP_PASSWORD)return {provider:'gmail',enabled:/^[A-Za-z0-9]{16}$/.test(password)&&/^[^\s<>@,;]+@(?:gmail|googlemail)\.com$/i.test(user),user,password};
 return {provider:'resend',enabled:Boolean(env.RESEND_API_KEY&&env.AUTH_EMAIL_FROM)};
}
export function createEmailSender(env,{createTransport=options=>nodemailer.createTransport(options),fetcher=fetch}={}){
 const config=emailConfiguration(env);let transport;
 return async({to,subject,text})=>{
  if(!config.enabled)throw Error('Email delivery is not configured.');
  if(typeof to!=='string'||!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to))throw Error('Email delivery is unavailable.');
  try{
   if(config.provider==='gmail'){
    transport??=createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:config.user,pass:config.password},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,dnsTimeout:5000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
    const info=await transport.sendMail({from:{name:'Raaga Studio',address:config.user},to:{address:to},subject,text,disableFileAccess:true,disableUrlAccess:true});
    if(!info.accepted?.some(address=>String(address).toLowerCase()===to.toLowerCase()))throw Error('Recipient was not accepted.');
   }else{
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.AUTH_EMAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Provider rejected email.');
   }
  }catch{throw Error('Email delivery is temporarily unavailable. Please try again later.');}
 };
}
