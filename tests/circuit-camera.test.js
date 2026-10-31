import test from 'node:test';import assert from 'node:assert/strict';
import {sectionCamera,sceneryClear} from '../src/scene-camera.js';
import {getEvent,eventLength} from '../src/data.js';
import {configuration} from '../src/engine.js';import {finishRace} from './helpers.js';
import {newCareer,validateSave} from '../src/storage.js';import {awardRace} from '../src/progress.js';
test('scenery clearance covers full projected object radius and the segments between route samples',()=>{
 const road=[[0,0],[100,0]];assert.equal(sceneryClear(road,50,10,20),false);assert.equal(sceneryClear(road,50,40,20),true);assert.equal(sceneryClear(road,-5,0,10),false);
});
test('section camera is bounded, uses uniform zoom and is deterministic between decisions',()=>{
 const points=Array.from({length:801},(_,i)=>[i*2,200+Math.sin(i/100)*50]),checkpoints=[0,.25,.5,.75,1];
 for(let i=0;i<4;i++){const c=sectionCamera(points,checkpoints,i,1600,520,.5);assert.deepEqual(c,sectionCamera(points,checkpoints,i,1600,520,.5));assert.ok(c.zoom>=1&&c.zoom<=6);assert.ok(c.x<=0&&c.x>=1600*(1-c.zoom));assert.ok(c.y<=0&&c.y>=520*(1-c.zoom));}
});
for(const [id,length] of [['suzuka',5807],['fuji',4563]])test(id+' supports a full timed lap, rewards, saving and replay without changing the official length',()=>{
 const event=getEvent(id);assert.equal(event.id,id);assert.equal(eventLength(event),length);assert.equal(event.realCircuit,true);assert.deepEqual(event.anchors[0],event.anchors.at(-1));
 for(const weather of ['dry','rain']){
  const career=newCareer(),race=finishRace(configuration('evo','ren'),weather,id,null,id+'-'+weather);assert.ok(race.finished);assert.equal(race.history.length,event.sectors.length);const result=awardRace(career,race);const loaded=validateSave(result.career);assert.ok(loaded.records.some(r=>r.eventId===id));if(!race.player.dnf)assert.ok(loaded.bests.some(r=>r.eventId===id));
 }
});
