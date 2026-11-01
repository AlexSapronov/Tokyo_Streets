import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,PILOTS,CARDS,sectorAt} from '../src/data.js';
import {configuration,freshState,availableCards,disabledReason,simulate,chooseAI,createRace,resolveSector,futureSectors} from '../src/engine.js';
import {newCareer,validateSave,loadCareer,storeCareer,SAVE_KEY} from '../src/storage.js';
const card=id=>CARDS.find(c=>c.id===id),cfg=configuration('ae86','ren');
function run(config,weather,policy){let r=createRace(config,weather,'haruna',null,42);while(!r.finished){const action=policy?policy(r):chooseAI(r.config,r.player,sectorAt(r.index,weather),r.player.time-r.opponent.time,futureSectors(r)).card.id;r=resolveSector(r,action);}return r;}
test('same state and action give identical complete results',()=>{assert.deepEqual(run(cfg,'mixed'),run(cfg,'mixed'));});
test('all cars and drivers complete every weather without invalid resources',()=>{
 for(const car of CARS)for(const pilot of PILOTS)for(const weather of ['dry','mixed','rain']){
  const config=configuration(car.id,pilot.id),r=run(config,weather);
  assert.equal(r.history.length,8);assert.ok(r.finished);
  assert.ok(r.player.time>0&&Number.isFinite(r.player.time));
  for(const state of [r.player,r.opponent]){assert.ok(state.tires>=0&&state.tires<=100);assert.ok(state.heat>=35&&state.heat<=200);assert.ok(state.focus>=0&&state.focus<=110);}
 }
});
test('AI and player use independent execution draws with identical builds',()=>{
 const r=run(configuration('chaser','aki'),'mixed');assert.notEqual(r.player.time,r.opponent.time);
 assert.equal(r.history[0].execution.range,r.history[0].aiExecution.range);
 assert.notEqual(r.history[0].execution.roll,r.history[0].aiExecution.roll);
});
test('full common set is open from start; character and equipment are conditional',()=>{
 const ids=availableCards(cfg).map(c=>c.id);assert.ok(ids.length>=12);assert.ok(ids.includes('apex'));assert.ok(!ids.includes('rain'));assert.ok(!ids.includes('thermal'));
 assert.ok(availableCards(configuration('ae86','yui',['cooling'])).some(c=>c.id==='rain'));
 assert.ok(availableCards(configuration('ae86','yui',['cooling'])).some(c=>c.id==='thermal'));
});
test('invalid cards cannot be played and do not mutate the race',()=>{
 const r=createRace(cfg),before=structuredClone(r);
 assert.throws(()=>resolveSector(r,'late'),/поворот/);assert.throws(()=>resolveSector(r,'rain'),/недоступна/);assert.deepEqual(r,before);
});
test('slipstream and defence require actual positional windows',()=>{
 const s=sectorAt(0),state=freshState(cfg);
 assert.ok(disabledReason(card('draft'),s,state,cfg,0));assert.equal(disabledReason(card('draft'),s,state,cfg,1),'');assert.ok(disabledReason(card('draft'),s,state,cfg,3));
 assert.equal(disabledReason(card('defend'),s,state,cfg,-1),'');assert.ok(disabledReason(card('defend'),s,state,cfg,1));
});
test('attack costs resources and can be repeated immediately while focus is sufficient',()=>{
 const state=freshState(cfg),s=sectorAt(0),a=simulate(cfg,state,s,card('attack')),b=simulate(cfg,state,s,card('balanced'));
 assert.ok(a.time<b.time);assert.ok(a.next.tires<b.next.tires);assert.ok(a.next.focus<b.next.focus);
 assert.equal(disabledReason(card('attack'),sectorAt(1),a.next,cfg),'');const repeated=simulate(cfg,a.next,sectorAt(1),card('attack'));assert.ok(repeated.next.focus<a.next.focus);
 const second=simulate(cfg,a.next,sectorAt(1),card('balanced'));assert.equal(disabledReason(card('attack'),sectorAt(2),second.next,cfg),'');
});
test('low focus and brake overheating block costly actions',()=>{
 const state={...freshState(cfg),focus:2,heat:160};assert.match(disabledReason(card('late'),sectorAt(2),state,cfg),/фокуса/);
 state.focus=100;assert.match(disabledReason(card('late'),sectorAt(2),state,cfg),/перегреты/);
});
test('brake upgrade affects performance and heat, not horsepower',()=>{
 const upgraded=configuration('ae86','ren',['brakes']),state={...freshState(cfg),velocity:50},s=sectorAt(2);
 const a=simulate(cfg,state,s,card('late')),b=simulate(upgraded,state,s,card('late'));assert.ok(b.time<a.time);assert.ok(b.next.heat<a.next.heat);assert.equal(upgraded.car.power,cfg.car.power);
});
test('semi-slicks have a wet tradeoff and suspension changes weight transfer',()=>{
 const tires=configuration('ae86','ren',['tires']),s=sectorAt(2,'dry'),wet=sectorAt(5,'rain'),state=freshState(cfg);
 assert.ok(simulate(tires,state,s,card('balanced')).time<simulate(cfg,state,s,card('balanced')).time);
 assert.ok(simulate(tires,state,wet,card('balanced')).time>simulate(cfg,state,wet,card('balanced')).time);
 const tein=configuration('ae86','ren',['suspension']);assert.ok(simulate(tein,state,s,card('weight')).time<simulate(cfg,state,s,card('weight')).time);
});
test('cooling, rest and studying have observable downstream effects',()=>{
 const state={...freshState(cfg),heat:130,focus:30},s=sectorAt(1);
 assert.ok(simulate(cfg,state,s,card('cool')).next.heat<state.heat);
 assert.ok(simulate(cfg,state,s,card('breathe')).next.focus>state.focus);
 const studied=simulate(cfg,state,s,card('study')).next;
 assert.ok(simulate(cfg,studied,sectorAt(2),card('balanced')).time<simulate(cfg,{...studied,study:false},sectorAt(2),card('balanced')).time);
});
test('wet weather and vehicle condition change outcome',()=>{
 assert.ok(run(cfg,'rain').player.time>run(cfg,'dry').player.time);
 assert.ok(run(configuration('ae86','ren',[],40),'mixed').player.time>run(cfg,'mixed').player.time);
});
test('race finalization is terminal and input remains immutable',()=>{
 const initial=createRace(cfg),copy=structuredClone(initial);resolveSector(initial,'balanced');assert.deepEqual(initial,copy);
 const r=run(cfg,'mixed');assert.throws(()=>resolveSector(r,'balanced'),/завершён/);
});
test('careful driving and full attack yield different resources and time',()=>{
 const safe=run(cfg,'mixed',()=> 'balanced'),attack=run(cfg,'mixed',r=>disabledReason(card('attack'),sectorAt(r.index),r.player,r.config)?'balanced':'attack');
 assert.notEqual(safe.player.time,attack.player.time);assert.ok(attack.player.tires<safe.player.tires);assert.ok(attack.player.focus<safe.player.focus);
});
test('career save round-trips and local build ownership is respected',()=>{
 const career=newCareer();career.purchased.ae86=['brakes'];career.builds.ae86=['brakes'];assert.deepEqual(validateSave(career),career);
 const bad={...career,car:'unknown',pilot:'fake',money:-10,builds:{ae86:['brakes','cooling','bogus']}};
 const parsed=validateSave(bad);assert.equal(parsed.car,'ae86');assert.equal(parsed.pilot,'ren');assert.equal(parsed.money,0);assert.deepEqual(parsed.builds.ae86,['brakes']);
});
test('corrupt or unavailable storage never prevents a new career',()=>{
 assert.deepEqual(loadCareer({getItem:()=>'{bad json'}),newCareer());
 assert.deepEqual(loadCareer({getItem:()=>{throw Error('denied');}}),newCareer());
 assert.equal(storeCareer({setItem:()=>{throw Error('quota');}},newCareer()),false);
 let saved;const storage={getItem:k=>k===SAVE_KEY?saved:null,setItem:(k,v)=>{saved=v;}};assert.equal(storeCareer(storage,newCareer()),true);assert.deepEqual(loadCareer(storage),newCareer());
});
