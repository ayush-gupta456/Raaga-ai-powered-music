export const MIN_SECONDS=10, MAX_SECONDS=600;
export function durationRange(data){
  if(data.durationMode!==undefined&&!['auto','custom'].includes(data.durationMode))throw Error('Choose Auto or Custom song length.');
  if(data.durationMode==='auto')return {min:MIN_SECONDS,max:MAX_SECONDS};
  const values=[data.minDuration,data.maxDuration];
  if(values.some(v=>(typeof v!=='number'&&typeof v!=='string')||String(v).trim()===''))throw Error('Enter both minimum and maximum durations.');
  const [min,max]=values.map(Number);
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<MIN_SECONDS||max>MAX_SECONDS||min>MAX_SECONDS||max<MIN_SECONDS)throw Error('Choose whole seconds from 10 to 600 (10 minutes).');
  if(min>max)throw Error('Minimum duration must not be greater than maximum duration.');
  return {min,max};
}
export function targetDuration(data){
  const {min,max}=durationRange(data);
  if(data.durationMode==='auto')return null;
  const text=(data.lyrics||'').replace(/\[[^\]]*\]/g,'').trim();
  const words=text.split(/\s+/u).filter(Boolean).length;
  // A transparent planning estimate, not a guarantee of the model's arrangement.
  const estimate=data.mode==='instrumental'?(min+max)/2:30+words*.65;
  return Math.min(max,Math.max(min,Math.round(estimate/5)*5));
}
export function formatDuration(seconds){const s=Math.round(seconds);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
