import {test} from 'node:test';
import assert from 'node:assert/strict';
import {durationRange,targetDuration,formatDuration} from '../public/duration.mjs';
import {makePayload} from '../lib/music.mjs';
const song={style:'folk',mode:'vocals',lyrics:'Sing along',minDuration:60,maxDuration:180};
test('short lyrics still respect the requested minimum',()=>assert.equal(targetDuration(song),60));
test('long lyrics never exceed the maximum',()=>assert.equal(targetDuration({...song,lyrics:'word '.repeat(1000)}),180));
test('custom durations are not restricted to preset lengths',()=>assert.equal(targetDuration({...song,minDuration:97,maxDuration:97}),97));
test('instrumental uses midpoint of requested range',()=>assert.equal(targetDuration({...song,mode:'instrumental',minDuration:120,maxDuration:240}),180));
test('ten minute target is passed to the real provider payload',()=>assert.equal(makePayload({...song,minDuration:600,maxDuration:600},'ace-step').audio_config.duration,600));
test('rejects inverted, blank, partial, nonnumeric and out-of-bounds ranges',()=>{
 for(const [min,max] of [[180,60],['',180],[60,undefined],[null,180],['NaN',180],[9,180],[60,601],[10.5,60],[Infinity,180]])assert.throws(()=>durationRange({minDuration:min,maxDuration:max}));
});
test('new range takes precedence over stale legacy duration',()=>assert.equal(makePayload({...song,minDuration:120,maxDuration:120,duration:'30 seconds'},'ace-step').audio_config.duration,120));
test('duration display includes minutes and seconds',()=>assert.equal(formatDuration(97),'1:37'));

test('Auto leaves duration to the provider while preserving exact lyrics',()=>{
 const data={...song,durationMode:'auto',minDuration:'',maxDuration:''};
 const payload=makePayload(data,'ace-step');
 assert.equal(targetDuration(data),null);
 assert.equal(Object.hasOwn(payload.audio_config,'duration'),false);
 assert.match(payload.messages[0].content,/<lyrics>Sing along<\/lyrics>/);
 assert.equal(payload.sample_mode,undefined);
 assert.equal(payload.audio_config.instrumental,false);
 assert.equal(makePayload({...data,mode:'instrumental'},'ace-step').audio_config.instrumental,true);
 assert.throws(()=>makePayload({...data,durationMode:'unbounded'},'ace-step'));
});
