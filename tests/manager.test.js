import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS,PILOTS,sectorAt} from '../src/data.js';
import {CREW,ORDERS,foundTeam,hirePilot,assignPilot,setTeamPlan,defaultPlan,normalizeCommandRecord} from '../src/team.js';
import {beginManagedRace,setManagerOrder,interpretOrder,decideManagedAction,resolveManagedSector,orderPolicy} from '../src/manager.js';
import {resolveSector,disabledReason,availableCards} from '../src/engine.js';
import {newCareer,validateSave} from '../src/storage.js';
import {awardRace,raceRecord} from '../src/progress.js';
function careerFor(pilotId='ren'){
 let career={...newCareer(),money:1e6,races:10,street:40,official:30};
 career=hirePilot(foundTeam(career),pilotId);return assignPilot(career,pilotId);
}
function start(pilotId='ren',eventId='haruna',order='balanced',rules={focus:false,heat:false,wet:false,chase:false}){
 const career=setTeamPlan(careerFor(pilotId),{order,rules});return beginManagedRace(career,eventId,'mixed','manager-test');
}
test('starting a managed race is atomic, snapshots the plan and charges salary once',()=>{
 const career=careerFor(),before=structuredClone(career),started=beginManagedRace(career,'haruna','dry','new-run');
 assert.equal(started.career.money,career.money-CREW.ren.salary);assert.deepEqual(career,before);
 assert.deepEqual(started.race.manager.plan,career.team.plan);started.race.manager.plan.rules.wet=true;
 assert.equal(career.team.plan.rules.wet,false);assert.equal(started.race.manager.trust,70);
});
test('booking rejects missing contracts, locked events, insufficient cash and recycled IDs',()=>{
 assert.throws(()=>beginManagedRace(newCareer(),'haruna','dry','x'),/контракт/);
 const career=careerFor();assert.throws(()=>beginManagedRace({...career,money:0},'haruna','dry','x'),/денег/);
 assert.throws(()=>beginManagedRace({...career,street:0},'akagi','dry','x'),/закрыто/);
 for(const id of ['',null])assert.throws(()=>beginManagedRace(career,'haruna','dry',id),/идентификатор/);
 assert.throws(()=>beginManagedRace({...career,awardedRuns:['old']},'haruna','dry','old'),/идентификатор/);
});
test('runtime orders are validated and do not rewrite prior sector history',()=>{
 let {race}=start();const initial=structuredClone(race);race=setManagerOrder(race,'safe');assert.deepEqual(initial.manager.log,[]);
 assert.equal(race.manager.order,'safe');assert.throws(()=>setManagerOrder(race,'fake'),/Неизвестный/);
 assert.throws(()=>setManagerOrder({...race,finished:true},'attack'),/не активен/);
 assert.throws(()=>interpretOrder({...race,manager:null}),/не активен/);
 assert.throws(()=>setManagerOrder({...race,manager:null},'safe'),/не активен/);
 const next=resolveManagedSector(race);assert.equal(next.manager.log.length,1);assert.equal(race.manager.log.length,0);
 assert.equal(next.history[0].command.cardId,next.history[0].cardId);
});
test('conditional plan priority is focus, temperature, wet surface, then chase',()=>{
 let {race}=start('ren','haruna','balanced',{focus:true,heat:true,wet:true,chase:true});
 race.player.focus=20;race.player.heat=150;race.player.time=5;
 assert.equal(interpretOrder(race).trigger,'focus');race.player.focus=100;
 assert.equal(interpretOrder(race).trigger,'heat');race.player.heat=55;race.index=5;
 assert.equal(interpretOrder(race).trigger,'wet');race.index=0;
 assert.equal(interpretOrder(race).trigger,'chase');
 const solo=start('ren','tsukuba','balanced',{chase:true}).race;solo.player.time=10;
 assert.equal(interpretOrder(solo).trigger,'none');
});
test('dangerous attack gets an explained protective response and hurts trust after the race',()=>{
 let {race,career}=start('ren','haruna','attack');race.player.heat=150;
 const command=interpretOrder(race);assert.equal(command.effective,'conserve');assert.equal(command.refused,true);assert.equal(command.caution,true);
 assert.match(command.reason,/безопасный/);
 race=resolveManagedSector(race);while(!race.finished)race=resolveManagedSector(race);
 const settled=awardRace(career,race);assert.ok(settled.race.teamFeedback.caution>0);assert.ok(settled.race.teamFeedback.after<70);
});
test('aggressive low-trust driver may reinterpret a safe command, while discipline and high trust prevent it',()=>{
 const race=start('aki','haruna','safe').race;race.manager.trust=40;race.player.time=1;
 assert.equal(interpretOrder(race).effective,'attack');assert.equal(interpretOrder(race).refused,true);
 race.manager.trust=90;assert.equal(interpretOrder(race).effective,'safe');
 const disciplined=start('ren','haruna','safe').race;disciplined.manager.trust=40;disciplined.player.time=1;
 assert.equal(interpretOrder(disciplined).effective,'safe');
});
test('wet conditions and inadequate confidence cause an explained cautious attack interpretation',()=>{
 const race=start('aki','haruna','attack').race;race.index=5;race.manager.trust=40;
 assert.equal(interpretOrder(race).effective,'safe');assert.match(interpretOrder(race).reason,/мокр/i);
 race.manager.trust=100;assert.equal(interpretOrder(race).effective,'attack');
 const solo=start('ren','ebisu','hold').race;assert.equal(interpretOrder(solo).effective,'safe');
});
test('orders have observable influence on card selection without changing car physics',()=>{
 const selected=new Set();for(const order of ORDERS){const {race}=start('ren','haruna',order.id);selected.add(decideManagedAction(race).cardId);}
 assert.ok(selected.size>1);assert.equal(orderPolicy('balanced'),null);
 let {race}=start('ren','haruna','attack');const decision=decideManagedAction(race),manual=resolveSector(race,decision.cardId),managed=resolveManagedSector(race);
 assert.deepEqual(managed.player,manual.player);assert.deepEqual(managed.opponent,manual.opponent);
 assert.equal(managed.history[0].playerTime,manual.history[0].playerTime);
});
for(const event of EVENTS)for(const pilot of PILOTS){
 test(`autonomous full cycle / ${event.id} / ${pilot.id}`,()=>{
  let {career,race}=start(pilot.id,event.id);const charged=career.money;let moves=0;
  while(!race.finished){
   race=setManagerOrder(race,ORDERS[moves%ORDERS.length].id);
   const choice=decideManagedAction(race),sector=sectorAt(race.index,race.weather,race.eventId),card=availableCards(race.config,race.mode,race.eventId).find(c=>c.id===choice.cardId);
   assert.equal(disabledReason(card,sector,race.player,race.config,race.player.time-race.opponent.time),'');
   race=resolveManagedSector(race);moves++;
  }
  assert.equal(moves,event.sectors.length);assert.equal(race.manager.log.length,moves);
  const result=awardRace(career,race);assert.equal(result.career.money,charged+result.race.outcome.reward);
  assert.ok(result.race.teamFeedback.after>=40&&result.race.teamFeedback.after<=100);
  const loaded=validateSave(result.career);assert.deepEqual(loaded,result.career);
  const record=raceRecord(race);assert.deepEqual(loaded.bests[0]?.manager,record.manager);
  assert.throws(()=>awardRace(loaded,race),/повторно/);
 });
}
test('saved command annotations validate independently of the actual replay',()=>{
 let {race}=start();while(!race.finished)race=resolveManagedSector(race);
 const record=raceRecord(race);assert.deepEqual(normalizeCommandRecord(record.manager,record.actions,'ren'),record.manager);
 const invalid=[null,{...record.manager,pilotId:'aki'},{...record.manager,trust:1},{...record.manager,fee:-1},{...record.manager,log:[]}];
 for(const value of invalid)assert.equal(normalizeCommandRecord(value,record.actions,'ren'),null);
 for(const patch of [{requested:'fake'},{effective:'fake'},{cardId:'fake'},{refused:null},{caution:1},{reason:'x'.repeat(301)},{trigger:'unknown'}]){
  const broken=structuredClone(record.manager);Object.assign(broken.log[0],patch);
  const loaded=validateSave({...newCareer(),bests:[{...record,manager:broken}]});
  assert.equal(loaded.bests.length,1);assert.equal(loaded.bests[0].manager,undefined);
 }
});
