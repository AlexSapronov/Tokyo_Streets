import {simulateDrift} from '../src/drift.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {raceClass,payoutScale,admissionReason,unlockEverything,incidentPrice,START_MONEY,SERVICE_RATE} from '../src/balance.js';
import {configuration,createRace,simulate,resolveSector,chooseAI,futureSectors,availableCards,disabledReason,raceOutcome,medalTargets} from '../src/engine.js';
import {CARDS,CARS,EVENTS,sectorAt} from '../src/data.js';
import {strainAfter,strainEffect,focusCost} from '../src/tactics.js';
import {newCareer,validateSave} from '../src/storage.js';
import {awardRace,bestFor,raceRecord} from '../src/progress.js';
import {serviceCost,recoveryService,selectCar} from '../src/garage.js';
import {foundTeam,hirePilot} from '../src/team.js';
import {beginManagedRace,decideManagedAction,resolveManagedSector} from '../src/manager.js';
import {finishRace} from './helpers.js';
const cfg=configuration('ae86','ren'),card=id=>CARDS.find(c=>c.id===id);
test('new progression buys preparation but not an immediate upgraded car; old money survives migration',()=>{
 assert.equal(newCareer().money,START_MONEY);assert.throws(()=>selectCar(newCareer(),'chaser'),/Недостаточно/);assert.throws(()=>selectCar(newCareer(),'evo'),/Недостаточно/);
 assert.equal(validateSave({...newCareer(),money:80000}).money,80000);
});
test('classes use actual build power/weight and handling parts, without downgrading for damage',()=>{
 assert.equal(raceClass(cfg).id,'club');assert.equal(raceClass(configuration('chaser','ren')).id,'sport');assert.equal(raceClass(configuration('evo','ren')).id,'expert');
 assert.equal(raceClass(configuration('chaser','ren',['weight','tires','lsd','suspension'])).id,'expert');
 assert.deepEqual(raceClass(configuration('evo','ren',[],35)),raceClass(configuration('evo','ren',[],100)));
 for(const car of CARS)for(const event of EVENTS.filter(e=>['duel','drag'].includes(e.mode))){
  const config=configuration(car.id,'ren'),race=createRace(config,'dry',event.id);assert.equal(race.rival.car.id,event.rivalCar);assert.equal(race.category.id,raceClass(config).id);
 }
});
test('repeated event payout shrinks to a floor and is isolated by event',()=>{
 const career=newCareer();assert.equal(payoutScale(career,'haruna'),1);career.eventCompletions.haruna=5;assert.equal(payoutScale(career,'haruna'),.625);assert.equal(payoutScale(career,'akagi'),1);
 career.eventCompletions.haruna=1000;assert.equal(payoutScale(career,'haruna'),.5);assert.equal(payoutScale({},'haruna'),1);
});
test('all modes stop admission below their condition threshold and recovery never requires cash',()=>{
 const career=newCareer();career.money=0;career.condition.ae86=35;
 for(const event of EVENTS)assert.match(admissionReason(career,event.id),/состояние/);
 const repaired=recoveryService(career);assert.equal(repaired.condition.ae86,60);assert.equal(repaired.repairDebt,25*SERVICE_RATE);assert.equal(repaired.money,0);assert.equal(career.condition.ae86,35);
 for(const event of EVENTS)assert.equal(admissionReason(repaired,event.id),'');assert.equal(admissionReason(repaired,'missing'),'');
 assert.throws(()=>recoveryService(repaired),/ниже 60/);assert.throws(()=>recoveryService(career,true),/заезд/);
 const funded={...career,money:2000};const paid=recoveryService(funded);assert.equal(paid.money,0);assert.equal(paid.repairDebt,25*SERVICE_RATE-2000);
 const cash={...career,money:20000};assert.equal(recoveryService(cash).repairDebt,0);assert.equal(serviceCost(repaired),40*SERVICE_RATE);
});
test('repair debt repays at most half the prize, survives saves, and cannot be charged twice',()=>{
 let race=finishRace(cfg,'dry','haruna',null,'debt-run');assert.ok(!race.player.dnf);
 const career={...newCareer(),repairDebt:50000},outcome=raceOutcome(race),award=awardRace(career,race);
 assert.equal(award.race.debtPaid,Math.floor(outcome.reward*.5));assert.equal(award.career.money,career.money+outcome.reward-award.race.debtPaid+award.race.journeyReport.bonus-award.race.journeyReport.debtPaid);
 assert.equal(award.career.repairDebt,career.repairDebt-award.race.debtPaid-award.race.journeyReport.debtPaid);assert.equal(award.career.eventCompletions.haruna,1);
 assert.deepEqual(validateSave(award.career),award.career);assert.throws(()=>awardRace(award.career,race),/повторно/);
 const raw={...newCareer(),repairDebt:Infinity,eventCompletions:{haruna:-1,akagi:3.8,unknown:9}};const loaded=validateSave(raw);assert.equal(loaded.repairDebt,0);assert.deepEqual(loaded.eventCompletions,{akagi:3});
});
test('rotating different aggressive actions builds strain, recovery lowers it, and focus price rises',()=>{
 let state={strain:0};for(const id of ['attack','late','power','weight'])state={...state,strain:strainAfter(state,card(id))};assert.ok(state.strain>2);
 const high=strainEffect(state,card('late'));assert.ok(high.focusFactor>1);assert.ok(high.timeFactor>1);assert.ok(high.risk>0);
 assert.ok(focusCost(cfg,state,card('late'))>focusCost(cfg,{...state,strain:0},card('late')));
 const rested=strainAfter(state,card('breathe'));assert.ok(rested<state.strain);assert.ok(strainAfter(state,card('balanced'))<state.strain);
 assert.equal(strainEffect(state,card('breathe')).focusFactor,1);assert.equal(strainAfter({strain:6},card('attack')),6);
});
test('road exit choices alter the next sector, with a price for late and defensive lines',()=>{
 const sector=sectorAt(2,'dry'),state={...createRace(cfg,'dry','haruna',null,42).player,velocity:40};
 const late=simulate(cfg,state,sector,card('late')),power=simulate(cfg,state,sector,card('power')),neutral=simulate(cfg,state,sector,card('balanced'));
 assert.ok(late.next.velocity<neutral.next.velocity);assert.ok(power.next.velocity>neutral.next.velocity);
 const next=sectorAt(3,'dry');const equalResources=s=>({...neutral.next,velocity:s.next.velocity});
 assert.notEqual(simulate(cfg,equalResources(late),next,card('balanced')).time,simulate(cfg,equalResources(power),next,card('balanced')).time);
 const defend=simulate(cfg,state,sector,card('defend'));assert.ok(defend.next.velocity<neutral.next.velocity);
});
test('planner prices expected accidents by pilot temperament and remaining horizon, without RNG access',()=>{
 assert.equal(incidentPrice(0,cfg),0);assert.ok(incidentPrice(.02,cfg,3)>incidentPrice(.02,cfg,1));
 assert.ok(incidentPrice(.02,configuration('ae86','aki'))<incidentPrice(.02,cfg));assert.ok(incidentPrice(.02,configuration('ae86','yui'))>incidentPrice(.02,cfg));
 const race=createRace(cfg,'rain','haruna',null,42);race.player.focus=15;
 const decision=chooseAI(cfg,race.player,sectorAt(0,'rain'),0,futureSectors(race));assert.equal(decision.result.execution,undefined);
 assert.equal(disabledReason(decision.card,sectorAt(0,'rain'),race.player,cfg),'');
});
test('debug unlock grants everything while preserving chosen builds, plan and valid save structure',()=>{
 const career=newCareer();career.builds.ae86=['cooling'];career.purchased.ae86=['cooling'];const before=structuredClone(career),next=unlockEverything(career);
 assert.deepEqual(career,before);assert.equal(next.money,1e6);assert.deepEqual(next.ownedCars,CARS.map(c=>c.id));assert.deepEqual(next.builds.ae86,['cooling']);assert.ok(next.team.founded);assert.equal(next.team.contracts.length,3);
 assert.deepEqual(validateSave(next),next);assert.equal(newCareer().bests.length,0);assert.equal(newCareer().street,0);
});
test('manager training changes actual skill and focus, is bounded, and admission still applies',()=>{
 let career=hirePilot(foundTeam({...newCareer(),money:1e6,races:20,street:100}),'ren');
 const novice=beginManagedRace(career,'haruna','dry','novice').race;
 career.team.contracts[0].experience=100;career.team.contracts[0].trust=100;
 const expert=beginManagedRace(career,'haruna','dry','expert').race;assert.equal(expert.manager.level,6);assert.ok(expert.config.pilot.skill>novice.config.pilot.skill);assert.equal(expert.config.pilot.focus,106);
 assert.equal(cfg.pilot.focus,100);assert.equal(expert.rewardScale,payoutScale(career,'haruna'));assert.ok(decideManagedAction(expert).cardId);
 career.condition.ae86=35;assert.throws(()=>beginManagedRace(career,'haruna','dry','damaged'),/состояние/);
});
test('archived road, drift and drag ghosts are preserved but separated from the new balance',()=>{
 for(const [eventId,prefix] of [['haruna','3'],['ebisu','drift-1'],['yokohama','drag-1']]){
  const race=finishRace(cfg,'dry',eventId),record=raceRecord(race);record.key=prefix+record.key.slice(record.key.indexOf('|'));
  const career=validateSave({...newCareer(),bests:[record]});assert.equal(career.bests[0].key,record.key);assert.equal(bestFor(career,cfg,eventId,'dry'),null);
 }
});

test('time attack medal references match the admitted class and remain fixed across attempts',()=>{
 const club=medalTargets('tsukuba','dry',cfg),expert=medalTargets('tsukuba','dry',configuration('evo','ren'));assert.ok(club.gold>expert.gold);assert.deepEqual(club,medalTargets('tsukuba','dry','club'));
 const race=createRace(cfg,'dry','tsukuba');race.player.time=club.gold;assert.equal(raceOutcome(race).medal,'gold');race.player.time=club.bronze+.1;assert.equal(raceOutcome(race).medal,null);
});
test('campaign payouts actually use the snapshotted repetition factor and full-condition damage has a cost',()=>{
 const career=newCareer();career.eventCompletions.haruna=8;
 const race=finishRace(cfg,'dry','haruna',null,'repeat-scale');race.rewardScale=payoutScale(career,'haruna');
 const first=raceOutcome({...race,rewardScale:1}),repeat=raceOutcome(race);assert.equal(repeat.reward,Math.round(first.reward*race.rewardScale));
 const award=awardRace(career,race);assert.equal(award.career.money,career.money+repeat.reward+award.race.journeyReport.bonus);assert.equal(award.career.eventCompletions.haruna,9);assert.ok(award.career.condition.ae86<100);
});

test('drift and shared execution agree on maneuver risk without double-counting accumulated strain',()=>{
 const race=createRace(cfg,'dry','ebisu'),state={...race.player,strain:3},sector=sectorAt(0,'dry','ebisu');
 const action=availableCards(cfg,'drift').find(c=>c.phase==='init');
 assert.equal(simulate(cfg,state,sector,action).risk,simulateDrift(cfg,state,sector,action).risk);
});

test('trained manager recordings preserve level and expanded focus through a full save roundtrip',()=>{
 for(const pilot of ['ren','aki','yui']){
  let career=unlockEverything(newCareer());career.pilot=pilot;const started=beginManagedRace(career,'haruna','dry','trained-'+pilot);let race=started.race;race.seed=42;
  while(!race.finished)race=resolveManagedSector(race);
  assert.ok(!race.player.dnf);const loaded=validateSave(awardRace(started.career,race).career),record=loaded.bests[0];
  assert.equal(record.manager.level,6);assert.deepEqual(record.telemetry,raceRecord(race).telemetry);assert.ok(race.config.pilot.focus>=96);
 }
});
