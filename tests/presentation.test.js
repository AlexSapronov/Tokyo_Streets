import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationFrame,presentationRecord} from '../src/presentation.js';
import {configuration,createRace,resolveSector} from '../src/engine.js';
import {raceRecord} from '../src/progress.js';
import {finishRace} from './helpers.js';
test('recorded tactics drive lights, positioning, smoke and cues without changing simulation data',()=>{
 const make=(action,slip=0)=>({sectorTimes:[10,10],actions:['balanced',action],lines:['neutral','late-apex'],slips:[0,slip],telemetry:[{speed:160,rpm:6000,gear:3},{speed:90,rpm:4500,gear:2}]});
 const braking=presentationFrame(make('late'),12,'haruna');assert.equal(braking.braking,true);assert.equal(braking.cue,'Торможение');
 const defend=presentationFrame(make('defend'),15,'haruna');assert.ok(defend.offset>0);assert.equal(defend.cue,'Защита линии');
 const pass=presentationFrame(make('skill-feint'),15,'haruna');assert.ok(pass.offset<0);assert.equal(pass.cue,'Попытка обгона');
 const slippery=make('power',.7),before=structuredClone(slippery),frame=presentationFrame(slippery,16,'haruna');assert.ok(frame.smoke>0);assert.ok(frame.marks>0);assert.equal(frame.cue,'Потеря сцепления');assert.deepEqual(slippery,before);
 assert.ok(presentationFrame(make('draft'),15,'haruna').offset>0);assert.equal(presentationFrame(make('power'),18,'haruna').cue,'Выход на тяге');
 assert.equal(presentationFrame({sectorTimes:[],actions:[]},0,'haruna').smoke,0);
});
test('old recordings never invent tire slips and playback agrees with the saved outcome',()=>{
 const r=finishRace(configuration('ae86','ren'),'dry','tsukuba'),record=raceRecord(r),snapshot=structuredClone(r);
 const legacy={...record};delete legacy.slips;assert.equal(presentationFrame(legacy,1,r.eventId).smoke,0);
 for(let t=0;t<=record.time;t+=3){const a=presentationFrame(record,t,r.eventId),b=presentationFrame(presentationRecord(r),t,r.eventId);assert.deepEqual(a,b);for(const key of ['offset','yaw','smoke','rpm'])assert.ok(Number.isFinite(a[key]));}
 assert.deepEqual(r,snapshot);
});
test('drag prep, drift clips and retired opponents stay finite and only use their recorded rows',()=>{
 for(const event of ['yokohama','ebisu']){const r=finishRace(configuration('s13','ren'),'dry',event),record=raceRecord(r);for(let t=0;t<=record.time;t+=2){const frame=presentationFrame(record,t,event);assert.ok(Number.isFinite(frame.yaw));assert.ok(frame.smoke>=0&&frame.smoke<=1);}}
 let r=resolveSector(createRace(configuration('ae86','ren'),'dry','haruna','ai',42),'balanced');r.history.push({...r.history[0],aiTime:null});const opponent=presentationRecord(r,true);assert.equal(opponent.sectorTimes.length,1);assert.ok(opponent.actions[0]);
});
