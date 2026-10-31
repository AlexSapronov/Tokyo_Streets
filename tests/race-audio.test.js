import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceAudio,AUDIO_KEY,audioSettings} from '../src/race-audio.js';
function storage(){const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};}
function context(){
 const params=[],nodes=[];const param=()=>{const p={value:0,calls:[],setTargetAtTime(v){assert.ok(Number.isFinite(v));this.value=v;this.calls.push(v);},cancelScheduledValues(){},setValueAtTime(v){this.value=v;}};params.push(p);return p;};
 const node=()=>{const n={gain:param(),frequency:param(),connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}};nodes.push(n);return n;};
 return {state:'suspended',currentTime:0,sampleRate:64,destination:{},params,nodes,async resume(){this.state='running';},async close(){this.state='closed';},createGain:node,createOscillator:node,createBiquadFilter:node,createBufferSource:node,createBuffer:()=>({getChannelData:()=>new Float32Array(64)})};
}
test('sound starts only after opt-in and a user unlock, volume is bounded and settings persist',async()=>{
 const st=storage(),c=context();let created=0;const audio=new RaceAudio(st,()=>{created++;return c;});
 audio.update({rpm:8000,gear:3,smoke:1});assert.equal(created,0);assert.equal(audio.enabled,false);
 assert.equal(await audio.setEnabled(true),true);assert.equal(created,1);assert.equal(c.state,'running');
 audio.update({rpm:6000,gear:3,smoke:.5,throttle:1});assert.equal(audio.running,true);assert.equal(audio.master.gain.value,.2);assert.equal(audio.engine.frequency.value,200);assert.ok(audio.tireGain.gain.value>0);
 audio.setVolume(99);assert.equal(audio.volume,.6);audio.update({rpm:7000,gear:4,braking:true});assert.equal(audio.filter.frequency.value,1850);assert.ok(audio.engineGain.gain.value<.055);
 audio.stop();assert.equal(audio.master.gain.value,0);assert.equal(audio.running,false);await audio.setEnabled(false);assert.equal(audioSettings(st).enabled,false);assert.equal(audioSettings(st).volume,.6);audio.dispose();assert.equal(c.state,'closed');assert.ok(c.nodes.filter(n=>n.started).every(n=>n.stopped));
});
test('pause, hidden/inactive frames, suspended audio and cleanup always silence the master',async()=>{
 const c=context(),audio=new RaceAudio(storage(),()=>c);await audio.setEnabled(true);audio.update({rpm:5000,gear:2});audio.update({},false);assert.equal(audio.master.gain.value,0);
 audio.update({rpm:5000,gear:2});c.state='suspended';audio.update({rpm:5000,gear:2});assert.equal(audio.running,false);assert.equal(audio.master.gain.value,0);await audio.unlock();audio.update({rpm:5000,gear:2});assert.equal(audio.running,true);audio.dispose();audio.dispose();
});
test('unsupported or blocked Web Audio and broken preference storage never break the game',async()=>{
 const missing=new RaceAudio(storage(),()=>null);assert.equal(await missing.setEnabled(true),false);missing.update({});missing.dispose();assert.equal(missing.available,false);
 const c=context();c.resume=async()=>{throw new Error('blocked');};const blocked=new RaceAudio(storage(),()=>c);assert.equal(await blocked.setEnabled(true),false);assert.equal(blocked.context,null);assert.equal(c.state,'closed');
 assert.deepEqual(audioSettings({getItem(){throw Error();}}),{enabled:false,volume:.2});const broken=new RaceAudio({getItem:()=>'{bad',setItem(){throw Error();}},()=>context());assert.equal(await broken.setEnabled(true),true);broken.setVolume(NaN);broken.setVolume(-1);assert.equal(broken.volume,0);broken.dispose();
 const st=storage();st.setItem(AUDIO_KEY,JSON.stringify({enabled:true,volume:.1}));const retained=new RaceAudio(st,()=>context());assert.equal(retained.unlocked,false);retained.update({rpm:5000});assert.equal(retained.context,undefined);await retained.unlock();assert.equal(retained.unlocked,true);retained.dispose();
});
