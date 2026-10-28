import { MusicError } from './http.mjs';
export function numericSetting(value,fallback,min,max){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?Math.floor(n):fallback;}
// Operational counters only: never prompts, credentials, results or audio.
export class TemporaryLimits {
  constructor(){this.entries=new Map();this.active=0;}
  acquire(user,env={}) {
    const now=Date.now(), windowMs=numericSetting(env.MUSIC_RATE_WINDOW_MS,60000,10,3600000);
    const max=numericSetting(env.MUSIC_MAX_REQUESTS,3,1,100);
    const concurrent=numericSetting(env.MUSIC_MAX_CONCURRENT,2,1,10);
    let entry=this.entries.get(user);
    if(entry?.active)throw new MusicError('A song is already generating. Wait or cancel it first.',429,'already_generating',5);
    if(this.active>=concurrent)throw new MusicError('The studio is busy. Please try again shortly.',429,'busy',10);
    if(entry&&entry.expires<=now){clearTimeout(entry.timer);this.entries.delete(user);entry=null;}
    if(entry?.count>=max)throw new MusicError('Please wait before creating another song.',429,'rate_limit',Math.max(1,Math.ceil((entry.expires-now)/1000)));
    if(!entry){
      if(this.entries.size>=500)throw new MusicError('The studio is busy. Please try again shortly.',429,'busy',10);
      entry={count:0,active:false,expires:now+windowMs,timer:null};this.entries.set(user,entry);
      entry.timer=setTimeout(()=>{if(!entry.active)this.entries.delete(user);},windowMs);
      entry.timer.unref?.();
    }
    entry.count++;entry.active=true;this.active++;let released=false;
    return ()=>{if(released)return;released=true;entry.active=false;this.active--;if(entry.expires<=Date.now()){clearTimeout(entry.timer);this.entries.delete(user);}};
  }
  dispose(){for(const entry of this.entries.values())clearTimeout(entry.timer);this.entries.clear();}
}
