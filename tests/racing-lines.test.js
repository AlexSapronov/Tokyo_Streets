import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,CARDS,sectorAt,getEvent} from '../src/data.js';
import {configuration,freshState,simulate,createRace,resolveSector,chooseRacingLine} from '../src/engine.js';
import {lineCard,lineReason,lineFrame,RACING_LINES} from '../src/racing-lines.js';
import {newCareer,validateSave} from '../src/storage.js';
import {awardRace} from '../src/progress.js';
const config=configuration('ae86','ren'),corner=sectorAt(3,'dry','haruna'),card=CARDS[0];
test('neutral line retains physics; late apex trades corner time for the next entry speed',()=>{
 const state={...freshState(config),velocity:25},before=structuredClone(state);
 const neutral=simulate(config,state,corner,card),late=simulate(config,state,corner,lineCard(card,'late-apex'));
 assert.deepEqual(simulate(config,state,corner,lineCard(card)),neutral);
 assert.ok(late.time>neutral.time);assert.ok(late.next.velocity>neutral.next.velocity);
 const straight=sectorAt(4,'dry','haruna');
 assert.ok(simulate(config,late.next,straight,card).time<simulate(config,neutral.next,straight,card).time);
 assert.deepEqual(state,before);
 const wide=simulate(config,state,corner,lineCard(card,'wide-exit'));
 assert.ok(wide.next.tires<neutral.next.tires);assert.ok(wide.risk>neutral.risk);
});
test('invalid or non-road lines are rejected atomically, AI uses the same line simulation',()=>{
 const race=createRace(config,'dry','haruna','line-run',42),before=structuredClone(race);
 assert.throws(()=>resolveSector(race,'balanced','inside'),/повороте/);
 assert.throws(()=>resolveSector(race,'balanced','bogus'),/Неизвестная/);assert.deepEqual(race,before);
 assert.ok(lineReason('late-apex',sectorAt(1,'dry','ebisu')));
 const choice=chooseRacingLine(config,freshState(config),corner,card,sectorAt(4,'dry','haruna'));
 assert.deepEqual(choice.result,simulate(config,freshState(config),corner,choice.card));
});
test('all road lines finish with finite times across car platforms, seed and choices reproduce',()=>{
 for(const car of CARS){
  const cfg=configuration(car.id,'ren');
  for(const line of RACING_LINES){
   let a=createRace(cfg,'rain','tsukuba','matrix',42),b=structuredClone(a);
   while(!a.finished){const s=sectorAt(a.index,a.weather,a.eventId),id=s.type==='corner'?line.id:'neutral';a=resolveSector(a,'balanced',id);b=resolveSector(b,'balanced',id);}
   assert.deepEqual(a,b);assert.ok(Number.isFinite(a.player.time)&&a.player.time>0);
  }
 }
});
test('line recordings round-trip; old road records remain in the previous-model archive',()=>{
 let c=newCareer(),r=createRace(config,'dry','tsukuba','saved-lines',42);
 while(!r.finished)r=resolveSector(r,'balanced',getEvent(r.eventId).sectors[r.index].type==='corner'?'late-apex':'neutral');
 const result=awardRace(c,r);assert.equal(result.isBest,true);
 const saved=validateSave(result.career);assert.deepEqual(saved.bests[0].lines,result.career.bests[0].lines);
 const legacy=structuredClone(result.career);legacy.bests[0].key=legacy.bests[0].key.replace(/^5\|/,'4|');delete legacy.bests[0].lines;
 assert.ok(validateSave(legacy).bests[0].key.startsWith('4|'));
 const corrupt=structuredClone(result.career);corrupt.bests[0].lines[0]='bogus';assert.equal(validateSave(corrupt).bests.length,0);
 const pose=lineFrame({sectorTimes:[10],lines:['wide-exit']},5);assert.ok(pose.offset>0);assert.deepEqual(lineFrame({sectorTimes:[10]},5),{offset:0,yaw:0});
});
