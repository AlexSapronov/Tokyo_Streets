import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,PILOTS,PARTS,getEvent,sectorAt} from '../src/data.js';
import {DRAG_CARDS} from '../src/drag-data.js';
import {freshDragState,simulateDrag,dragReason} from '../src/drag.js';
import {configuration,createRace,resolveSector,chooseAI,futureSectors,raceOutcome,availableCards} from '../src/engine.js';
import {newCareer,validateSave} from '../src/storage.js';
import {awardRace,raceRecord,recordKey,progressAtTime} from '../src/progress.js';
import {finishRace,assertState} from './helpers.js';
const card=id=>DRAG_CARDS.find(card=>card.id===id);
const phase=i=>sectorAt(i,'dry','yokohama');
const recipe=['drag-burnout','drag-soft','drag-band','drag-push'];
const cfg=configuration('ae86','ren');
function prep(config=cfg,weather='dry',action='drag-burnout'){
 return simulateDrag(config,freshDragState(config),sectorAt(0,weather,'yokohama'),card(action)).next;
}
test('drag has four distinct phases and a true quarter-mile distance',()=>{
 const event=getEvent('yokohama');assert.deepEqual(event.sectors.map(sector=>sector.phase),['prep','launch','shifts','finish']);
 assert.equal(event.sectors.reduce((sum,sector)=>sum+sector.length,0),402.336);
 assert.equal(event.sectors[1].length,18.288);
 assert.equal(availableCards(cfg,'drag').length,12);
 assert.ok(availableCards(cfg).every(card=>!card.phase));
});
test('preparation consumes resources but no clock time or distance',()=>{
 const state=freshDragState(cfg),copy=structuredClone(state),result=simulateDrag(cfg,state,phase(0),card('drag-burnout'));
 assert.deepEqual(state,copy);assert.equal(result.time,0);assert.equal(result.next.time,0);assert.equal(result.next.drag.distance,0);
 assert.equal(result.next.drag.temperature,90);assert.equal(result.next.velocity,0);assert.ok(result.next.tires<100);
});
test('drag rejects road actions, wrong phases and insufficient focus without changing input',()=>{
 const race=createRace(cfg,'dry','yokohama'),copy=structuredClone(race);
 assert.throws(()=>resolveSector(race,'balanced'),/недоступна/);
 assert.throws(()=>resolveSector(race,'drag-soft'),/фазе/);
 assert.deepEqual(race,copy);
 assert.match(dragReason({id:'balanced'},phase(0),race.player),/не используется/);
 assert.throws(()=>simulateDrag(cfg,{...race.player,focus:0},phase(0),card('drag-warm')),/фокуса/);
});
test('reaction is separate from ET and preparation never inflates timing',()=>{
 const race=finishRace(cfg,'dry','yokohama',recipe),d=race.player.drag;
 assertState(assert,race);assert.ok(Math.abs(race.player.time-d.et-d.reaction)<1e-9);
 assert.equal(race.history[0].playerTime,0);assert.ok(d.sixty>0&&d.sixty<d.et);assert.ok(d.trap>0);
 assert.ok(Math.abs(race.history[1].playerTime-d.sixty-d.reaction)<1e-9);
 assert.equal(d.distance,402.336);assert.ok(d.shifts>=3);
});
test('a false start loses even with faster ET; opponent false start loses to a clean run',()=>{
 const foul=finishRace(configuration('evo','aki'),'dry','yokohama',['drag-burnout','drag-edge','drag-band','drag-push']);
 assert.ok(foul.player.drag.falseStart);assert.ok(foul.player.drag.reaction<0);
 const modified={...foul,opponent:{...foul.opponent,time:foul.player.time+50}};
 assert.equal(raceOutcome(modified).won,false);assert.equal(raceOutcome(modified).label,'Фальстарт');
 const clean=finishRace(cfg,'dry','yokohama',recipe);
 clean.opponent.drag.falseStart=true;clean.opponent.time=.1;assert.equal(raceOutcome(clean).won,true);
 clean.player.drag.falseStart=true;assert.equal(raceOutcome(clean).won,false);
});
test('foul runs earn no money, progression or leaderboard trace',()=>{
 const race=finishRace(configuration('evo','aki'),'dry','yokohama',['drag-warm','drag-edge','drag-band','drag-clean']);
 const career=newCareer(),awarded=awardRace(career,race);
 assert.equal(awarded.isBest,false);assert.deepEqual(awarded.career.bests,[]);
 assert.equal(awarded.career.official,0);assert.equal(awarded.career.records[0].falseStart,true);
 assert.equal(awarded.career.money,career.money);assert.equal(awarded.career.races,0);assert.deepEqual(awarded.career.eventCompletions,{});assert.deepEqual(awarded.career.journey,career.journey);
 assert.equal(validateSave(awarded.career).records[0].falseStart,true);
});
test('AWD realizes a faster sixty-foot launch than the equal-power FR sedan',()=>{
 const times=['chaser','evo'].map(id=>{const config=configuration(id,'ren');return simulateDrag(config,prep(config),phase(1),card('drag-hard')).next.drag.sixty;});
 assert.ok(times[1]<times[0]);
});
test('tire preparation and pressure have wet and high-speed tradeoffs',()=>{
 const dry=simulateDrag(cfg,prep(cfg,'dry'),phase(1),card('drag-hard'));
 const rainSector=sectorAt(1,'rain','yokohama');
 const wetHot=simulateDrag(cfg,prep(cfg,'rain'),rainSector,card('drag-hard'));
 const wetWarm=simulateDrag(cfg,prep(cfg,'rain','drag-warm'),rainSector,card('drag-hard'));
 assert.ok(wetHot.time>dry.time);assert.ok(wetWarm.time<wetHot.time);
 const high={...prep(cfg),velocity:42};
 const low=structuredClone(high);low.drag.pressure=.88;
 assert.ok(simulateDrag(cfg,low,phase(3),card('drag-push')).time>simulateDrag(cfg,high,phase(3),card('drag-push')).time);
});
test('LSD reduces lost launch traction and semi-slicks lose grip when wet',()=>{
 const base=configuration('chaser','ren'),lsd=configuration('chaser','ren',['lsd']);
 const a=simulateDrag(base,prep(base),phase(1),card('drag-hard')),b=simulateDrag(lsd,prep(lsd),phase(1),card('drag-hard'));
 assert.ok(b.time<a.time);assert.ok(b.risk<a.risk);
 const tires=configuration('chaser','ren',['tires']),wet=sectorAt(1,'rain','yokohama');
 assert.ok(simulateDrag(tires,prep(tires,'rain','drag-warm'),wet,card('drag-hard')).time>
   simulateDrag(base,prep(base,'rain','drag-warm'),wet,card('drag-hard')).time);
});
test('shift strategy affects interruption time and heat without adding horsepower',()=>{
 const state=simulateDrag(cfg,prep(),phase(1),card('drag-soft')).next;
 const band=simulateDrag(cfg,state,phase(2),card('drag-band')),redline=simulateDrag(cfg,state,phase(2),card('drag-redline'));
 assert.ok(redline.time>band.time);assert.ok(redline.next.heat>band.next.heat);
 assert.ok(band.next.drag.shifts>0);assert.equal(cfg.car.power,130);
});
test('engine protection lowers heat and HKS reduces drag thermal load',()=>{
 const state={...prep(),velocity:45,heat:145};
 const push=simulateDrag(cfg,state,phase(3),card('drag-push')),lift=simulateDrag(cfg,state,phase(3),card('drag-lift'));
 assert.ok(lift.time>push.time);assert.ok(lift.next.heat<state.heat);assert.ok(push.reasons.some(text=>text.includes('Перегрев')));
 const hks=configuration('ae86','ren',['cooling']);
 assert.ok(simulateDrag(hks,state,phase(3),card('drag-push')).next.heat<push.next.heat);
});
test('brakes do not create drag speed; lightweight interior changes acceleration',()=>{
 const base=finishRace(cfg,'dry','yokohama',recipe);
 assert.equal(base.player.time,finishRace(configuration('ae86','ren',['brakes']),'dry','yokohama',recipe).player.time);
 assert.ok(finishRace(configuration('ae86','ren',['weight']),'dry','yokohama',recipe).player.time<base.player.time);
});
test('drag AI avoids a known false start using the same driver and legal actions',()=>{
 let race=createRace(configuration('chaser','aki'),'dry','yokohama');race=resolveSector(race,'drag-burnout');
 const action=chooseAI(race.config,race.player,phase(1),0,futureSectors(race));assert.notEqual(action.card.id,'drag-edge');
 assert.equal(dragReason(action.card,phase(1),race.player),'');
});
for(const car of CARS)for(const pilot of PILOTS)for(const weather of ['dry','rain','mixed']){
 test(`drag integration / ${car.id} / ${pilot.id} / ${weather}`,()=>{
  const config=configuration(car.id,pilot.id),race=finishRace(config,weather,'yokohama');
  assertState(assert,race);assert.equal(race.player.drag.falseStart,false);
  assert.deepEqual(race,finishRace(config,weather,'yokohama'));
  const awarded=awardRace(newCareer(),race),loaded=validateSave(awarded.career);
  assert.equal(loaded.bests.length,1);assert.deepEqual(loaded.bests[0],raceRecord(race));
  const replay=finishRace(configuration(car.id,pilot.id,loaded.bests[0].parts,loaded.bests[0].condition),weather,'yokohama',loaded.bests[0].actions);
  assert.deepEqual(replay.history.map(row=>row.playerTime),loaded.bests[0].sectorTimes);
  assert.ok(Number.isFinite(progressAtTime(loaded.bests[0].sectorTimes,0,'yokohama')));
 });
}
test('all 2673 car/weather/action recipes stay finite, immutable and within bounds',()=>{
 let count=0;
 for(const car of CARS)for(const weather of ['dry','rain','mixed']){
  const config=configuration(car.id,'ren');
  const choices=['prep','launch','shifts','finish'].map(phase=>DRAG_CARDS.filter(card=>card.phase===phase));
  for(const a of choices[0])for(const b of choices[1])for(const c of choices[2])for(const d of choices[3]){
   let state=freshDragState(config);
   for(const [index,action] of [a,b,c,d].entries()){
    const previous=structuredClone(state),result=simulateDrag(config,state,sectorAt(index,weather,'yokohama'),action);
    assert.deepEqual(state,previous);state=result.next;
    assert.ok(Number.isFinite(state.time)&&Number.isFinite(state.velocity));
    assert.ok(state.heat>=35&&state.heat<=200&&state.tires>=0&&state.focus>=0);
   }
   assert.equal(state.drag.distance,402.336);count++;
  }
 }
 assert.equal(count,2673);
});
test('all 64 equipment combinations preserve valid drag results',()=>{
 for(let mask=0;mask<64;mask++){
  const parts=PARTS.slice(0,6).filter((_,i)=>mask&(1<<i)).map(part=>part.id),config=configuration('evo','ren',parts);
  let state=freshDragState(config);
  for(const [index,id] of recipe.entries())state=simulateDrag(config,state,phase(index),card(id)).next;
  assert.ok(state.time>0&&state.drag.et>0&&state.drag.trap>0);
 }
});
test('drag key is independent of road balance version',()=>{
 assert.ok(recordKey(cfg,'haruna','dry').startsWith('8|'));
 assert.ok(recordKey(cfg,'yokohama','dry').startsWith('drag-4|'));
});
