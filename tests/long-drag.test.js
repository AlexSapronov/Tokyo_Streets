import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,PILOTS,getEvent,sectorAt,eventLength} from '../src/data.js';
import {ALL_DRAG_CARDS} from '../src/drag-data.js';
import {configuration,createRace,resolveSector,availableCards,simulate,disabledReason} from '../src/engine.js';
import {raceRecord,awardRace,recordKey} from '../src/progress.js';
import {newCareer,validateSave} from '../src/storage.js';
import {freshDragState,simulateDrag} from '../src/drag.js';
import {transmission,readTelemetry,sampleTelemetry} from '../src/telemetry.js';
import {qualitativeForecast,focusCost} from '../src/tactics.js';
import {finishRace,assertState} from './helpers.js';
const cfg=configuration('ae86','ren'),card=id=>ALL_DRAG_CARDS.find(card=>card.id===id);
const full=['drag-burnout','drag-soft','drag-band','drag-sustain','drag-sustain','drag-sustain','drag-push'];
const mixed=['drag-burnout','drag-soft','drag-band','drag-sustain','drag-cooling','drag-bandpull','drag-push'];
function reachPull(config=cfg,prep='drag-burnout'){
 let race=createRace(config,'dry','yokohama-mile',null,42);
 for(const action of [prep,'drag-soft','drag-band'])race=resolveSector(race,action);
 return race;
}
test('half-mile and mile have precise distinct lengths and real high-speed decision windows',()=>{
 const half=getEvent('yokohama-half'),mile=getEvent('yokohama-mile');
 assert.equal(eventLength(half),804.672);assert.equal(eventLength(mile),1609.344);
 assert.equal(half.sectors.length,5);assert.equal(mile.sectors.length,7);
 assert.equal(half.sectors.filter(s=>s.phase==='pull').length,1);assert.equal(mile.sectors.filter(s=>s.phase==='pull').length,3);
 for(const event of [half,mile]){assert.equal(event.sectors[1].length,18.288);assert.ok(event.sectors.every(s=>s.longDrag&&s.totalDistance===event.distance));}
});
test('new actions stay out of quarter-mile action set and explain contextual restrictions',()=>{
 assert.equal(availableCards(cfg,'drag').length,12);assert.equal(availableCards(cfg,'drag','yokohama').length,12);
 assert.equal(availableCards(cfg,'drag','yokohama-mile').length,18);
 const initial=freshDragState(cfg);
 assert.match(disabledReason(card('drag-longgear'),sectorAt(0,'dry','yokohama'),initial,cfg),/Только для/);
 assert.match(disabledReason(card('drag-sustain'),sectorAt(0,'dry','yokohama-mile'),initial,cfg),/Длинный разгон/);
 assert.match(disabledReason(card('drag-top'),sectorAt(3,'dry','yokohama-mile'),initial,cfg),/120/);
});
test('quarter-mile golden reference remains on its original physics and timing',()=>{
 let state=freshDragState(cfg);
 for(const [i,id] of ['drag-burnout','drag-edge','drag-band','drag-clean'].entries())state=simulateDrag(cfg,state,sectorAt(i,'dry','yokohama'),card(id)).next;
 const race={player:state};
 assert.ok(Math.abs(race.player.time-14.808773852676273)<1e-10);
 assert.equal(race.player.drag.longFormat,undefined);assert.equal(race.player.drag.splits,undefined);
 assert.ok(recordKey(cfg,'yokohama','dry').startsWith('drag-2|'));
});
test('long gearing changes actual engine RPM and launch performance without adding power',()=>{
 const base=reachPull(cfg,'drag-pressure'),long=reachPull(cfg,'drag-longgear');
 assert.equal(long.player.drag.gearing,.88);assert.equal(base.config.car.power,long.config.car.power);
 const equalSpeed=180;
 const a=transmission(cfg,equalSpeed,'drag',{...base.player.drag,forceTop:true});
 const b=transmission(cfg,equalSpeed,'drag',{...long.player.drag,forceTop:true});
 assert.ok(b.rpm<a.rpm);assert.notEqual(base.player.drag.sixty,long.player.drag.sixty);
});
test('high pressure trades starting contact for lower high-speed rolling losses',()=>{
 const config=configuration('chaser','ren'),base=reachPull(config,'drag-warm');
 const s=sectorAt(3,'dry','yokohama-mile'),state=structuredClone(base.player);state.velocity=55;state.drag.pressure=1;
 const firm=structuredClone(state);firm.drag.pressure=1.12;
 const a=simulate(config,state,s,card('drag-sustain')),b=simulate(config,firm,s,card('drag-sustain'));
 assert.ok(b.time<a.time);
 const prep=freshDragState(config),sector=sectorAt(0,'dry','yokohama-mile');
 const high=simulate(config,prep,sector,card('drag-pressure-high'));
 assert.equal(high.next.drag.pressure,1.12);assert.equal(high.time,0);
});
for(const car of CARS)test(`cooling beats repeated full throttle over a mile / ${car.id}`,()=>{
 const config=configuration(car.id,'ren'),attack=finishRace(config,'dry','yokohama-mile',full),planned=finishRace(config,'dry','yokohama-mile',mixed);
 assert.ok(planned.player.heat<attack.player.heat);assert.ok(planned.player.time<attack.player.time);
 assert.ok(planned.player.drag.trap>attack.player.drag.trap);assert.ok(planned.player.focus>attack.player.focus);
});
test('repeated long pulls pay the same exponential concentration price that their cards require',()=>{
 let race=reachPull(),costs=[];
 for(let index=0;index<3;index++){
  const s=sectorAt(race.index,'dry','yokohama-mile'),action=card('drag-sustain');
  costs.push(focusCost(race.config,race.player,action));race=resolveSector(race,action.id);
 }
 assert.ok(costs[1]>costs[0]);assert.ok(costs[2]-costs[1]>costs[1]-costs[0]);
 assert.ok(race.player.heat>150);assert.ok(race.history.at(-1).reasons.some(reason=>reason.includes('Повтор')));
 const poor={...race.player,focus:0};assert.equal(disabledReason(card('drag-cooling'),sectorAt(5,'dry','yokohama-mile'),poor,cfg),'');
 assert.match(disabledReason(card('drag-sustain'),sectorAt(5,'dry','yokohama-mile'),poor,cfg),/концентрации/);
});
test('early top gear and returning to power band are distinct real transmission decisions',()=>{
 const start=reachPull(configuration('chaser','ren')),s=sectorAt(3,'dry','yokohama-mile');
 const top=simulate(start.config,start.player,s,card('drag-top'));
 assert.equal(top.next.drag.forceTop,true);assert.equal(top.next.drag.shiftIndex,4);assert.ok(top.next.drag.shifts>start.player.drag.shifts);
 const back=simulate(start.config,top.next,sectorAt(4,'dry','yokohama-mile'),card('drag-bandpull'));
 assert.equal(back.next.drag.forceTop,false);assert.equal(back.next.drag.shiftStyle,'band');
 assert.ok(back.reasons.some(reason=>reason.includes('Передача выбрана')));
 const t=readTelemetry(start.config,top.next,'drag');assert.equal(t.gear,5);assert.ok(t.rpm>0);
});
test('new physics can decelerate at excessive speed instead of forcing positive acceleration forever',()=>{
 const race=reachPull(),state=structuredClone(race.player);state.velocity=320/3.6;state.heat=190;state.drag.forceTop=true;
 const result=simulate(cfg,state,sectorAt(3,'dry','yokohama-mile'),card('drag-cooling'));
 assert.ok(result.next.velocity<state.velocity);assert.ok(result.next.velocity>0);assert.ok(Number.isFinite(result.time));
});
test('splits interpolate real crossing times inside phases and exclude reaction time',()=>{
 const race=finishRace(cfg,'dry','yokohama-mile',mixed),d=race.player.drag;
 assert.deepEqual(d.splits.map(split=>split.distance),[402.336,804.672,1609.344]);
 let last=0;for(const split of d.splits){assert.ok(split.et>last&&split.speed>0);last=split.et;}
 assert.ok(Math.abs(d.splits.at(-1).et-d.et)<1e-8);assert.ok(Math.abs(race.player.time-d.et-d.reaction)<1e-8);
 const firstPullEnd=race.history.slice(0,4).reduce((sum,row)=>sum+row.playerTime,0)-d.reaction;
 assert.ok(d.splits[0].et<firstPullEnd,'402 m crossing must occur within the 300–600 m phase');
});
for(const eventId of ['yokohama-half','yokohama-mile'])for(const car of CARS){
 test(`long drag complete/save/replay matrix / ${eventId} / ${car.id}`,()=>{
  for(const pilot of PILOTS)for(const weather of ['dry','mixed','rain']){
   const config=configuration(car.id,pilot.id),race=finishRace(config,weather,eventId);assertState(assert,race);
   assert.deepEqual(race,finishRace(config,weather,eventId));
   assert.ok(Math.abs(race.player.drag.distance-eventLength(getEvent(eventId)))<1e-8);assert.ok(race.player.drag.trap>0);
   const result=awardRace(newCareer(),race),loaded=validateSave(result.career),record=loaded.bests[0];
   assert.deepEqual(record,raceRecord(race));
   const replay=finishRace(configuration(record.carId,record.pilotId,record.parts,record.condition),weather,eventId,record.actions);
   assert.deepEqual(replay.history.map(row=>row.playerTime),record.sectorTimes);assert.deepEqual(replay.player.drag.splits,record.drag.splits);
   const panel=sampleTelemetry(config,'drag',record,record.time*.8);assert.ok(Number.isFinite(panel.rpm));
  }
 });
}
test('partial, nonfinite and mismatched long-format split records are rejected individually',()=>{
 const record=raceRecord(finishRace(cfg,'dry','yokohama-mile',mixed));
 const bads=[{longFormat:false},{gearing:NaN},{gearing:2},{forceTop:null},{distance:804},{et:record.drag.et+1},{splits:[]},
  {splits:record.drag.splits.map((s,i)=>i? s:{...s,distance:NaN})},
  {splits:record.drag.splits.map((s,i)=>i? s:{...s,et:0})},
  {splits:record.drag.splits.map((s,i)=>i? s:{...s,speed:Infinity})}];
 for(const patch of bads){const loaded=validateSave({...newCareer(),bests:[{...record,drag:{...record.drag,...patch}},record]});assert.equal(loaded.bests.length,1);}
});
test('long-format forecast stays qualitative and never reveals exact future ET or split results',()=>{
 const race=reachPull(),s=sectorAt(3,'dry','yokohama-mile');
 for(const action of ALL_DRAG_CARDS.filter(card=>card.phase==='pull')){
  const result=simulate(cfg,race.player,s,action),forecast=qualitativeForecast(cfg,race.player,s,action,result);
  assert.ok(!JSON.stringify(forecast).includes(result.time.toFixed(3)));assert.ok(!JSON.stringify(forecast).includes(result.next.drag.et.toFixed(3)));
 }
});
test('replay instruments retain recorded manual top gear rather than the final automatic mode',()=>{
 const race=finishRace(configuration('chaser','ren'),'dry','yokohama-mile',['drag-burnout','drag-soft','drag-band','drag-top','drag-bandpull','drag-cooling','drag-push']);
 const record=raceRecord(race),index=3;
 const start=record.sectorTimes.slice(0,index).reduce((sum,t)=>sum+t,0);
 const frame=sampleTelemetry(race.config,'drag',record,start+record.sectorTimes[index]*.9);
 assert.equal(record.drag.forceTop,false);assert.equal(record.telemetry[index].gear,5);assert.equal(frame.gear,5);
 const from=record.telemetry[index-1],to=record.telemetry[index];
 assert.equal(frame.rpm,Math.round(from.rpm+(to.rpm-from.rpm)*.9));
});
