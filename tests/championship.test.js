import test from 'node:test';
import assert from 'node:assert/strict';
import {CUPS,POINTS,getCup,emptyChampionship,normalizeChampionship,cupUnlockReason,regulationReason,enterCup,withdrawCup,prepareStage,bookCupRace,settleCup,standings} from '../src/championship.js';
import {newCareer,validateSave} from '../src/storage.js';
import {unlockEverything} from '../src/balance.js';
import {configuration,chooseAI,resolveSector,futureSectors,createRace} from '../src/engine.js';
import {setCarSetup,togglePart,serviceCar} from '../src/garage.js';
import {sectorAt} from '../src/data.js';
import {awardRace} from '../src/progress.js';
import {resolveManagedSector} from '../src/manager.js';
import {championshipHTML,seasonReportHTML} from '../src/career-view.js';
function eligible(){return {...newCareer(),money:300000,races:20,street:100};}
function finish(race){while(!race.finished){if(race.manager)race=resolveManagedSector(race);else{const c=chooseAI(race.config,race.player,sectorAt(race.index,race.weather,race.eventId),race.opponent.dnf?Infinity:race.player.time-race.opponent.time,futureSectors(race));race=resolveSector(race,c.card.id);}}return race;}
function stage(career,runId){const prepared=prepareStage(career),booked=bookCupRace(prepared,runId),race=finish(booked.race),award=awardRace(booked.career,race);return {race,award};}
test('cup entry checks progression, actual tuned power, drivetrain and induction, charges only once',()=>{
 const c=eligible(),copy=structuredClone(c),cup=getCup('club');assert.ok(cupUnlockReason(newCareer(),cup));assert.ok(cupUnlockReason(c,getCup('regional')));assert.ok(cupUnlockReason({},getCup('regional')));
 assert.match(regulationReason(configuration('chaser','ren'),cup),/Лимит/);assert.match(regulationReason(configuration('evo','ren'),{...cup,maxPower:500}),/Допуск/);assert.match(regulationReason(configuration('s13','ren'),cup),/атмосфер/);
 assert.throws(()=>enterCup(c,'missing','x'));assert.throws(()=>enterCup(c,'club','x',true),/заезд/);assert.throws(()=>enterCup(newCareer(),'club','x'),/финишей/);assert.throws(()=>enterCup({...c,money:0},'club','x'),/денег/);
 for(const id of ['',null,'x'.repeat(81)])assert.throws(()=>enterCup(c,'club',id));
 const joined=enterCup(c,'club','entry');assert.equal(joined.money,c.money-cup.fee);assert.throws(()=>enterCup(joined,'club','again'),/текущий/);assert.deepEqual(c,copy);assert.deepEqual(validateSave(joined),joined);
});
test('booking pins stage, weather, named rival, registered car and RNG across retries',()=>{
 let c=enterCup(eligible(),'club','same-season');c=prepareStage(c);const copy=structuredClone(c),a=bookCupRace(c,'one'),b=bookCupRace(c,'two');
 assert.equal(a.race.seed,b.race.seed);assert.equal(a.race.eventId,'haruna');assert.equal(a.race.weather,'dry');assert.equal(a.race.rivalName,'Кэй Накамура');assert.equal(a.race.rival.car.id,'mx5');assert.equal(a.race.rivalStyle,'balanced');assert.deepEqual(c,copy);
 assert.throws(()=>bookCupRace({...c,car:'mx5'},'x'),/зарегистр/);assert.throws(()=>bookCupRace({...c,condition:{...c.condition,ae86:35}},'x'),/состояние/);
 for(const id of ['',null,'x'.repeat(81)])assert.throws(()=>bookCupRace(c,id));assert.throws(()=>bookCupRace({...c,awardedRuns:['one']},'one'));
 assert.throws(()=>prepareStage(c,true));assert.throws(()=>prepareStage(newCareer()));assert.throws(()=>bookCupRace(newCareer(),'x'));
});
for(const cup of CUPS)test(`complete four-stage season, standings, durable rewards and save restoration / ${cup.id}`,()=>{
 let c=unlockEverything(newCareer());c.championships.completed=cup.previous?[cup.previous]:[];c.car=cup.id==='club'?'ae86':'s13';
 c=enterCup(c,cup.id,'full-'+cup.id);const initialCash=c.money;
 for(let index=0;index<4;index++){
  c=serviceCar(c);const {race,award}=stage(c,cup.id+'-'+index);c=award.career;
  assert.equal(award.race.seasonReport.stage,index);assert.equal(award.race.seasonReport.rows.length,4);
  for(const row of award.race.seasonReport.rows)assert.equal(row.points,row.dnf||row.falseStart?0:POINTS[row.position-1]);
  assert.throws(()=>awardRace(c,race),/повторно/);assert.deepEqual(validateSave(c),c);
  if(index<3){assert.equal(c.championships.active.stage,index+1);assert.equal(c.championships.active.results.length,index+1);assert.ok(c.championships.active.npcs.some(n=>n.condition<100));assert.equal(standings(c.championships.active).length,4);}
  else{assert.equal(c.championships.active,null);assert.equal(c.championships.history.length,1);assert.ok(award.race.seasonReport.bonus>0);assert.ok(seasonReportHTML(award.race.seasonReport).includes('сезон завершён'));}
  c=validateSave(c);
 }
 assert.ok(c.money>initialCash-100000);assert.equal(c.championships.history[0].cupId,cup.id);
});
test('DNF advances the stage with zero points and damage; unrelated practice does not advance it',()=>{
 let c=enterCup(eligible(),'club','dnf');const booked=bookCupRace(prepareStage(c),'dnf-stage');let race=resolveSector(booked.race,'balanced');race={...race,finished:true,player:{...race.player,dnf:{damage:30,reason:'Вылет',speed:100},velocity:0}};
 const award=awardRace(c,race);assert.equal(award.career.championships.active.stage,1);assert.equal(award.race.seasonReport.rows.find(r=>r.id==='player').points,0);assert.ok(award.career.condition.ae86<70);assert.equal(award.race.seasonReport.finished,false);
 const practice=finish(createRace(configuration('ae86','ren'),'dry','haruna','practice',42));const independent=awardRace(c,practice);assert.equal(independent.career.championships.active.stage,0);assert.deepEqual(settleCup(c,practice).career,c);
});
test('stale season results cannot be awarded and withdrawal does not refund entry or clear achievements',()=>{
 let c=enterCup(eligible(),'club','stale'),booked=bookCupRace(prepareStage(c),'stale-run');assert.throws(()=>settleCup(c,booked.race),/не завершён/);
 const race=finish(booked.race),bad={...race,season:{...race.season,stage:2}};assert.throws(()=>awardRace(c,bad),/этапу/);
 assert.throws(()=>withdrawCup(c,true),/заезд/);const dropped=withdrawCup(c);assert.equal(dropped.money,c.money);assert.equal(dropped.championships.active,null);assert.throws(()=>settleCup(dropped,race));assert.throws(()=>withdrawCup(newCareer()));
});
test('legacy manager preference starts a personal season with no staff salary',()=>{
 let c=unlockEverything(newCareer());c.car='ae86';c.control='manager';c=togglePart(c,'gearbox');c=setCarSetup(c,{pressure:2.05,finalDrive:1.05});c=enterCup(c,'club','managed-season');const prepared=prepareStage(c),booked=bookCupRace(prepared,'managed-stage');assert.equal(booked.race.manager,undefined);assert.equal(booked.career.money,prepared.money);assert.equal(booked.race.config.setup.pressure,2.05);
 const award=awardRace(booked.career,finish(booked.race));assert.equal(award.career.championships.active.stage,1);assert.deepEqual(validateSave(award.career),award.career);
});
test('season normalization discards inconsistent stages, forged points and invalid NPC condition/budgets',()=>{
 const c=enterCup(eligible(),'club','valid'),base=c.championships;assert.deepEqual(normalizeChampionship(undefined),emptyChampionship());assert.deepEqual(normalizeChampionship(base),base);
 for(const patch of [{cupId:'missing'},{stage:5},{stage:1},{attempt:''},{attempt:'x'.repeat(81)},{carId:'missing'},{npcs:[]},{npcs:[{id:'kei',condition:200,budget:0},...base.active.npcs.slice(1)]}]){const raw=structuredClone(base);Object.assign(raw.active,patch);assert.equal(normalizeChampionship(raw).active,null);}
 const first=stage(c,'normalized-stage').award.career.championships;
 for(const mutate of [s=>s.active.results[0].rows[0].points=999,s=>s.active.results[0].rows[0].time=NaN,s=>s.active.results[0].rows[0].position=9,s=>s.active.results[0].rows[0].id='fake',s=>s.active.npcs[0].budget=1e9,s=>s.active.results[0].runId='']){const raw=structuredClone(first);mutate(raw);assert.equal(normalizeChampionship(raw).active,null);}
 const legacy={...newCareer()};delete legacy.championships;assert.deepEqual(validateSave(legacy).championships,emptyChampionship());
 const missingCar={...c,ownedCars:['mx5']};missingCar.championships.active.carId='nsx';assert.equal(validateSave(missingCar).championships.active,null);
});
test('career UI exposes regulation, calendar, named opponents, history and active-race locks',()=>{
 const c=enterCup(eligible(),'club','ui'),html=championshipHTML(c,configuration('ae86','ren'),true);assert.ok(html.includes('Кэй Накамура'));assert.ok(html.includes('ЭТАП 1 / 4'));assert.match(html,/id="season-prepare"[^>]*disabled/);assert.match(html,/id="season-withdraw"[^>]*disabled/);
 assert.ok(championshipHTML(newCareer(),configuration('ae86','ren'),false).includes('Нужно 3 финишей'));assert.equal(seasonReportHTML(null),'');
});
test('exhausted rival repair budget triggers technical DNS, not a free repair or illegal start',()=>{
 let c=enterCup(eligible(),'club','dns');for(const npc of c.championships.active.npcs){npc.condition=35;npc.budget=0;}
 const booked=bookCupRace(prepareStage(c),'dns-stage');assert.equal(booked.race.opponent.dnf.reason,'Технический недопуск');
 const award=awardRace(booked.career,finish(booked.race));
 for(const row of award.race.seasonReport.rows.filter(r=>r.id!=='player')){assert.equal(row.dnf,true);assert.equal(row.points,0);assert.equal(row.time,0);}
 assert.ok(award.career.championships.active.npcs.every(n=>n.budget===0&&n.condition===35));
});
test('podium opens the next tier, recurring cup rewards shrink, and final bonus repays debt once',()=>{
 for(const repeat of [false,true]){
  let c=eligible();if(repeat)c.championships.completed=['club'];c=enterCup(c,'club','bonus-'+repeat);
  let finalAward;
  for(let i=0;i<4;i++){
   c=serviceCar(c);for(const n of c.championships.active.npcs){n.condition=35;n.budget=0;}
   if(i===3)c.repairDebt=50000;
   const booked=bookCupRace(prepareStage(c),'bonus-'+repeat+'-'+i),race=finish(booked.race);finalAward=awardRace(booked.career,race);c=validateSave(finalAward.career);
  }
  const report=finalAward.race.seasonReport;assert.equal(report.rank,1);assert.equal(report.qualified,true);assert.ok(c.championships.completed.includes('club'));assert.equal(cupUnlockReason(c,getCup('regional')),'');
  assert.equal(report.bonus,repeat?7200:18000);assert.equal(report.debtPaid,Math.floor(report.bonus*.5));assert.ok(c.repairDebt<50000);assert.ok(c.championships.history[0].bonus===report.bonus);
  assert.ok(championshipHTML(c,configuration('ae86','ren'),false).includes('Завершённые сезоны'));
 }
});
test('false starts earn zero championship points even if their elapsed time is shortest',()=>{
 let c=enterCup(eligible(),'club','foul');for(let i=0;i<2;i++){const result=stage(c,'foul-prep-'+i);c=result.award.career;c=serviceCar(c);}
 const booked=bookCupRace(prepareStage(c),'foul-stage'),race=finish(booked.race);race.player.drag.falseStart=true;
 const award=awardRace(booked.career,race);assert.equal(award.race.seasonReport.rows.find(r=>r.id==='player').points,0);assert.equal(award.career.championships.active.stage,3);
});
test('four consecutive DNFs cannot farm a final reward or unlock the next tier',()=>{
 let c=enterCup(eligible(),'club','all-dnf');let last;
 for(let i=0;i<4;i++){
  c=serviceCar(c);const booked=bookCupRace(prepareStage(c),'all-dnf-'+i);let r=resolveSector(booked.race,booked.race.mode==='drag'?'drag-warm':'balanced');
  r={...r,finished:true,player:{...r.player,dnf:{damage:20,reason:'Вылет'},velocity:0}};last=awardRace(booked.career,r);c=last.career;
 }
 assert.equal(last.race.seasonReport.bonus,0);assert.equal(last.race.seasonReport.validFinishes,0);assert.equal(last.race.seasonReport.qualified,false);assert.ok(!c.championships.completed.includes('club'));
 assert.ok(seasonReportHTML(last.race.seasonReport).includes('Нет зачётных финишей'));
});
