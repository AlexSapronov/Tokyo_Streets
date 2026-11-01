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
 const scene=new Scene(canvas(),race()),render=scene.renderBackground.bind(scene);let rebuilds=0;
 scene.renderBackground=()=>{rebuilds++;render();};scene.draw();
 assert.equal(rebuilds,0,'camera must reuse cached track and scenery');
 observers[0].callback();assert.equal(rebuilds,1);scene.destroy();
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
test('all drag formats keep paddock buildings off the racing strip while circuit scenery remains',()=>{
 for(const event of EVENTS.filter(e=>e.mode==='drag'||e.theme==='circuit')){
  const scene=new Scene(canvas(),createRace(configuration('ae86','ren'),'dry',event.id)),colors=[];
  const polygon=scene.polygon.bind(scene);scene.polygon=(ctx,points,color)=>{colors.push(color);polygon(ctx,points,color);};
  scene.renderBackground();assert.ok(colors.filter(color=>color==='#64716c').length<=6);if(event.mode==='drag')assert.equal(colors.filter(color=>color==='#64716c').length,0);
  scene.destroy();
 }
});

test('recorded braking, slip and attack cues render lights and trails; sound stops on pause and teardown',t=>{
 t.mock.method(performance,'now',()=>0);let initial=race();initial=resolveSector(initial,'balanced');
 const next=resolveSector(initial,'late','late-apex');next.history.at(-1).slip=.8;
 const sound={updates:[],stops:0,update(frame,active){this.updates.push({frame,active});},stop(){this.stops++;}};
 const scene=new Scene(canvas(),initial,null,false,sound);scene.animateSector(next,null,1000);calls=[];scene.loop(150);
 assert.ok(calls.some(call=>call[0]==='fillRect'));assert.ok(calls.some(call=>call[0]==='ellipse'));assert.equal(sound.updates.at(-1).active,true);assert.ok(sound.updates.at(-1).frame.smoke>0);
 scene.setPaused(true);assert.ok(sound.stops>0);scene.loop(300);assert.equal(sound.updates.at(-1).active,false);scene.destroy();assert.ok(sound.stops>1);
});

test('close camera follows recorded progress without touching simulation or rebuilding scenery',()=>{
 const initial=race(),next=resolveSector(initial,'balanced'),scene=new Scene(canvas(),next),before=structuredClone(next);
 scene.follow=true;scene.renderBackground=()=>assert.fail('camera must reuse cached scenery');calls=[];scene.draw();assert.ok(calls.some(call=>call[0]==='setTransform'&&call[1]>1));assert.ok(calls.some(call=>call[0]==='fillRect'));assert.deepEqual(next,before);scene.destroy();
});

test('drag cameras draw a single complete world at start, mid-run and finish on both pixel densities',()=>{
 for(const dpr of [1,2])for(const event of EVENTS.filter(e=>e.mode==='drag')){
  window.devicePixelRatio=dpr;
  const config=configuration('ae86','ren'),finished=finishRace(config,'dry',event.id),record=raceRecord(finished);
  const scene=new Scene(canvas(2048,440),finished),before=structuredClone(finished);
  scene.replayRecord=record;
  for(const follow of [true,false])for(const elapsed of [0,record.time/2,record.time]){
   scene.follow=follow;scene.elapsed=elapsed;scene.cameraState=null;calls=[];scene.draw();
   const worlds=calls.filter(call=>call[0]==='drawImage'&&call[1]===scene.background);
   assert.equal(worlds.length,1,event.id+' must not leave an overview under the close view');
   assert.ok(calls.some(call=>call[0]==='fillRect'&&call[3]===2048&&call[4]===440),'ground covers the entire viewport');
   const [,,x,y,width,height]=worlds[0];
   if(scene.cameraState.zoom>=1)assert.ok(x<=0&&y<=0&&x+width>=2048-1e-6&&y+height>=440-1e-6,event.id+' camera stays inside cached scenery');
   else{assert.ok(x>=0&&y>=0);assert.ok(Math.abs(x-(2048-width)/2)<1e-6);assert.ok(Math.abs(y-(440-height)/2)<1e-6);}
  }
  scene.follow=true;scene.paused=true;scene.cameraState={zoom:2,x:400,y:-2000};calls=[];scene.draw();
  assert.equal(scene.cameraState.x,0);assert.equal(scene.cameraState.y,-440);
  scene.size();calls=[];scene.draw();assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===scene.background).length,1);
  assert.deepEqual(finished,before);scene.destroy();
 }
});
