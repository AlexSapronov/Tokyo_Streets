import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,CARS,EVENTS,sectorAt,getEvent} from '../src/data.js';
import {configuration,freshState,simulate,createRace,resolveSector} from '../src/engine.js';
import {recordKey,bestFor,raceRecord} from '../src/progress.js';
import {settleWear} from '../src/wear.js';
import {unlockEverything} from '../src/balance.js';
import {newCareer,validateSave} from '../src/storage.js';
const card=id=>CARDS.find(c=>c.id===id);
const config=configuration('nsx','ren',['slicks']);
function lap(cfg,eventId,action='balanced',tires=100){
 let state={...freshState(cfg),tires};
 for(let i=0;i<getEvent(eventId).sectors.length;i++)state=simulate(cfg,state,sectorAt(i,'dry',eventId),card(action)).next;
 return state;
}
test('Suzuka slicks survive two neutral laps on every chassis, with meaningful wear',()=>{
 for(const car of CARS){
  const cfg=configuration(car.id,'ren',['slicks']);
  const first=lap(cfg,'suzuka'),second=lap(cfg,'suzuka','balanced',first.tires);
  assert.ok(100-first.tires>7&&100-first.tires<20,`${car.id}: ${first.tires}`);
  assert.ok(second.tires>60&&second.tires<first.tires);
 }
});
test('shorter Fuji lap consumes less rubber; preserving repeatedly always saves tires',()=>{
 for(const car of CARS){
  const cfg=configuration(car.id,'ren',['slicks']);
  assert.ok(lap(cfg,'fuji').tires>lap(cfg,'suzuka').tires);
  for(const event of EVENTS.filter(e=>['duel','timeattack'].includes(e.mode)))assert.ok(lap(cfg,event.id,'preserve').tires>lap(cfg,event.id).tires,car.id+' '+event.id);
 }
});
test('rubber cost scales with distance, and tire compounds retain their durability tradeoff',()=>{
 const s=sectorAt(2,'dry','suzuka'),state=freshState(config);
 const short=simulate(config,state,s,card('balanced')),long=simulate(config,state,{...s,length:s.length*2},card('balanced'));
 assert.ok(Math.abs((100-long.next.tires)-2*(100-short.next.tires))<1e-9);
 const remaining=['streetTires','tires','slicks'].map(tire=>lap(configuration('nsx','ren',[tire]),'suzuka').tires);
 assert.ok(remaining[0]>remaining[1]&&remaining[1]>remaining[2]);
});
test('airflow cools hot brakes on straights even under attack; duration, speed and temperature matter',()=>{
 const state={...freshState(config),heat:160,velocity:45},straight={...sectorAt(0,'dry','suzuka'),length:500};
 const normal=simulate(config,state,straight,card('balanced'));
 const longer=simulate(config,state,{...straight,length:1500},card('balanced'));
 const attack=simulate(config,state,{...straight,length:1500},card('attack'));
 assert.ok(longer.next.heat<normal.next.heat&&normal.next.heat<state.heat);
 assert.ok(attack.next.heat<state.heat&&attack.next.heat>longer.next.heat);
 assert.ok(simulate(config,state,{...straight,length:200},card('attack')).next.heat<state.heat);
 // Same duration, different airflow; cold brakes cannot cool below the floor.
 const duration=normal.time,slow=simulate(config,{...state,velocity:20},straight,card('balanced'));
 const fast=simulate(config,{...state,velocity:60},straight,card('balanced'));
 const coolingRate=r=>-Math.log((r.next.heat-35)/(state.heat-35))/r.time;
 assert.ok(coolingRate(fast)>coolingRate(slow)&&duration>0);
 assert.equal(simulate(config,{...state,heat:35},straight,card('balanced')).next.heat,35);
 assert.ok(normal.reasons.some(r=>r.includes('охлаждение обдувом')));
});
test('braking and attacks still heat brakes; hardware helps, engine tune does not heat discs directly',()=>{
 const state={...freshState(config),velocity:60},corner=sectorAt(5,'dry','suzuka');
 const normal=simulate(config,state,corner,card('balanced')),late=simulate(config,state,corner,card('late'));
 assert.ok(normal.next.heat>state.heat&&late.next.heat>normal.next.heat);
 const repeated=simulate(config,{...state,recentActions:['late','balanced','late']},corner,card('late'));
 assert.equal(repeated.next.heat,late.next.heat);
 const upgraded=configuration('nsx','ren',['slicks','brakes','pads']);
 assert.ok(simulate(upgraded,state,corner,card('late')).next.heat<late.next.heat);
 const engineHeat={...config,car:{...config.car,heatFactor:99,engineHeat:99}};
 assert.equal(simulate(engineHeat,state,corner,card('balanced')).next.heat,normal.next.heat);
 for(const car of CARS){const cfg=configuration(car.id,'ren',['slicks']);assert.ok(lap(cfg,'suzuka').heat<155);}
});
test('wear persists across actual finishes and reloads; previous road records stay archived',()=>{
 let career=unlockEverything(newCareer());career.car='r34';career.builds.r34=['slicks'];
 let first;
 for(let lap=0;lap<2;lap++){
  const cfg=configuration('r34','ren',['slicks'],100,{},null,career.wear.r34);
  let race=createRace(cfg,'dry','suzuka',null,42);
  while(!race.finished)race=resolveSector(race,'balanced');
  assert.equal(race.player.dnf,undefined);assert.equal(race.history.length,12);
  const record=raceRecord(race);assert.ok(record.key.startsWith('8|'));
  career=settleWear(career,race);
  const old={...record,key:record.key.replace(/^8\|/,'6|')};
  career=validateSave({...career,bests:[old]});
  assert.equal(career.bests[0].key,old.key);assert.equal(bestFor(career,cfg,'suzuka','dry'),null);
  assert.equal(career.wear.r34.slicks,race.player.tires);
  if(lap===0)first=race.player.tires;
  else assert.ok(race.player.tires<first&&race.player.tires>60);
 }
 assert.ok(recordKey(config,'yokohama','dry').startsWith('drag-4|'));
 assert.ok(recordKey(config,'ebisu','dry').startsWith('drift-4|'));
});
