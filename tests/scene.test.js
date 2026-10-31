// Renderer contract tests use a fake Canvas/clock, not a real browser or layout
// engine. They exercise lifecycle and playback without a preview service.
import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from '../src/scene.js';
import {EVENTS} from '../src/data.js';
import {configuration,createRace,resolveSector} from '../src/engine.js';
import {raceRecord} from '../src/progress.js';
import {finishRace} from './helpers.js';
let calls,raf,observers,saved;
function context(){
 const target={};
 return new Proxy(target,{get(object,key){
  if(key in object)return object[key];
  if(key==='createLinearGradient')return ()=>({addColorStop(){}});
  return (...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${String(key)} received a nonfinite value`);calls.push([key,...args]);};
 },set(object,key,value){object[key]=value;return true;}});
}
function canvas(width=1100,height=580){const ctx=context();return {width,height,getContext:()=>ctx,getBoundingClientRect:()=>({width,height})};}
beforeEach(()=>{
 calls=[];raf=new Map();observers=[];saved=new Map();
 const stubs={window:{devicePixelRatio:1},document:{createElement:()=>canvas()},
  Image:class {complete=true;naturalWidth=130;},
  ResizeObserver:class {constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}},
  requestAnimationFrame:callback=>{const id=raf.size+1;raf.set(id,callback);return id;},
  cancelAnimationFrame:id=>raf.delete(id)};
 for(const [key,value] of Object.entries(stubs)){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
});
afterEach(()=>{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
function race(){return createRace(configuration('ae86','ren'),'dry');}
test('scene teardown disconnects resize observation and does not schedule another frame',()=>{
 const scene=new Scene(canvas(),race());const count=raf.size;scene.destroy();
 assert.equal(observers[0].disconnected,true);assert.ok(raf.size<count);
 const before=raf.size;scene.loop(500);assert.equal(raf.size,before);
});
test('pause freezes sector time and resume preserves remaining playback duration',t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock);
 const initial=race(),scene=new Scene(canvas(),initial),next=resolveSector(initial,'balanced');
 scene.animateSector(next,null,1000);scene.loop(250);const elapsed=scene.elapsed;
 clock=250;scene.setPaused(true);scene.loop(900);assert.equal(scene.elapsed,elapsed);
 clock=900;scene.setPaused(false);scene.loop(900);assert.equal(scene.elapsed,elapsed);
 scene.loop(1650);assert.equal(scene.elapsed,next.player.time);scene.destroy();
});
test('speed change preserves current position and changes the remaining wall-clock duration',t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock);
 const initial=race(),scene=new Scene(canvas(),initial),next=resolveSector(initial,'balanced');
 scene.animateSector(next,null,1000);scene.loop(400);const before=scene.elapsed;
 clock=400;scene.setSpeed(2);scene.loop(400);assert.equal(scene.elapsed,before);
 scene.loop(700);assert.equal(scene.elapsed,next.player.time);scene.destroy();
});
test('speed changes while paused do not move the car before resume',t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock);
 const initial=race(),scene=new Scene(canvas(),initial),next=resolveSector(initial,'balanced');
 scene.animateSector(next,null,1000);scene.loop(200);clock=200;scene.setPaused(true);const elapsed=scene.elapsed;
 clock=600;scene.setSpeed(2);scene.loop(900);assert.equal(scene.elapsed,elapsed);
 clock=900;scene.setPaused(false);scene.loop(900);assert.equal(scene.elapsed,elapsed);
 scene.loop(1300);assert.equal(scene.elapsed,next.player.time);scene.destroy();
});
test('completing an animation triggers once even when the callback destroys the scene',t=>{
 t.mock.method(performance,'now',()=>0);
 const initial=race(),scene=new Scene(canvas(),initial),next=resolveSector(initial,'balanced');let complete=0;
 scene.onComplete=()=>{complete++;scene.destroy();};scene.animateSector(next,null,100);
 scene.loop(100);const remaining=raf.size;scene.loop(200);assert.equal(complete,1);assert.equal(raf.size,remaining);
});
test('full replay can finish without calling an economic transaction',t=>{
 t.mock.method(performance,'now',()=>0);
 const complete=finishRace(configuration('ae86','ren'),'dry','yokohama');
 const record=raceRecord(complete),snapshot=structuredClone(complete);
 const scene=new Scene(canvas(),createRace(complete.config,'dry','yokohama'));let finished=0;
 scene.onComplete=()=>finished++;scene.replay(record,1000);scene.loop(500);assert.ok(scene.elapsed>0&&scene.elapsed<record.time);
 scene.loop(1000);scene.loop(1200);assert.equal(finished,1);assert.equal(scene.elapsed,record.time);assert.deepEqual(complete,snapshot);scene.destroy();
});
test('every scene theme renders its initial state and drag preparation ghost without nonfinite coordinates',()=>{
 for(const event of EVENTS){
  const initial=createRace(configuration('evo','ren'),'rain',event.id),scene=new Scene(canvas(),initial);
  if(event.mode==='drag'){scene.ghost=raceRecord(finishRace(initial.config,'rain',event.id));scene.showGhost=true;}
  scene.draw();assert.ok(calls.some(call=>call[0]==='drawImage'));scene.destroy();
 }
});
test('static environment is cached between frames and rebuilt on resize',()=>{
 const scene=new Scene(canvas(),race());calls=[];scene.draw();
 assert.ok(!calls.some(call=>call[0]==='fillRect'),'background geometry must not redraw per frame');
 calls=[];observers[0].callback();assert.ok(calls.some(call=>call[0]==='fillRect'));scene.destroy();
});
test('solo drift draws yaw and its recorded ghost without inventing an AI car',t=>{
 t.mock.method(performance,'now',()=>0);
 const config=configuration('ae86','ren'),complete=finishRace(config,'dry','ebisu'),record=raceRecord(complete);
 const scene=new Scene(canvas(),complete,record,true);calls=[];scene.draw();
 assert.ok(calls.some(call=>call[0]==='rotate'&&Math.abs(call[1])>.1));
 assert.ok(calls.some(call=>call[0]==='fillText'&&call[1]==='YOU'));
 assert.ok(calls.some(call=>call[0]==='fillText'&&call[1]==='BEST'));
 assert.ok(!calls.some(call=>call[0]==='fillText'&&call[1]==='RIVAL'));
 scene.replay(record,1000);calls=[];scene.loop(250);
 assert.ok(calls.some(call=>call[0]==='fillText'&&call[1]==='REPLAY'));scene.destroy();
});
test('drift replay with a spin remains finite through its full rotation',t=>{
 t.mock.method(performance,'now',()=>0);
 const config=configuration('chaser','aki'),complete=finishRace(config,'rain','ebisu');
 const record=raceRecord(complete);record.drift.clips[0].spin=true;record.drift.clips[0].valid=false;
 const scene=new Scene(canvas(),createRace(config,'rain','ebisu'));scene.replay(record,1000);
 scene.loop(20);scene.loop(60);scene.loop(1000);assert.equal(scene.elapsed,record.time);scene.destroy();
});
test('run-off stops both cars off the road without projecting a retired rival to the finish',()=>{
 let initial=race(),retired=resolveSector(initial,'balanced');
 retired.player.dnf={damage:30};retired.opponent.dnf={damage:30};retired.finished=true;
 const scene=new Scene(canvas(),retired),poses=[];scene.elapsed=1000;
 scene.drawCar=(...args)=>poses.push(args);scene.draw();
 assert.equal(poses.length,2);for(const pose of poses){assert.ok(pose[0]<1);assert.equal(Math.abs(pose[1]),38);assert.match(pose[3],/DNF/);}
 retired={...retired,history:[...retired.history,{...retired.history[0],aiTime:null}]};scene.race=retired;scene.draw();scene.destroy();
});
