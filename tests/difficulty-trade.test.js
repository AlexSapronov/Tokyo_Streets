import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,EVENTS,getEvent} from '../src/data.js';
import {configuration,nominalConfiguration,performanceProfile,freeRivalOptions,RIVAL_LEVELS,createRace,medalTargets,raceOutcome} from '../src/engine.js';
import {newCareer,validateSave} from '../src/storage.js';
import {tradeInQuote,tradeInCar,selectCar,togglePart,serviceCar} from '../src/garage.js';
import {buyEngine,installEngine} from '../src/powertrain.js';
import {stockEngineId} from '../src/engine-data.js';
import {getCup,CUPS,enterCup,prepareStage,bookCupRace,normalizeChampionship,cupUnlockReason} from '../src/championship.js';
import {nextMilestone,settleJourney} from '../src/journey.js';
import {awardRace,recordKey} from '../src/progress.js';
import {beginManagedRace} from '../src/manager.js';
import {unlockEverything} from '../src/balance.js';
import {finishRace} from './helpers.js';
const cfg=configuration('ae86','ren');
const rich=()=>({...newCareer(),money:1e7,races:30,street:100});
test('three free opponents have weaker, comparable and stronger builds across cars, rain and extreme swaps',()=>{
 for(const car of CARS)for(const eventId of ['haruna','yokohama-mile'])for(const weather of ['dry','rain']){
  const c=configuration(car.id,'ren',['ecu','brakes','lsd']),offers=freeRivalOptions(c,eventId,weather),p=performanceProfile(c,eventId,weather);
  assert.deepEqual(offers.map(o=>o.id),['easy','equal','hard']);
  assert.ok(offers[0].profile.rating<p.rating*.9);assert.ok(Math.abs(offers[1].profile.rating/p.rating-1)<.08);assert.ok(offers[2].profile.rating>p.rating*1.1);
  assert.equal(new Set(offers.map(o=>o.rival.pilot.id)).size,1);
 }
 const extreme=configuration('ae86','ren',['turbo','ecu'],'100',{},'w16'),offers=freeRivalOptions(extreme,'haruna','dry');assert.ok(offers.some(o=>o.prepared));assert.ok(offers[2].profile.rating>offers[1].profile.rating);
 const worn=configuration('ae86','yui',['ecu'],35,{},null,{engine:5});assert.deepEqual(freeRivalOptions(worn,'haruna'),freeRivalOptions(configuration('ae86','ren',['ecu']),'haruna'));
 const original=freeRivalOptions(cfg,'haruna');original[0].rival.car.power=1;assert.notEqual(freeRivalOptions(cfg,'haruna')[0].rival.car.power,1);
});
test('difficulty is fixed at start, affects free prizes, survives records and does not change championship opposition',()=>{
 for(const level of RIVAL_LEVELS){let r=createRace(cfg,'dry','haruna','level-'+level.id,42,level.id);assert.equal(r.rivalLevel,level.id);assert.equal(r.config.rivalLevel,level.id);assert.equal(r.difficultyReward,level.reward);
  const finished=finishRace(cfg,'dry','haruna');r={...r,finished:true,index:finished.index,history:finished.history,player:finished.player,opponent:{...r.opponent,time:10000}};
  const plain=raceOutcome({...r,difficultyReward:1});assert.equal(raceOutcome(r).reward,Math.round(plain.reward*level.reward));assert.equal(raceOutcome({...r,season:{}}).reward,plain.reward);
  const awarded=awardRace(newCareer(),r);assert.deepEqual(validateSave(awarded.career),awarded.career);assert.equal(awarded.career.bests[0].rivalLevel,level.id);
 }
 assert.notEqual(recordKey({...cfg,rivalLevel:'easy'},'haruna','dry'),recordKey({...cfg,rivalLevel:'hard'},'haruna','dry'));
 assert.throws(()=>createRace(cfg,'dry','haruna',null,42,'missing'),/уровень/);
 let c=enterCup(rich(),'club','diff-cup');c=prepareStage(c);c.rivalLevel='hard';const booked=bookCupRace(c,'diff-stage');assert.equal(booked.race.rivalLevel,undefined);assert.equal(booked.race.rival.car.id,'mx5');
 const m=unlockEverything(newCareer());m.control='manager';const managed=beginManagedRace(m,'haruna','dry','managed-easy','easy');assert.equal(managed.race.rivalLevel,'easy');
});
test('Time Attack is calibrated to the actual healthy build, not class jumps, pilot or wear',()=>{
 for(const id of ['tsukuba','nikko'])for(const weather of ['dry','mixed','rain']){
  const stock=medalTargets(id,weather,cfg),tuned=medalTargets(id,weather,configuration('ae86','ren',['ecu',weather==='rain'?'wetTires':'tires','brakes']));assert.ok(tuned.gold<stock.gold);
  const worn=configuration('ae86','yui',[],35,{},null,{engine:0,stockTires:1});assert.deepEqual(medalTargets(id,weather,worn),stock);
  for(const car of CARS){const targets=medalTargets(id,weather,configuration(car.id,'ren'));assert.ok(targets.gold>0&&targets.gold<targets.silver&&targets.silver<targets.bronze);}
  const r=createRace(cfg,weather,id);r.config=configuration('supra','ren');r.player.time=r.targets.gold;assert.equal(raceOutcome(r).medal,'gold');
 }
 const targets=medalTargets('tsukuba','dry',cfg);targets.gold=1;assert.notEqual(medalTargets('tsukuba','dry',cfg).gold,1);
 const a=performanceProfile(cfg),lighter=performanceProfile({...cfg,car:{...cfg.car,mass:800}}),grippy=performanceProfile({...cfg,car:{...cfg.car,grip:1.4}});assert.ok(lighter.rating>a.rating&&grippy.rating>a.rating);
 assert.equal(nominalConfiguration(configuration('ae86','yui',[],35)).pilot.id,'ren');
});
test('trade-in quote values car health, all car-specific tuning and swapped engine once',()=>{
 let c=rich();c=togglePart(c,'tires');c=togglePart(c,'tires');c=togglePart(c,'cooling');const before=structuredClone(c),q=tradeInQuote(c,'mx5');assert.equal(q.credit,Math.floor((18000+14000+9000)*.6));assert.equal(q.parts.length,2);assert.equal(q.due,0);assert.equal(q.cashback,600);assert.deepEqual(c,before);
 c.condition.ae86=50;c.wear.ae86.cooling=20;c.wear.ae86.engine=10;assert.ok(tradeInQuote(c,'mx5').credit<q.credit);
 let swapped=unlockEverything(newCareer());swapped.ownedCars=['ae86'];swapped.purchased.ae86=[];swapped.operations.staff.engineer=2;swapped=buyEngine(swapped,'w16','trade-w16');swapped=installEngine(swapped,'trade-w16');const quote=tradeInQuote(swapped,'mx5');assert.ok(quote.engineAdjustment>600000);assert.ok(quote.credit<650000);
 const spares=structuredClone(swapped.engines.spares),sold=tradeInCar(swapped,'mx5');assert.deepEqual(sold.engines.spares,spares);assert.deepEqual(validateSave(sold),sold);assert.equal(sold.engines.installed.ae86.engineId,stockEngineId('ae86'));assert.notEqual(sold.engines.installed.ae86.instanceId,spares[0].instanceId);
});
test('trade-in is atomic, preserves debt and progress, cleans sold inventory and cannot resurrect a free starter',()=>{
 let c=rich();c.repairDebt=12345;c.journey.routes.haruna=3;c=togglePart(c,'cooling');c.presets.ae86=[{name:'sold',parts:['cooling'],setup:c.setups.ae86}];const q=tradeInQuote(c,'s13'),before=structuredClone(c),sold=tradeInCar(c,'s13');
 assert.deepEqual(c,before);assert.equal(sold.money,c.money+q.credit-q.price);assert.deepEqual(sold.ownedCars,['s13']);assert.equal(sold.repairDebt,12345);assert.deepEqual(sold.journey,c.journey);assert.deepEqual(sold.purchased.ae86,[]);assert.deepEqual(sold.builds.ae86,[]);assert.deepEqual(sold.presets.ae86,[]);assert.equal(sold.condition.s13,100);
 const loaded=validateSave(sold);assert.deepEqual(loaded,sold);assert.ok(!loaded.ownedCars.includes('ae86'));const bought=selectCar(loaded,'ae86');assert.equal(bought.money,loaded.money-18000);
 for(const fn of [()=>tradeInCar(c,'mx5',true),()=>tradeInCar(c,'missing'),()=>tradeInCar(c,'ae86'),()=>tradeInCar({...c,money:0},'nsx'),()=>tradeInQuote(c,'mx5','missing')])assert.throws(fn);
 const registered=enterCup(c,'club','locked-sale');assert.throws(()=>tradeInCar(registered,'mx5'),/чемпионате/);assert.deepEqual(c,before);
 let c2=selectCar(c,'mx5');c2.car='ae86';const active=enterCup(c2,'club','other-car');active.car='mx5';assert.equal(tradeInCar(active,'s13').championships.active.carId,'ae86');
});
test('five championship podiums are primary career milestones; late tiers preserve real engines and history',()=>{
 assert.equal(CUPS.length,5);for(let i=0;i<CUPS.length;i++)assert.equal(CUPS[i].previous,i?CUPS[i-1].id:null);
 const c=rich();c.championships.completed=['club','regional','masters'];assert.equal(nextMilestone(c).id,'allstars');assert.equal(cupUnlockReason({...c,races:0,street:0},getCup('allstars')),'');
 const joined=enterCup(c,'allstars','v8-stage'),booked=bookCupRace(prepareStage({...joined,street:12}),'v8');assert.equal(booked.race.rival.engineId,'ls3');assert.equal(booked.race.difficultyReward,undefined);
 const manager={...unlockEverything(newCareer()),control:'manager',street:12};manager.championships.active=joined.championships.active;assert.equal(bookCupRace(prepareStage(manager),'v8-managed').race.rival.engineId,'ls3');
 const history={active:null,completed:['legends'],history:[{cupId:'legends',rank:1,points:40,bonus:110000,attempt:'history'}]};assert.deepEqual(normalizeChampionship(history),history);
 const final={...newCareer(),championships:{...newCareer().championships,completed:['club']}};const dnfrace={...finishRace(cfg),player:{dnf:{}},season:{cupId:'club'}};const result=settleJourney(final,dnfrace,{won:false});assert.ok(result.career.journey.claimed.includes('club'));assert.deepEqual(result.career.journey.routes,{});
});
test('championship preview matches the booked engine, setup and DNS without charging money',async()=>{
 const {previewCupOpponent}=await import('../src/championship.js');assert.equal(previewCupOpponent(newCareer()),null);
 const c=rich();c.championships.completed=['masters'];const joined=enterCup(c,'allstars','preview'),before=structuredClone(joined),preview=previewCupOpponent(joined),booked=bookCupRace(prepareStage(joined),'preview-start');assert.deepEqual(joined,before);assert.deepEqual(preview.rival,booked.race.rival);assert.equal(preview.name,booked.race.rivalName);assert.equal(preview.dns,false);
 for(const n of joined.championships.active.npcs){n.condition=35;n.budget=0;}assert.equal(previewCupOpponent(joined).dns,true);
});
