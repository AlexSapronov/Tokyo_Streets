import test from 'node:test';
import assert from 'node:assert/strict';
import {executionRoll,runOffChance,applyRunOff} from '../src/execution.js';
import {configuration,createRace,resolveSector,simulate,availableCards,disabledReason,chooseAI,futureSectors,raceOutcome} from '../src/engine.js';
import {EVENTS,sectorAt,CARDS} from '../src/data.js';
import {raceRecord,awardRace} from '../src/progress.js';
import {newCareer,validateSave} from '../src/storage.js';
import {foundTeam,hirePilot} from '../src/team.js';
import {beginManagedRace,resolveManagedSector} from '../src/manager.js';
const cfg=configuration('ae86','ren');
function worstSeed(index,side='player'){
 for(let seed=0;seed<200000;seed++)if(executionRoll(seed,index,side,20).roll>.9999)return seed;
 throw Error('No extreme seed');
}
function startingRace(event){
 let race=createRace(cfg,'rain',event.id,null,42);
 if(event.mode==='drag')race=resolveSector(race,'drag-warm');
 race.player.focus=25;race.seed=worstSeed(race.index);
 return race;
}
test('run-off is the worst positive tail; chance rises with loss of focus and maneuver load',()=>{
 const sector=sectorAt(2,'rain'),card=CARDS.find(c=>c.id==='attack');
 assert.equal(runOffChance(100,1,sector,card),0);
 assert.ok(runOffChance(5,.6,sector,card)>runOffChance(50,.6,sector,card));
 assert.ok(runOffChance(20,.9,sector,card)>runOffChance(20,.1,sector,card));
 assert.equal(runOffChance(0,1,{phase:'prep'},card),0);assert.equal(runOffChance(0,1,sector,{reset:true}),0);
 assert.equal(runOffChance(NaN,9,sector,card),.06);
 const result={time:1,next:{},risk:1};assert.equal(applyRunOff(result,sector,card),result);
});
for(const event of EVENTS)test(`player run-off stops and damages without reward or record / ${event.id}`,()=>{
 const race=startingRace(event),sector=sectorAt(race.index,race.weather,event.id);
 const card=availableCards(cfg,event.mode,event.id).find(c=>!c.reset&&!disabledReason(c,sector,race.player,cfg,0));
 const before=structuredClone(race),next=resolveSector(race,card.id);
 assert.deepEqual(race,before);assert.ok(next.player.dnf);assert.ok(next.finished);assert.equal(next.player.velocity,0);assert.equal(next.history.at(-1).telemetry.speed,0);
 assert.ok(next.player.dnf.damage>=12&&next.player.dnf.damage<=38);assert.ok(next.history.at(-1).reasons.some(s=>s.includes('ВЫЛЕТ')));
 assert.throws(()=>resolveSector(next,card.id),/завершён/);
 const outcome=raceOutcome(next);assert.deepEqual({won:outcome.won,medal:outcome.medal,reward:outcome.reward,street:outcome.street,official:outcome.official},{won:false,medal:null,reward:0,street:0,official:0});
 const career=newCareer(),award=awardRace(career,next);assert.equal(award.isBest,false);assert.equal(award.career.money,career.money);assert.equal(award.career.races,0);assert.equal(award.career.bests.length,0);assert.equal(award.career.best,null);
 assert.ok(award.career.condition.ae86<=100-next.player.dnf.damage);assert.equal(award.career.records[0].dnf,true);assert.deepEqual(validateSave(award.career),award.career);
 assert.deepEqual(validateSave({...award.career,bests:[raceRecord(next)]}).bests,[]);
 if(event.mode==='drift'){assert.equal(next.history.at(-1).drift.points,0);assert.equal(next.player.drift.active,false);}
 const damaged={...next,config:{...next.config,condition:40}};assert.equal(awardRace(career,damaged).career.condition.ae86,35);
});
test('opponent run-off stops their actions and allows the player to finish for a win',()=>{
 let race=createRace(cfg,'dry','haruna','rival-dnf',worstSeed(0,'opponent'));race.opponent.focus=0;
 race=resolveSector(race,'balanced');assert.ok(race.opponent.dnf);assert.ok(!race.player.dnf);assert.equal(race.finished,false);
 const stopped=structuredClone(race.opponent);race=resolveSector(race,'balanced');assert.deepEqual(race.opponent,stopped);assert.equal(race.history.at(-1).aiTime,null);assert.equal(race.history.at(-1).gap,null);
 while(!race.finished)race=resolveSector(race,'balanced');
 assert.ok(!race.player.dnf);assert.equal(raceOutcome(race).won,true);assert.match(raceOutcome(race).label,/сход соперника/);
 assert.ok(awardRace(newCareer(),race).isBest);
});
test('simultaneous run-offs never award a win and damage is applied once across save reload',()=>{
 let race=createRace(cfg,'rain','haruna','both-dnf',42);race.player.focus=0;race.opponent.focus=0;
 for(let seed=0;seed<1000000;seed++){
  if(executionRoll(seed,0,'player',0).roll>.995&&executionRoll(seed,0,'opponent',0).roll>.995){race.seed=seed;break;}
 }
 const next=resolveSector(race,'balanced');assert.ok(next.player.dnf);assert.ok(next.opponent.dnf);assert.equal(raceOutcome(next).won,false);
 const award=awardRace(newCareer(),next),loaded=validateSave(award.career);
 assert.throws(()=>awardRace(loaded,next),/повторно/);assert.throws(()=>awardRace(loaded,award.race),/повторно/);
});
test('a manager pilot can crash under the same execution rules and loses trust',()=>{
 let career=newCareer();career.races=5;career.street=30;career.money=150000;career=hirePilot(foundTeam(career),'ren');career.control='manager';
 let {race}=beginManagedRace(career,'haruna','rain','manager-dnf');race.player.focus=0;race.seed=worstSeed(0);
 const next=resolveManagedSector(race);assert.ok(next.player.dnf);assert.ok(next.finished);assert.equal(next.manager.log.length,1);
 const award=awardRace(career,next);assert.ok(award.career.team.contracts[0].trust<career.team.contracts[0].trust);assert.match(award.race.teamFeedback.reason,/Вылет/);
});
