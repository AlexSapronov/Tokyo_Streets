import test from 'node:test';
import assert from 'node:assert/strict';
import {STAFF,SPONSORS,emptyOperations,normalizeOperations,supportCost,repairMultiplier,hireStaff,dismissStaff,sponsorReason,acceptSponsor,cancelSponsor,bookSupport,settleSupport,engineerAdvice} from '../src/operations.js';
import {staffHTML,sponsorsHTML,engineerHTML,supportReportHTML} from '../src/operations-view.js';
import {newCareer,validateSave} from '../src/storage.js';
import {unlockEverything} from '../src/balance.js';
import {configuration,createRace} from '../src/engine.js';
import {finishRace} from './helpers.js';
import {serviceCost,serviceCar,recoveryService,setCarSetup,togglePart} from '../src/garage.js';
import {beginManagedRace,resolveManagedSector} from '../src/manager.js';
import {enterCup,prepareStage,bookCupRace} from '../src/championship.js';
import {awardRace} from '../src/progress.js';
import {getEvent} from '../src/data.js';
function rich(){return unlockEverything(newCareer());}
function signed(id='yokohama'){return acceptSponsor(rich(),id,'contract-'+id);}
function result(c,eventId,runId='race'){
 const r=createRace(configuration(c.car,c.pilot,c.builds[c.car],c.condition[c.car],c.setups[c.car]),'dry',eventId,runId,42);
 return {...r,finished:true,index:getEvent(eventId).sectors.length,history:getEvent(eventId).sectors.map(()=>({telemetry:{oil:100,coolant:90}})),player:{...r.player,tires:90}};
}
function contractRun(c,event='haruna',id='race',edit=r=>r){const booked=bookSupport(c,event,id),r=edit(result(booked.career,event,id));return settleSupport(booked.career,r);}
test('staff hire, level, dismissal, fees and repair discounts are immutable and guarded',()=>{
 let c=rich();const copy=structuredClone(c);assert.equal(supportCost(newCareer()),0);assert.equal(repairMultiplier(newCareer()),1);
 assert.throws(()=>hireStaff(c,'missing'));assert.throws(()=>hireStaff(newCareer(),'mechanic'));assert.throws(()=>hireStaff({...c,money:0},'engineer'));assert.throws(()=>hireStaff(c,'mechanic',true));
 c=hireStaff(c,'mechanic');assert.deepEqual(copy,rich());assert.equal(c.money,copy.money-STAFF.mechanic.fees[0]);assert.equal(supportCost(c),STAFF.mechanic.wages[0]);assert.equal(repairMultiplier(c),.85);
 c.condition[c.car]=40;assert.equal(serviceCost(c),27000);assert.equal(serviceCar(c).condition[c.car],100);
 const recovered=recoveryService({...c,money:0});assert.equal(recovered.repairDebt,9000);assert.equal(recovered.condition[c.car],60);
 c=hireStaff(c,'mechanic');assert.equal(repairMultiplier(c),.75);assert.equal(serviceCost(c),27000);assert.throws(()=>hireStaff(c,'mechanic'));
 c=hireStaff(hireStaff(c,'engineer'),'engineer');assert.equal(supportCost(c),STAFF.mechanic.wages[1]+STAFF.engineer.wages[1]);assert.equal(bookSupport(c,'haruna','fees').fee,supportCost(c));
 assert.throws(()=>dismissStaff(c,'mechanic',true));assert.throws(()=>dismissStaff(c,'missing'));c=dismissStaff(c,'mechanic');assert.equal(supportCost(c),STAFF.engineer.wages[1]);assert.throws(()=>dismissStaff(c,'mechanic'));
 assert.deepEqual(validateSave(c),c);
});
test('sponsor admission, single contract, identity, mode and start affordability',()=>{
 const c=rich();assert.ok(sponsorReason(newCareer(),'yokohama'));assert.ok(sponsorReason(c,'missing'));assert.ok(sponsorReason({...c,street:0,official:0},'hks'));assert.equal(sponsorReason(c,'hks'),'');
 assert.throws(()=>acceptSponsor(c,'missing','x'));assert.throws(()=>acceptSponsor(c,'hks',''));assert.throws(()=>acceptSponsor(c,'hks','x',true));assert.throws(()=>acceptSponsor(signed(),'hks','x'));
 const active=signed();for(const id of ['',null,'x'.repeat(81)])assert.throws(()=>bookSupport(active,'haruna',id));assert.throws(()=>bookSupport(active,'missing','x'));assert.throws(()=>bookSupport({...active,awardedRuns:['old']},'haruna','old'));
 const staff=hireStaff(active,'engineer');assert.throws(()=>bookSupport({...staff,money:0},'haruna','poor'));assert.equal(staff.operations.active.attempts,0);
 const other=bookSupport(active,'yokohama','drag');assert.equal(other.career.operations.active.attempts,0);assert.equal(other.career.operations.pending.contractToken,null);assert.throws(()=>bookSupport(other.career,'haruna','drag'));
 const r=settleSupport(other.career,result(other.career,'yokohama','drag'));assert.equal(r.report,null);assert.equal(r.career.operations.pending,null);
 assert.deepEqual(active,signed());assert.deepEqual(validateSave(bookSupport(active,'haruna','pending').career),bookSupport(active,'haruna','pending').career);
});
for(const s of SPONSORS)test(`complete sponsor program, bonus, cooldown, repeat payment and debt / ${s.id}`,()=>{
 let c=signed(s.id);const event=s.id==='exedy'?'yokohama':'haruna',cash=c.money;
 for(let i=0;i<s.goal;i++){
  const out=contractRun(c,event,s.id+i);c=out.career;assert.ok(out.report.success);assert.equal(out.report.earned,s.pay+(i===s.goal-1?s.bonus:0));assert.deepEqual(validateSave(c),c);
 }
 assert.equal(c.money,cash+s.pay*s.goal+s.bonus);assert.equal(c.operations.active,null);assert.deepEqual(c.operations.completed,[s.id]);assert.equal(c.operations.history[0].status,'done');assert.match(sponsorReason(c,s.id),/финишей/);
 c.races+=3;c=acceptSponsor(c,s.id,'repeat');c.repairDebt=50000;const repeat=contractRun(c,event,'repeat-start');assert.equal(repeat.report.earned,s.pay*.5);assert.equal(repeat.report.debtPaid,Math.floor(s.pay*.25));
 assert.equal(repeat.career.money,c.money+s.pay*.5-repeat.report.debtPaid);
});
test('abandoned eligible starts consume attempts, fail the program and never pay',()=>{
 let c=signed('exedy');c=bookSupport(c,'yokohama','abandoned-1').career;c=bookSupport(c,'yokohama-half','abandoned-2').career;
 assert.equal(c.operations.active.failures,1);assert.equal(c.operations.active.attempts,2);
 c=bookSupport(c,'haruna','unrelated').career;assert.equal(c.operations.active,null);assert.equal(c.operations.history[0].status,'failed');assert.equal(c.operations.history[0].earned,0);
 let y=signed();for(let i=0;i<3;i++)y=contractRun(y,'haruna','bad'+i,r=>({...r,player:{...r.player,tires:60}})).career;assert.equal(y.operations.active,null);
 const a=bookSupport(signed(),'haruna','old');const cancelled=cancelSponsor(a.career);assert.equal(cancelled.money,a.career.money);assert.equal(cancelled.operations.history[0].status,'cancelled');assert.throws(()=>cancelSponsor(cancelled));assert.throws(()=>cancelSponsor(a.career,true));
 cancelled.races+=3;const fresh=acceptSponsor(cancelled,'yokohama','fresh');assert.equal(settleSupport(fresh,result(fresh,'haruna','old')).report,null);assert.equal(fresh.operations.active.successes,0);
});
test('settlement rejects unfinished, stale and repeated results, DNF, foul, incomplete and heat failures',()=>{
 const booked=bookSupport(signed(),'haruna','one'),c=booked.career,r=result(c,'haruna','one');assert.throws(()=>settleSupport(c,{...r,finished:false}));
 assert.equal(settleSupport(c,{...r,runId:'other'}).report,null);assert.equal(settleSupport(c,{...r,eventId:'akagi'}).report,null);
 const out=settleSupport(c,r);assert.equal(settleSupport(out.career,r).report,null);assert.equal(out.career.operations.active.successes,1);
 const cases=[r=>({...r,player:{...r.player,dnf:{damage:30}}}),r=>({...r,player:{...r.player,drag:{falseStart:true}}}),r=>({...r,index:0})];
 for(const edit of cases)assert.equal(contractRun(signed(),'haruna','failure',edit).report.success,false);
 const low=signed();low.condition[low.car]=40;assert.match(contractRun(low).report.reason,/состояние/);
 for(const t of [null,{oil:126,coolant:90},{oil:100,coolant:106},{oil:NaN,coolant:90}])assert.match(contractRun(signed('hks'),'haruna','hot',r=>({...r,history:r.history.map(()=>({telemetry:t}))})).report.reason,/тепловой/);
 assert.match(contractRun(signed('hks'),'haruna','missing',r=>({...r,history:[]})).report.reason,/телеметрии/);
});
test('legacy sponsor data cannot add a payout to a current race',()=>{
 const c=signed('exedy'),booked=bookSupport(c,'yokohama','legacy-contract');
 const race=finishRace(configuration(c.car,c.pilot),'dry','yokohama',null,'legacy-contract');
 const out=awardRace(booked.career,race);assert.equal(out.race.sponsorReport,undefined);assert.throws(()=>awardRace(out.career,race));
});
test('engineer recommendations respect hardware, weather, mode and levels and change actual setup only',()=>{
 assert.throws(()=>engineerAdvice(newCareer()));let c=hireStaff(rich(),'engineer');assert.throws(()=>engineerAdvice(c,'pace'));assert.throws(()=>engineerAdvice(c,'unknown'));
 c=hireStaff(c,'engineer');for(const part of ['gearbox','suspension','aero'])c=togglePart(c,part);
 for(const eventId of ['haruna','ebisu','yokohama','yokohama-mile'])for(const weather of ['dry','mixed','rain'])for(const profile of ['safe','pace']){
  const current={...c,eventId,weather},advice=engineerAdvice(current,profile),next=setCarSetup(current,advice.setup);
  assert.deepEqual(next.builds,current.builds);assert.equal(next.money,current.money);assert.deepEqual(next.setups[next.car],advice.setup);assert.deepEqual(validateSave(next),next);
  if(weather==='rain')assert.equal(advice.setup.springRate,90);
  if(eventId==='yokohama-mile'&&weather==='dry')assert.equal(advice.setup.finalDrive,.92);
 }
 const stock=hireStaff(rich(),'engineer'),advice=engineerAdvice({...stock,weather:'rain'});assert.equal(advice.setup.finalDrive,1);assert.equal(advice.setup.springRate,100);assert.equal(advice.setup.wing,50);assert.equal(advice.setup.pressure,2.05);
});
test('legacy and hostile saves normalize operations without breaking the career',()=>{
 const old=newCareer();delete old.operations;assert.deepEqual(validateSave(old).operations,emptyOperations());assert.deepEqual(normalizeOperations(null),emptyOperations());
 const raw={staff:{mechanic:99,engineer:'2'},completed:['hks','hks','bad'],availableAfter:{hks:10,exedy:-1},history:[null,{id:'hks',status:'done',token:'ok',attempts:2,successes:2,earned:12000},{id:'bad'}],active:{id:'hks',token:'a',attempts:1,successes:0,failures:0,earned:0},pending:{runId:'x',eventId:'missing',contractToken:'a'}};
 const n=normalizeOperations(raw);assert.deepEqual(n.staff,{mechanic:2,engineer:0});assert.deepEqual(n.completed,['hks']);assert.equal(n.history.length,1);assert.equal(n.active,null);assert.equal(n.pending,null);assert.deepEqual(n.availableAfter,{hks:10});
 assert.deepEqual(validateSave({...newCareer(),operations:raw}).operations,emptyOperations());
 assert.equal(normalizeOperations({active:{id:'bad'}}).active,null);
});
test('operations UI exposes cost, contract progress, advice values, locks and reports',()=>{
 let c=rich();assert.match(staffHTML(c),/Нанять/);assert.match(staffHTML(newCareer()),/disabled/);assert.match(engineerHTML(c),/Найми инженера/);assert.equal(supportReportHTML({}), '');
 c=hireStaff(hireStaff(c,'mechanic'),'engineer');assert.match(staffHTML(c,true),/Освободить/);assert.match(engineerHTML(c,true),/disabled/);assert.match(engineerHTML(hireStaff(c,'engineer')),/Темп/);
 c=acceptSponsor(c,'hks','ui');assert.match(sponsorsHTML(c,true),/Отменить контракт/);const out=contractRun(c);assert.match(supportReportHTML({supportFee:450,sponsorReport:out.report}),/HKS/);
 const done=contractRun(out.career,'haruna','second');assert.match(sponsorsHTML(done.career),/История контрактов/);assert.match(supportReportHTML({sponsorReport:{...out.report,success:false,reason:'Сход',debtPaid:100,status:'failed'}}),/Сход/);
 c=hireStaff(c,'mechanic');assert.match(staffHTML(c),/Механик · 2/);
});
for(const s of SPONSORS)test(`legacy sponsor history stays inert through current awards / ${s.id}`,()=>{
 let c=signed(s.id);const event=s.id==='exedy'?'yokohama':'haruna';
 for(let i=0;i<s.goal;i++){
  c=serviceCar(c);const id='archive-'+s.id+i,r=finishRace(configuration(c.car,c.pilot),'dry',event,null,id),a=awardRace(c,r);
  assert.equal(a.race.sponsorReport,undefined);c=validateSave(a.career);
 }
 assert.equal(c.operations.active.successes,0);assert.ok(!c.operations.completed.includes(s.id));
});
