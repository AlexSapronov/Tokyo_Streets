import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,sectorAt} from '../src/data.js';
import {DRAG_CARDS} from '../src/drag-data.js';
import {configuration,freshState,simulate,disabledReason,createRace,resolveSector} from '../src/engine.js';
import {repetitionEffect,rememberAction,focusCost,qualitativeForecast,HABIT_WINDOW} from '../src/tactics.js';
import {newCareer,validateSave} from '../src/storage.js';
import {recordKey,bestFor,raceRecord} from '../src/progress.js';
import {finishRace} from './helpers.js';
const config=configuration('ae86','ren'),attack=CARDS.find(card=>card.id==='attack'),balanced=CARDS[0];
const sector=sectorAt(0,'dry');

test('repetition increases focus costs exponentially without other direct penalties',()=>{
 const effects=Array.from({length:6},(_,repeats)=>repetitionEffect({...freshState(config),recentActions:Array(repeats).fill('attack')},attack));
 assert.deepEqual(effects.map(e=>(e.focusFactor-1)/.35).map(Math.round),[0,1,3,7,15,31]);
 assert.ok(effects.every(e=>e.timeFactor===1&&e.wearFactor===1&&e.heatExtra===0&&e.strain===0));
});
test('one filler card does not erase attack spam, but six other choices let it recover',()=>{
 const state=freshState(config);state.recentActions=['attack','balanced','attack','balanced'];
 assert.equal(repetitionEffect(state,attack).repeats,2);
 for(let i=0;i<HABIT_WINDOW;i++)state.recentActions=rememberAction(state,balanced);
 assert.equal(repetitionEffect(state,attack).repeats,0);assert.equal(state.recentActions.length,HABIT_WINDOW);
});
test('a repeated attack keeps its original tempo and mechanical effect at equal focus',()=>{
 const state={...freshState(config),recentActions:['attack','balanced','attack','balanced']};
 const repeated=simulate(config,state,sector,attack),safe=simulate(config,state,sector,balanced),fresh=simulate(config,freshState(config),sector,attack);
 assert.ok(repeated.time<safe.time);assert.equal(repeated.time,fresh.time);assert.equal(repeated.next.tires,fresh.next.tires);assert.equal(repeated.next.heat,fresh.next.heat);assert.equal(repeated.risk,fresh.risk);
 assert.ok(repeated.next.focus<fresh.next.focus);assert.ok(repeated.reasons.some(reason=>reason.includes('прямого штрафа темпа нет')));
});
test('actual concentration cost, card availability and simulation agree on repeated actions',()=>{
 const state={...freshState(config),recentActions:['attack','balanced','attack'],focus:25};
 const cost=focusCost(config,state,attack);assert.ok(cost>25);
 assert.match(disabledReason(attack,sector,state,config),/повторов/);
 const full={...state,focus:100};const result=simulate(config,full,sector,attack);
 assert.ok(Math.abs((100-result.next.focus)-focusCost(config,full,attack))<1e-9);
});
test('resource restoration has diminishing returns on repeat, while basic pace always remains playable',()=>{
 const rest=CARDS.find(card=>card.id==='breathe'),state={...freshState(config),focus:10};
 const fresh=simulate(config,state,sector,rest),repeated=simulate(config,{...state,recentActions:Array(6).fill(rest.id)},sector,rest);
 assert.ok(repeated.next.focus-state.focus<fresh.next.focus-state.focus);assert.ok(repeated.next.focus>state.focus);
 const exhausted={...state,focus:0,recentActions:Array(6).fill('balanced')};
 assert.equal(disabledReason(balanced,sector,exhausted,config),'');assert.equal(repetitionEffect(exhausted,balanced).strain,0);
 assert.equal(simulate(config,exhausted,sector,balanced).time,simulate(config,{...exhausted,recentActions:[]},sector,balanced).time);
});
test('alternating attack with a filler accumulates pressure in an actual race',()=>{
 let race=createRace(config,'dry');const costs=[];
 for(const id of ['attack','balanced','attack','balanced']){
  if(id==='attack')costs.push(focusCost(config,race.player,attack));
  race=resolveSector(race,id);
 }
 assert.ok(costs[1]>costs[0]);assert.equal(repetitionEffect(race.player,attack).repeats,2);
 const result=simulate(config,race.player,sectorAt(4,'dry'),attack);
 const fresh=simulate(config,{...race.player,recentActions:[],strain:0},sectorAt(4,'dry'),attack);assert.equal(result.time,fresh.time);assert.ok(result.gain>0,'repeat must retain its tempo advantage while focus is available');
});
test('forecast exposes categories without exact durations or the simulated time',()=>{
 for(const card of CARDS){
  const state=freshState(config);const s=sectorAt(card.only==='corner'?2:0,'rain');
  const result=simulate(config,state,s,card),forecast=qualitativeForecast(config,state,s,card,result);
  assert.deepEqual(Object.keys(forecast).sort(),['execution','focus','habit','load','pace','warning','wear']);
  for(const value of Object.values(forecast))assert.equal(typeof value,'string');
  assert.ok(!JSON.stringify(forecast).includes(result.time.toFixed(2)));
  assert.ok(!JSON.stringify(forecast).includes('секунд'));
 }
});
test('qualitative forecast communicates repetition, high load, overheating, and a known false start',()=>{
 const hot={...freshState(config),focus:25,heat:160,tires:30,recentActions:['attack','balanced','attack']};
 const longCorner={...sectorAt(2,'dry'),length:1200};
 const forecast=qualitativeForecast(config,hot,longCorner,attack,simulate(config,hot,longCorner,attack));
 assert.match(forecast.habit,/3-е/);assert.equal(forecast.load,'Высокая');const fresh={...hot,recentActions:[]};assert.equal(forecast.wear,qualitativeForecast(config,fresh,longCorner,attack,simulate(config,fresh,longCorner,attack)).wear);
 const safe={...freshState(config),heat:120};
 assert.match(qualitativeForecast(config,safe,sector,balanced,simulate(config,safe,sector,balanced)).warning,/Перегрев/);
 let drag=createRace(configuration('evo','aki'),'dry','yokohama');drag=resolveSector(drag,'drag-warm');
 const card=DRAG_CARDS.find(card=>card.id==='drag-edge'),s=sectorAt(1,'dry','yokohama'),prediction=simulate(drag.config,drag.player,s,card);
 const out=qualitativeForecast(drag.config,drag.player,s,card,prediction);
 assert.equal(out.pace,'Недействительный старт');assert.match(out.warning,/Фальстарт/);
});
test('old road records remain replayable archives and never masquerade as a fresh-balance ghost',()=>{
 const record=raceRecord(finishRace(config,'dry')),old={...record,key:'2'+record.key.slice(record.key.indexOf('|'))};
 const career=validateSave({...newCareer(),bests:[old]});
 assert.equal(career.bests.length,1);assert.equal(career.bests[0].key,old.key);
 assert.equal(bestFor(career,config,'haruna','dry'),null);assert.ok(recordKey(config,'haruna','dry').startsWith('8|'));
});
