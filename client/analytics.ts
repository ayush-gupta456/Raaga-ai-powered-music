import type {PostHog} from 'posthog-js';
let posthog:PostHog;
let ready=false, identity:string|null=null, lastPage='';
const queue:Array<()=>void>=[];
const allowed=new Set(['page_viewed','account_created','sign_in_completed','sign_out_completed','ace_key_connected','ace_key_disconnected','song_generation_started','song_generation_succeeded','song_generation_failed','song_generation_cancelled','song_played','song_downloaded']);
function dispatch(action:()=>void){if(ready){try{action();}catch{/* Analytics never blocks the studio. */}}else if(queue.length<30)queue.push(action);}
export function track(event:string,properties:Record<string,string|number|boolean>={}){
 if(!allowed.has(event))return;
 if(event==='page_viewed'){const signature=(identity||'anonymous')+':'+properties.view;if(signature===lastPage)return;lastPage=signature;}
 // Only explicitly selected categorical and numeric metrics are accepted.
 const safe:Record<string,string|number|boolean>={};
 for(const key of ['view','mode','duration_seconds','elapsed_seconds','has_personal_key'])if(key in properties)safe[key]=properties[key];
 dispatch(()=>{posthog.capture(event,safe);if(event==='page_viewed')posthog.capture('$pageview',safe);});
}
export function identifyUser(id:string|null){if(identity===id)return;identity=id;dispatch(()=>{if(id)posthog.identify(id);else posthog.reset();});}
export async function initializeAnalytics(){
 try{const response=await fetch('/api/analytics/config',{cache:'no-store'});if(!response.ok)return;const config=await response.json() as {token?:string;host?:string};if(!config.token||!['https://us.i.posthog.com','https://eu.i.posthog.com'].includes(config.host||''))return;
 posthog=(await import('posthog-js')).default;
 posthog.init(config.token,{api_host:config.host,autocapture:false,capture_pageview:false,capture_pageleave:false,disable_session_recording:true,enable_recording_console_log:false,capture_exceptions:false,persistence:'memory',person_profiles:'identified_only',disable_surveys:true,advanced_disable_feature_flags:true,mask_all_text:true,mask_all_element_attributes:true,property_denylist:['$current_url','$referrer','$initial_current_url','$initial_referrer','$pathname','$search','$hash'],before_send:event=>{if(!event)return null;for(const key of Object.keys(event.properties))if(/url|referr|pathname|search|hash|utm_|gclid|fbclid/i.test(key)||key==='$set'||key==='$set_once')delete event.properties[key];if(event.event==='$pageview'){const views=['sign-in','sign-up','forgot-password','reset-password','verify-email','studio'];const view=views.includes(event.properties.view)?event.properties.view:'sign-in';event.properties.$current_url=window.location.origin+'/'+view;event.properties.$pathname='/'+view;}return event;}});
 ready=true;for(const action of queue.splice(0))dispatch(action);
 }catch{/* Missing configuration and blocked analytics do not affect music. */}
}
