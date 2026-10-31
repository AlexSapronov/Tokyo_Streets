import test from 'node:test';
import assert from 'node:assert/strict';
import {focusRange,executionRoll,hashSeed,newSeed,executionLabel,runOffChance} from '../src/execution.js';
import {configuration,createRace,resolveSector,simulate,chooseAI,futureSectors,availableCards} from '../src/engine.js';
import {CARDS,EVENTS,sectorAt} from '../src/data.js';
import {ALL_DRAG_CARDS} from '../src/drag-data.js';
import {DRIFT_CARDS} from '../src/drift-data.js';
import {qualitativeForecast} from '../src/tactics.js';
import {raceRecord,awardRace} from '../src/progress.js';
import {newCareer,validateSave} from '../src/storage.js';
import {assertState} from './helpers.js';
const cfg=configuration('ae86','ren'),balanced=CARDS.find(c=>c.id==='balanced');
test('focus monotonically widens a bounded range, including 110 focus and malformed input',()=>{
 assert.equal(focusRange(100),.008);assert.equal(focusRange(0),.16);assert.equal(focusRange(50),.046);
 assert.equal(focusRange(110),focusRange(100));assert.equal(focusRange(-50),focusRange(0));assert.equal(focusRange(NaN),focusRange(0));
 for(let focus=1;focus<=100;focus++)assert.ok(focusRange(focus)<focusRange(focus-1));
 assert.equal(executionLabel(100),'Стабильное исполнение');assert.equal(executionLabel(60),'Заметный разброс исполнения');assert.equal(executionLabel(10),'Сильный разброс исполнения');
});
test('seeded draws are repeatable, bounded, independent by side and sector, and unbiased',()=>{
 const stats={player:[],opponent:[]};
 for(let seed=0;seed<10000;seed++)for(const side of Object.keys(stats)){
  const roll=executionRoll(seed,2,side,20);assert.deepEqual(roll,executionRoll(seed,2,side,20));
  assert.ok(Math.abs(roll.error)<=focusRange(20));stats[side].push(roll.roll);
 }
 for(const rolls of Object.values(stats)){assert.ok(Math.abs(rolls.reduce((a,b)=>a+b)/rolls.length)<.025);assert.ok(Math.min(...rolls)<-.99);assert.ok(Math.max(...rolls)>.99);}
 assert.notEqual(executionRoll(42,0,'player',100).roll,executionRoll(42,0,'opponent',100).roll);
 assert.notEqual(executionRoll(42,0,'player',100).roll,executionRoll(42,1,'player',100).roll);
 assert.equal(hashSeed('run'),hashSeed('run'));assert.notEqual(hashSeed('run'),hashSeed('next'));
 const seeds=new Set(Array.from({length:20},newSeed));assert.equal(seeds.size,20);
});
test('actual time variance grows as focus falls without shifting its expected timing',()=>{
 const sector=sectorAt(0,'dry'),initial=createRace(cfg,'dry','haruna',null,42).player;
 for(const focus of [100,50,0]){
  const state={...initial,focus},base=simulate(cfg,state,sector,balanced).time;
  const deltas=Array.from({length:3000},(_,seed)=>simulate(cfg,state,sector,balanced,executionRoll(seed,0,'player',focus)).time/base-1);
  const mean=deltas.reduce((a,b)=>a+b)/deltas.length;
  const variance=deltas.reduce((a,b)=>a+b*b)/deltas.length;
  assert.ok(Math.abs(mean)<focusRange(focus)*.025);
  assert.ok(Math.abs(variance-focusRange(focus)**2/3)<focusRange(focus)**2*.025);
 }
});
test('new races get new seeds; explicit seed and run ID reproduce execution',()=>{
 assert.notEqual(createRace(cfg).seed,createRace(cfg).seed);
 assert.equal(createRace(cfg,'dry','haruna','same').seed,createRace(cfg,'dry','haruna','same').seed);
 const race=createRace(cfg,'dry','haruna',null,42),copy=structuredClone(race);
 assert.deepEqual(resolveSector(race,'balanced'),resolveSector(copy,'balanced'));assert.deepEqual(race,copy);
 assert.notEqual(resolveSector({...race,seed:43},'balanced').player.time,resolveSector(race,'balanced').player.time);
 const legacy={...race};delete legacy.seed;assert.deepEqual(resolveSector(legacy,'balanced'),resolveSector(legacy,'balanced'));
});
test('planning and forecast never sample or reveal actual execution, and do not reroll it',()=>{
 const race=createRace(cfg,'dry','haruna',null,42),s=sectorAt(0,'dry');
 const plan=chooseAI(cfg,race.player,s,0,futureSectors(race));
 assert.equal(plan.result.execution,undefined);
 for(let i=0;i<10;i++)for(const card of availableCards(cfg))simulate(cfg,race.player,s,card);
 assert.deepEqual(plan,chooseAI(cfg,race.player,s,0,futureSectors(race)));
 const forecast=qualitativeForecast(cfg,race.player,s,balanced,simulate(cfg,race.player,s,balanced));
 assert.ok(!JSON.stringify(forecast).includes('roll'));assert.equal(forecast.execution,'Стабильное исполнение');
 const result=resolveSector(race,'balanced');assert.equal(result.history[0].execution.roll,executionRoll(42,0,'player',race.player.focus).roll);
 assert.equal(result.history[0].aiExecution.roll,executionRoll(42,0,'opponent',race.opponent.focus).roll);
});
test('rest uses starting focus, and stabilizes the next action',()=>{
 const race=createRace(cfg,'dry','haruna',null,42);race.player.focus=5;
 const next=resolveSector(race,'breathe');assert.equal(next.history[0].execution.range,focusRange(5));
 assert.ok(next.player.focus>5);const final=resolveSector(next,'balanced');assert.ok(final.history[1].execution.range<next.history[0].execution.range);
});
test('drag execution affects prep, reaction, ET and shifts; a risky start can false-start',()=>{
 let race=createRace(cfg,'dry','yokohama',null,42),s=sectorAt(0,'dry','yokohama');
 const prep=ALL_DRAG_CARDS.find(c=>c.id==='drag-burnout');
 const a=simulate(cfg,race.player,s,prep,{error:-.16}),b=simulate(cfg,race.player,s,prep,{error:.16});
 assert.notEqual(a.next.drag.temperature,b.next.drag.temperature);assert.notEqual(a.next.drag.rpm,b.next.drag.rpm);
 race=resolveSector(race,prep.id);s=sectorAt(1,'dry','yokohama');
 const launch=ALL_DRAG_CARDS.find(c=>c.id==='drag-edge');
 const early=simulate(cfg,race.player,s,launch,{error:-.16}),late=simulate(cfg,race.player,s,launch,{error:.16});
 assert.ok(early.next.drag.falseStart);assert.ok(!late.next.drag.falseStart);assert.ok(early.next.drag.et<late.next.drag.et);
 const state=late.next,shifts=ALL_DRAG_CARDS.find(c=>c.id==='drag-band');s=sectorAt(2,'dry','yokohama');
 assert.ok(simulate(cfg,state,s,shifts,{error:-.16}).time<simulate(cfg,state,s,shifts,{error:.16}).time);
});
test('drift execution changes real angle and line scoring rather than only the clock',()=>{
 const race=createRace(cfg,'dry','ebisu',null,42),sector=sectorAt(0,'dry','ebisu'),card=DRIFT_CARDS.find(c=>c.phase==='init');
 const a=simulate(cfg,race.player,sector,card,{error:-.16}),b=simulate(cfg,race.player,sector,card,{error:.16});
 assert.notEqual(a.clip.angleDegrees,b.clip.angleDegrees);assert.notEqual(a.clip.line,b.clip.line);assert.notEqual(a.clip.points,b.clip.points);
});
for(const event of EVENTS)test(`seeded integration and recorded replay data / ${event.id}`,()=>{
 for(const seed of [0,42,4294967295]){
  let race=createRace(cfg,'rain',event.id,null,seed);
  while(!race.finished){const s=sectorAt(race.index,'rain',event.id),choice=chooseAI(cfg,race.player,s,race.player.time-race.opponent.time,futureSectors(race));race=resolveSector(race,choice.card.id);}
  assertState(assert,race);
  for(const row of race.history){assert.ok(row.execution);if(['duel','drag'].includes(event.mode))assert.ok(row.aiExecution);}
  const record=raceRecord(race),loaded=validateSave(awardRace(newCareer(),race).career);
  if(!race.player.dnf&&!race.player.drag?.falseStart){assert.deepEqual(loaded.bests[0],record);assert.equal(record.seed,seed);}
  let repeated=createRace(cfg,'rain',event.id,null,seed);
  for(const id of record.actions)repeated=resolveSector(repeated,id);
  assert.deepEqual(repeated,race);
 }
});
