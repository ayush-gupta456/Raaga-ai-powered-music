import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyticsConfiguration,generationEvent,createAIObserver} from '../server/analytics.mjs';
import {createMusicAPI} from '../lib/music.mjs';
import {MusicError} from '../lib/http.mjs';
import {readFile} from 'node:fs/promises';
const request=()=>new Request('https://raaga.test/api/music/generate',{method:'POST',headers:{origin:'https://raaga.test','content-type':'application/json','oai-authenticated-user-id':'verified-account','x-ace-music-key':'secret-personal-key'},body:JSON.stringify({mode:'instrumental',style:'private description',lyrics:'private lyrics',minDuration:30,maxDuration:30,title:'private title'})});
test('analytics config exposes only a valid project token and fixed ingestion host',()=>{
 assert.deepEqual(analyticsConfiguration({POSTHOG_PROJECT_TOKEN:'phc_public',POSTHOG_HOST:'https://eu.i.posthog.com',MONGODB_URI:'secret'}),{token:'phc_public',host:'https://eu.i.posthog.com'});
 assert.equal(analyticsConfiguration({POSTHOG_PROJECT_TOKEN:'phx_personal'}).token,'');assert.equal(analyticsConfiguration({POSTHOG_PROJECT_TOKEN:'phc_public',POSTHOG_HOST:'https://attacker.test'}).token,'');
});
test('AI observability includes outcomes and latency while excluding private content and invented billing',async()=>{
 let observed;
 const api=createMusicAPI({provider:{generate:async()=>({bytes:new Uint8Array([1]),mime:'audio/wav',extension:'wav',targetDuration:30,model:'ace-step'})},observe:async event=>{observed=event;}});
 assert.equal((await api(request(),{})).status,200);assert.equal(observed.user,'verified-account');assert.equal(observed.status,'success');assert.ok(observed.latency>=0);assert.match(observed.traceId,/^[a-f0-9-]{36}$/);
 const event=generationEvent({...observed,lyrics:'must not leak',key:'secret-personal-key'});const serialized=JSON.stringify(event);
 for(const text of ['private description','private lyrics','private title','secret-personal-key','must not leak','$ai_input_tokens','$ai_total_cost_usd'])assert.equal(serialized.includes(text),false);
 assert.equal(event.properties.$ai_provider,'ace_music');assert.equal(event.properties.$ai_session_id,null);
});
test('sanitizes provider failure traces and isolates analytics failures from song responses',async()=>{
 let observed;const api=createMusicAPI({provider:{generate:async()=>{throw new MusicError('secret upstream content',502,'provider_auth');}},observe:async event=>{observed=event;throw Error('analytics failed');}});
 assert.equal((await api(request(),{})).status,502);assert.equal(observed.errorCode,'provider_auth');assert.equal(JSON.stringify(observed).includes('secret upstream content'),false);
 const good=createMusicAPI({provider:{generate:async()=>({bytes:new Uint8Array([1]),mime:'audio/wav',extension:'wav',targetDuration:30})},observe:async()=>{throw Error('offline');}});assert.equal((await good(request(),{})).status,200);
});
test('unconfigured analytics is a no-op, configured events flush before the request ends',async()=>{
 let calls=0,flushed=0;class Client{capture(){calls++;}async flush(){flushed++;}}
 const event={user:'u',traceId:'trace',status:'success',latency:1};await createAIObserver({},{Client})(event);assert.equal(calls,0);
 await createAIObserver({POSTHOG_PROJECT_TOKEN:'phc_public'},{Client})(event);assert.equal(calls,1);assert.equal(flushed,1);
});
test('browser tracking disables recordings, automatic form capture and query-string collection',async()=>{
 const code=await readFile(new URL('../client/analytics.ts',import.meta.url),'utf8');for(const setting of ['autocapture:false','capture_pageview:false','disable_session_recording:true',"persistence:'memory'","'$search'","'$referrer'"])assert.ok(code.includes(setting));
});
