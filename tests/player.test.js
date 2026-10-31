import test from 'node:test';
import assert from 'node:assert/strict';
import {XP_LEVELS,normalizePlayer,playerLevel,playerPoints,trainingSnapshot,withTraining,trainPlayer,togglePlayerSkill,resetPlayer,settlePlayer,SKILL_CARDS} from '../src/player.js';
import {newCareer,validateSave} from '../src/storage.js';
import {configuration,availableCards,disabledReason,simulate,freshState,resolveSector,createRace} from '../src/engine.js';
import {focusCost} from '../src/tactics.js';
import {freshDriftState} from '../src/drift.js';
import {CARDS,sectorAt} from '../src/data.js';
import {DRIFT_CARDS} from '../src/drift-data.js';
import {executionRoll} from '../src/execution.js';
import {awardRace,recordKey} from '../src/progress.js';
import {bookChallenge} from '../src/rivals.js';
import {enterCup,bookCupRace,prepareStage} from '../src/championship.js';
import {finishRace} from './helpers.js';
const expert=()=>{const c=newCareer();c.player.xp=XP_LEVELS.at(-1);return c;};
const card=id=>CARDS.find(c=>c.id===id);
test('XP thresholds, point budget, rank cap, two active paths and free redistribution are enforced',()=>{
 let c=expert();assert.equal(playerLevel(c.player.xp),10);assert.equal(playerPoints(c.player),9);const original=structuredClone(c);
 for(let i=0;i<3;i++)c=trainPlayer(c,'precision');for(let i=0;i<3;i++)c=trainPlayer(c,'control');c=trainPlayer(c,'endurance');
 assert.deepEqual(c.player.active,['precision','control']);assert.equal(playerPoints(c.player),2);assert.throws(()=>togglePlayerSkill(c,'endurance'),/две/);assert.throws(()=>trainPlayer(c,'precision'),/Максимальный/);
 c=togglePlayerSkill(c,'control');c=togglePlayerSkill(c,'endurance');assert.deepEqual(trainingSnapshot(c.player),{precision:3,endurance:1});
 assert.throws(()=>trainPlayer(c,'unknown'));assert.throws(()=>togglePlayerSkill(c,'racecraft'),/изучи/);assert.throws(()=>resetPlayer(c,true),/заверши/);assert.throws(()=>trainPlayer(c,'control',true));
 const reset=resetPlayer(c);assert.equal(reset.player.xp,c.player.xp);assert.deepEqual(reset.player.active,[]);assert.equal(playerPoints(reset.player),9);assert.deepEqual(original,expert());assert.throws(()=>trainPlayer(newCareer(),'precision'),/очко/);
});
test('old saves receive bounded earned XP without automatic perks or any loss of money and vehicles',()=>{
 const c=newCareer();delete c.player;c.races=10;c.money=12345;c.eventCompletions={haruna:4};const saved=validateSave(c);
 assert.equal(saved.player.xp,300);assert.deepEqual(saved.player.active,[]);assert.ok(saved.player.seenEvents.includes('haruna'));assert.equal(saved.money,12345);assert.deepEqual(saved.ownedCars,c.ownedCars);
 const corrupt=normalizePlayer({xp:99999,learned:{precision:3,control:3,endurance:3,racecraft:3},active:['precision','control','endurance','bogus'],seenEvents:['bogus']});assert.equal(corrupt.xp,2160);assert.equal(corrupt.active.length,2);assert.equal(playerPoints(corrupt),0);assert.deepEqual(corrupt.seenEvents,[]);
 assert.throws(()=>withTraining(configuration('ae86','ren'),{precision:4}));assert.throws(()=>withTraining(configuration('ae86','ren'),{precision:1,control:1,endurance:1}));
});
test('XP awards require a valid result and repeated award/reload cannot create additional XP',()=>{
 let c=newCareer(),r=finishRace(configuration('ae86','ren'),'dry','tsukuba',null,'xp-run');const before=structuredClone(c),first=awardRace(c,r);
 assert.ok(first.race.playerReport.earned>0);assert.deepEqual(c,before);assert.throws(()=>awardRace(first.career,r),/повторно/);
 assert.equal(validateSave(first.career).player.xp,first.career.player.xp);
 const second=settlePlayer(first.career,{...r,runId:'other'},{medal:null});assert.ok(second.report.earned<first.race.playerReport.earned);assert.equal(second.career.player.seenEvents.filter(e=>e==='tsukuba').length,1);
 for(const race of [{...r,player:{...r.player,dnf:{}}},{...r,player:{...r.player,drag:{falseStart:true}}},{...r,manager:{}}])assert.equal(settlePlayer(c,race,{}).report.earned,0);
 c=expert();assert.equal(settlePlayer(c,r,{}).report.earned,0);
 const short={...r,history:r.history.slice(0,1)};const partial=settlePlayer(newCareer(),short,{won:true});assert.ok(partial.report.earned>0);assert.deepEqual(partial.career.player.seenEvents,[]);
});
test('precision changes spread, not seed; endurance and racecraft reduce only their documented costs',()=>{
 const base=configuration('ae86','ren'),state=freshState(base),sector=sectorAt(1,'rain','haruna'),roll=executionRoll(99,1,'player',state.focus),trained=withTraining(base,{precision:3,endurance:3});
 const normal=simulate(base,state,sector,card('attack'),roll),precise=simulate(trained,state,sector,card('attack'),roll);
 assert.equal(precise.execution.roll,normal.execution.roll);assert.equal(precise.execution.range,normal.execution.range*.76);assert.ok(precise.next.focus>normal.next.focus);assert.equal(trained.car.power,base.car.power);
 assert.equal(focusCost(trained,state,card('breathe')),focusCost(base,state,card('breathe')));
 const racecraft=withTraining(base,{racecraft:3}),straight=sectorAt(4,'dry','haruna');assert.ok(focusCost(racecraft,state,card('draft'))<focusCost(base,state,card('draft')));assert.ok(simulate(racecraft,state,straight,card('draft')).time<simulate(base,state,straight,card('draft')).time);
 assert.equal(focusCost(racecraft,state,card('attack')),focusCost(base,state,card('attack')));
});
test('control affects wet corner load and drift precision, and rank III cards require the active snapshot',()=>{
 const base=configuration('ae86','ren'),state=freshState(base),trained=withTraining(base,{control:3});
 assert.ok(simulate(trained,state,sectorAt(1,'rain','haruna'),card('attack')).risk<simulate(base,state,sectorAt(1,'rain','haruna'),card('attack')).risk);
 const ds=freshDriftState(base),sector=sectorAt(0,'dry','ebisu'),dc=DRIFT_CARDS[0];assert.ok(simulate(trained,ds,sector,dc).clip.points>=simulate(base,ds,sector,dc).clip.points);
 for(const advanced of SKILL_CARDS){
  const config=withTraining(base,{[advanced.skill]:3});assert.ok(availableCards(config).some(c=>c.id===advanced.id));assert.ok(!availableCards(base).some(c=>c.id===advanced.id));assert.ok(!availableCards(withTraining(base,{[advanced.skill]:2})).some(c=>c.id===advanced.id));
  let r=createRace(config,'rain','haruna','advanced-'+advanced.id,42);r=resolveSector(r,'balanced');
  if(advanced.gap)r.opponent.time=r.player.time+.5;
  assert.doesNotThrow(()=>resolveSector(r,advanced.id));
 }
 const feint=SKILL_CARDS.find(c=>c.id==='skill-feint');assert.match(disabledReason(feint,sectorAt(1,'dry','tsukuba'),state,base),/нет соперника/);
});
test('start snapshots, skill-specific records and replay cards survive resets, save reload and corruption',()=>{
 let c=expert();c.races=20;c.street=100;c.money=100000;for(let i=0;i<3;i++)c=trainPlayer(c,'endurance');
 const start=bookChallenge(c,'cedar-1','snapshot');c=resetPlayer(c);assert.deepEqual(start.race.config.training,{endurance:3});
 let r=createRace(withTraining(configuration('ae86','ren'),start.race.config.training),'dry','tsukuba','skill-replay',42);
 while(!r.finished)r=resolveSector(r,'skill-rhythm');
 const awarded=awardRace(c,r),loaded=validateSave(awarded.career);assert.equal(loaded.bests.length,1);assert.deepEqual(loaded.bests[0].training,{endurance:3});assert.ok(loaded.bests[0].actions.every(id=>id==='skill-rhythm'));assert.equal(loaded.bests[0].slips.length,r.history.length);
 assert.notEqual(recordKey(r.config,'tsukuba','dry'),recordKey(configuration('ae86','ren'),'tsukuba','dry'));
 const bad=structuredClone(awarded.career);bad.bests[0].training={precision:99};assert.equal(validateSave(bad).bests.length,0);
 const entered=prepareStage(enterCup(start.career,'club','trained-cup'));assert.deepEqual(bookCupRace(entered,'stage-snapshot').race.config.training,{endurance:3});
});
