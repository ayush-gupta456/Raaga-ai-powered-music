"use client";
import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react';
import MusicStudio from './music-studio';
import {identifyUser,track} from '../client/analytics';

type User={id:string;name:string;email:string};
type AuthState={configured:boolean;email:boolean;google:boolean;openai?:boolean;user:User|null};
type View='sign-in'|'sign-up'|'forgot-password'|'reset-password'|'verify-email';
const titles:Record<View,string>={'sign-in':'Welcome back','sign-up':'Create account','forgot-password':'Reset your password','reset-password':'Choose a new password','verify-email':'Check your inbox'};
async function authRequest(path:string,body:Record<string,unknown>){
 const response=await fetch('/api/auth/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({})) as {message?:string;url?:string};
 if(!response.ok)throw Error(response.status===429?'Too many attempts. Please wait a minute before trying again.':data.message||'Sign-in is unavailable. Please try again.');
 return data;
}
function initialView():View {const path=window.location.pathname.slice(1);return path in titles?path as View:'sign-in';}

export default function AuthenticatedStudio(){
 const [state,setState]=useState<AuthState|null>(null),[checking,setChecking]=useState(true),[error,setError]=useState('');
 const [view,setView]=useState<View>(initialView),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/app-auth/session',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('Sign-in is temporarily unavailable.');setState(await r.json() as AuthState);setError('');}catch{setError('Cannot reach sign-in. Check your connection and reload.');}finally{setChecking(false);}},[]);
 useEffect(()=>{const controller=new AbortController();fetch('/api/app-auth/session',{cache:'no-store',credentials:'same-origin',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return await r.json() as AuthState;}).then(setState).catch(()=>{if(!controller.signal.aborted)setError('Cannot reach sign-in. Check your connection and reload.');}).finally(()=>{if(!controller.signal.aborted)setChecking(false);});const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{controller.abort();window.removeEventListener('focus',focus);};},[refresh]);
 useEffect(()=>{if(checking)return;identifyUser(state?.user?.id||null);track('page_viewed',{view:state?.user?.id?'studio':view});},[checking,state?.user?.id,view]);
 function change(next:View){setView(next);setError('');setMessage('');setPassword('');setConfirm('');setShow(false);window.history.replaceState(null,'','/'+next);}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;setError('');setMessage('');
  if((view==='sign-up'||view==='reset-password')&&(password.length<12||password.length>128)){setError('Use a password with 12–128 characters.');return;}
  if((view==='sign-up'||view==='reset-password')&&password!==confirm){setError('Passwords do not match.');return;}
  setBusy(true);
  try{
   const normalized=email.trim().toLowerCase();
   if(view==='sign-up'){
    await authRequest('sign-up/email',{name:name.trim(),email:normalized,password,callbackURL:'/sign-in'});
    track('account_created');setPassword('');setConfirm('');setView('verify-email');setMessage('If this email can be registered, a verification link is on its way. Already have an account? Sign in or reset your password.');
   }else if(view==='sign-in'){
    await authRequest('sign-in/email',{email:normalized,password,callbackURL:'/studio'});setPassword('');track('sign_in_completed');await refresh();window.history.replaceState(null,'','/studio');
   }else if(view==='forgot-password'){
    await authRequest('request-password-reset',{email:normalized,redirectTo:window.location.origin+'/reset-password'});setMessage('If an account exists for this email, you will receive a reset link.');
   }else if(view==='verify-email'){
    await authRequest('send-verification-email',{email:normalized,callbackURL:'/sign-in'});setMessage('If verification is needed, a new link is on its way.');
   }else{
    const token=new URLSearchParams(window.location.search).get('token');if(!token)throw Error('This reset link is missing or expired. Request a new one.');
    await authRequest('reset-password',{newPassword:password,token});change('sign-in');setMessage('Password updated. Sign in with your new password.');
   }
  }catch(e){setError(e instanceof Error?e.message:'Something went wrong. Please try again.');}finally{setBusy(false);}
 }
 async function social(provider:'google'|'openai',link=false){if(busy)return;setBusy(true);setError('');try{const data=await authRequest(link?'link-social':'sign-in/social',{provider,callbackURL:window.location.origin+'/studio',errorCallbackURL:window.location.origin+'/sign-in',disableRedirect:true});if(!data.url)throw Error('Sign-in is unavailable.');const url=new URL(data.url);if(url.origin!==(provider==='openai'?'https://auth.openai.com':'https://accounts.google.com'))throw Error('Unexpected sign-in destination.');window.location.assign(url.href);}catch(e){setError(e instanceof Error?e.message:'Sign-in could not be completed.');setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{await authRequest('sign-out',{});track('sign_out_completed');identifyUser(null);setState(current=>current?{...current,user:null}:null);change('sign-in');}catch{setError('Could not sign out. Please try again.');}finally{setBusy(false);}}
 if(checking)return <div className="auth-loading" role="status">Opening your studio…</div>;
 if(state?.user)return <><div className="account-bar"><span><ShieldCheck size={16}/>{state.user.name}</span>{state.openai&&<button disabled={busy} onClick={()=>void social('openai',true)}>Link ChatGPT</button>}{state.google&&<button disabled={busy} onClick={()=>void social('google',true)}>Link Google</button>}<button disabled={busy} onClick={()=>void logout()}><LogOut size={16}/>Sign out</button>{error&&<span role="alert">{error}</span>}</div><MusicStudio/></>;
 const passwordView=view==='sign-in'||view==='sign-up'||view==='reset-password';
 return <main className="auth-page"><a href="/" className="auth-brand"><span>r</span>raaga.</a><div className="auth-layout"><section className="auth-story"><span className="eyebrow">YOUR PERSONAL MUSIC STUDIO</span><div className="auth-edition">INDEPENDENT IDEAS. ORIGINAL SOUNDS.</div><h1>Some things<br/>sound better<br/><em>as a song.</em></h1><p>Your words. Your musical direction.<br/>A space to make something of your own.</p><div className="auth-record" aria-hidden="true"><span>RAAGA<br/>SESSIONS</span></div></section><section className="auth-card"><span className="eyebrow">YOUR NEXT ORIGINAL STARTS HERE</span><h2>{titles[view]}</h2><p className="auth-intro">{view==='sign-in'?'Sign in to bring your next song to life.':view==='sign-up'?'Your next original starts here.':view==='reset-password'?'Choose a strong password you haven’t used elsewhere.':'We’ll help you get back to your music.'}</p>
 {!state?.configured&&<p className="auth-notice" role="status">Account sign-in is being configured. Please try again shortly.</p>}
 {new URLSearchParams(window.location.search).has('error')&&<p className="error" role="alert">That sign-in or verification link could not be completed. Try again, or sign in with your existing method before linking Google.</p>}
 {state?.configured&&!state.email&&<p className="auth-notice">Email sign-in is awaiting email delivery setup.{state.google?' Continue with Google to enter your studio.':''}</p>}{state?.email&&<form onSubmit={submit}><fieldset disabled={busy||!state?.email} className="composer-fields">
 {view==='sign-up'&&<><label htmlFor="auth-name">Full name</label><input id="auth-name" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" minLength={1} maxLength={100} required/></>}
 {view!=='reset-password'&&<><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" maxLength={254} required/></>}
 {passwordView&&<><label htmlFor="auth-password">{view==='reset-password'?'New password':'Password'}</label><div className="password-input"><input id="auth-password" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={view==='sign-in'?'current-password':'new-password'} minLength={view==='sign-in'?1:12} maxLength={128} required/><button type="button" aria-label={show?'Hide password':'Show password'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{view!=='sign-in'&&<small>At least 12 characters. Use a unique password.</small>}</>}
 {(view==='sign-up'||view==='reset-password')&&<><label htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" maxLength={128} required/></>}
 {view==='sign-in'&&<button className="auth-link forgot-link" type="button" onClick={()=>change('forgot-password')}>Forgot password?</button>}
 <button className="primary" type="submit">{busy?'Please wait…':view==='sign-up'?'Create Account':view==='sign-in'?'Sign In':view==='reset-password'?'Update Password':view==='verify-email'?'Resend verification email':'Send reset link'}</button></fieldset></form>}
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="auth-notice" role="status">{message}</p>}
 {view==='sign-in'&&state?.email&&<button className="auth-link" disabled={busy} onClick={()=>change('verify-email')}>Resend verification email</button>}
 {(view==='sign-in'||view==='sign-up')&&<>{state?.email&&<div className="auth-divider"><span>OR</span></div>}{state?.openai&&<button className="chatgpt-button" type="button" disabled={busy} onClick={()=>void social('openai')}>Continue with ChatGPT</button>}<button className="google-button" type="button" disabled={busy||!state?.google} onClick={()=>void social('google')}><img src="/google.svg" width="20" height="20" alt=""/>Continue with Google</button>{!state?.google&&state?.configured&&<p className="quiet">Google sign-in is awaiting configuration.</p>}</>}
 <p className="auth-switch">{view==='sign-in'?<>New to Raaga? <button className="auth-link" onClick={()=>change('sign-up')}>Create an account</button></>:<>Already have an account? <button className="auth-link" onClick={()=>change('sign-in')}>Sign in</button></>}</p>
 <p className="auth-privacy">Your songs stay in this session. Usage analytics excludes your lyrics, audio and keys.</p></section></div></main>;
}
