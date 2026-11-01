import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,EVENTS,CARDS,PARTS,sectorAt,getEvent} from '../src/data.js';
import {configuration,createRace,resolveSector,simulate,freshState,raceOutcome} from '../src/engine.js';
import {raceClass,rewardFactor,medalPrize,unlockEverything} from '../src/balance.js';
import {serviceCost,componentRepairCost,repairComponent,recoveryService,tradeInCar,selectCar} from '../src/garage.js';
import {awardRace,recordKey,raceRecord,bestFor} from '../src/progress.js';
import {newCareer,validateSave} from '../src/storage.js';
import {regulationReason,getCup} from '../src/championship.js';
import {STAFF,supportCost,hireStaff,bookSupport,repairMultiplier} from '../src/operations.js';
import {DRIFT_CARDS} from '../src/drift-data.js';
import {repetitionEffect} from '../src/tactics.js';
import {benchmark} from '../src/bench.js';
import {finishRace} from './helpers.js';
const cfg=configuration('ae86','ren'),action=id=>CARDS.find(c=>c.id===id);
const rich=()=>unlockEverything(newCareer());
test('all medal purses strictly improve with result and agree with advertised venue gold',()=>{
 for(const event of EVENTS.filter(e=>['timeattack','drift'].includes(e.mode))){
  const purses=[null,'bronze','silver','gold'].map(m=>medalPrize(event,m));
  for(let i=1;i<purses.length;i++)assert.ok(purses[i]>purses[i-1],event.id);
  assert.equal(purses[3],event.prize,event.id);
  for(const car of CARS){
   const config=configuration(car.id,'ren'),race=createRace(config,'dry',event.id);
   const scores=event.mode==='drift'?[0,event.medals.bronze,event.medals.silver,event.medals.gold]:[race.targets.bronze+1,race.targets.bronze,race.targets.silver,race.targets.gold];
   const actual=scores.map(score=>{const r=structuredClone(race);if(event.mode==='drift')r.player.drift.score=score;else r.player.time=score;return raceOutcome(r).reward;});
   assert.equal(actual[3],Math.round(event.prize*rewardFactor(config,event.mode)));
   for(let i=1;i<actual.length;i++)assert.ok(actual[i]>actual[i-1]);
  }
 }
});
test('installed healthy build fixes class and regulations even with a worn swapped engine',()=>{
 for(const car of CARS){
  const healthy=configuration(car.id,'ren',['ecu','exhaust','slicks']),worn=configuration(car.id,'ren',['ecu','exhaust','slicks'],35,{},null,{engine:0,transmission:0});
  assert.deepEqual(raceClass(healthy),raceClass(worn));
 }
 const legal=configuration('ae86','ren'),illegal=configuration('ae86','ren',['ecu'],100,{},'ls3',{engine:0});
 assert.equal(regulationReason(legal,getCup('club')),'');assert.match(regulationReason(illegal,getCup('club')),/Лимит/);
});
test('tire loss is billed through the tire node once, independently of body condition',()=>{
 let race=createRace(cfg,'dry','haruna',null,42);while(!race.finished)race=resolveSector(race,'balanced');
 const a=structuredClone(race),b=structuredClone(race);a.player.tires=90;b.player.tires=60;
 const ca=awardRace(newCareer(),a).career,cb=awardRace(newCareer(),b).career;
 assert.equal(ca.condition.ae86,cb.condition.ae86);
 assert.equal(serviceCost(cb)-serviceCost(ca),componentRepairCost(cb,'stockTires')-componentRepairCost(ca,'stockTires'));
 const fixed=repairComponent(cb,'stockTires');assert.equal(fixed.wear.ae86.stockTires,100);assert.equal(fixed.condition.ae86,cb.condition.ae86);
});
test('stock FR gold drift and neutral Time Attack can fund full maintenance at repeat payout floor',()=>{
 for(const eventId of ['ebisu','haruna-drift','tsukuba','suzuka','fuji']){
  const race=finishRace(cfg,'dry',eventId);race.rewardScale=.5;
  const after=awardRace(newCareer(),race).career;
  assert.ok(raceOutcome(race).reward>serviceCost(after),eventId);
 }
});
test('archived mechanics cannot discount current service or charge a championship start',()=>{
 const career=rich(),damage=structuredClone(career);damage.condition.ae86=90;
 const supported=structuredClone(damage);supported.operations.staff.mechanic=2;
 assert.equal(serviceCost(supported),serviceCost(damage));
});
test('resource recovery repetitions never become a tire destruction multiplier in other disciplines',()=>{
 const reset=DRIFT_CARDS.find(c=>c.reset),race=createRace(cfg,'dry','ebisu'),s=sectorAt(0,'dry','ebisu');
 const first=simulate(cfg,race.player,s,reset),repeated=simulate(cfg,{...race.player,recentActions:Array(6).fill(reset.id)},s,reset);
 assert.equal(first.next.tires,repeated.next.tires);assert.equal(repeated.time,first.time);
 for(const c of [...CARDS,...DRIFT_CARDS])assert.ok(repetitionEffect({recentActions:Array(6).fill(c.id)},c).wearFactor<=3);
});
test('hot oil and coolant reduce road acceleration without pretending that throttle heats brake discs',()=>{
 const state={...freshState(cfg),velocity:35},s=sectorAt(0,'dry','wangan');
 const cold=simulate(cfg,state,s,action('balanced'));
 const hot=simulate(cfg,{...state,telemetry:{oil:170,coolant:120}},s,action('balanced'));
 assert.ok(hot.time>cold.time&&hot.speed<cold.speed);
 assert.ok(hot.reasons.some(r=>r.includes('Перегрев мотора')));
 assert.ok(hot.next.heat<state.heat&&cold.next.heat<state.heat);
});
test('power tuning heats road oil; cooling hardware has an observable thermal use',()=>{
 const power=['ecu','turbo','exhaust','clutch'];
 const trial=parts=>{const config=configuration('s13','ren',parts);let state=freshState(config);for(let lap=0;lap<3;lap++)for(let i=0;i<getEvent('wangan').sectors.length;i++)state=simulate(config,state,sectorAt(i,'dry','wangan'),action('balanced')).next;return state;};
 const stock=trial([]),tuned=trial(power),cooled=trial([...power,'cooling','radiator','intercooler']);
 assert.ok(tuned.telemetry.oil>stock.telemetry.oil+5);
 assert.ok(cooled.telemetry.oil<tuned.telemetry.oil);
});
test('all changed physics groups retain previous replays as archives through reload',()=>{
 for(const [eventId,prefix] of [['haruna','6'],['ebisu','drift-2'],['yokohama-mile','drag-2']]){
  const race=finishRace(cfg,'dry',eventId),record=raceRecord(race);record.key=prefix+record.key.slice(record.key.indexOf('|'));
  const saved=validateSave({...newCareer(),bests:[record]});
  assert.equal(saved.bests[0].key,record.key);assert.equal(bestFor(saved,cfg,eventId,'dry'),null);assert.notEqual(recordKey(cfg,eventId,'dry'),record.key);
 }
});
test('buy/trade cycles consume money and recovery debt remains a liability after selling the repaired car',()=>{
 let c=newCareer();c.money=0;c.condition.ae86=35;
 c=recoveryService(c);const debt=c.repairDebt;c.money=100000;const prior=c.money;assert.ok(debt>0);
 c=tradeInCar(c,'mx5');c=tradeInCar(c,'ae86');assert.ok(c.money<prior);assert.equal(c.repairDebt,debt);
});

test('classic clean laps retain bronze access without requiring line mastery',()=>{
 for(const car of CARS)for(const event of EVENTS.filter(e=>e.mode==='timeattack'))for(const weather of ['dry','rain']){
  const config=configuration(car.id,'ren'),race=createRace(config,weather,event.id);let state=freshState(config);
  for(let i=0;i<event.sectors.length;i++)state=simulate(config,state,sectorAt(i,weather,event.id),action('balanced')).next;
  assert.ok(state.time<race.targets.bronze,car.id+' '+event.id+' '+weather);
 }
});
