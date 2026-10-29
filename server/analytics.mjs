import {PostHog} from 'posthog-node';
export function analyticsConfiguration(env){
 const host=env.POSTHOG_HOST||'https://us.i.posthog.com';
 const token=env.POSTHOG_PROJECT_TOKEN||'';
 return {host,token:/^phc_[A-Za-z0-9_-]+$/.test(token)&&['https://us.i.posthog.com','https://eu.i.posthog.com'].includes(host)?token:''};
}
export function generationEvent(event){
 return {distinctId:event.user,event:'$ai_generation',properties:{
  $ai_trace_id:event.traceId,$ai_session_id:null,$ai_provider:'ace_music',
  $ai_model:event.model||'ace-step',$ai_latency:event.latency,
  $ai_is_error:event.status!=='success',...(event.errorCode?{$ai_error:event.errorCode}:{}),
  generation_status:event.status,song_mode:event.mode,target_duration_seconds:event.targetDuration,
  $process_person_profile:true,$geoip_disable:true
 }};
}
export function createAIObserver(env,{Client=PostHog}={}){
 const config=analyticsConfiguration(env);let client;
 return async event=>{
  if(!config.token)return;
  try{client??=new Client(config.token,{host:config.host,flushAt:1,flushInterval:0,fetchRetryCount:0,requestTimeout:1200,disableGeoip:true});client.capture(generationEvent(event));await client.flush();}catch{/* Observability must never break song generation. */}
 };
}
