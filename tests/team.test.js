import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOTS} from '../src/data.js';
import {newCareer,validateSave} from '../src/storage.js';
import {TEAM_PRICE,CREW,ORDERS,emptyTeam,defaultPlan,normalizeTeam,normalizePlan,canFoundTeam,
 foundTeam,hirePilot,assignPilot,renameTeam,setTeamPlan,contractFor,orderName,teamAfterRace} from '../src/team.js';
const eligible=()=>({...newCareer(),money:200000,races:4,street:24});
test('foundation requires career progression and charges its price exactly once',()=>{
 const career=eligible(),snapshot=structuredClone(career),team=foundTeam(career);
 assert.equal(team.money,career.money-TEAM_PRICE);assert.equal(team.team.founded,true);assert.deepEqual(career,snapshot);
 assert.throws(()=>foundTeam(team),/уже/);assert.throws(()=>foundTeam(newCareer()),/4 финиша/);
 assert.throws(()=>foundTeam({...career,money:0}),/Недостаточно/);
 assert.ok(canFoundTeam({...career,street:0,official:12}));assert.ok(!canFoundTeam({...career,races:3}));
});
for(const pilot of PILOTS)test(`contract purchase and assignment / ${pilot.id}`,()=>{
 const founded=foundTeam(eligible()),next=hirePilot(founded,pilot.id);
 assert.equal(next.money,founded.money-CREW[pilot.id].fee);assert.deepEqual(contractFor(next,pilot.id),{pilotId:pilot.id,trust:70,experience:0});
 assert.throws(()=>hirePilot(next,pilot.id),/уже/);assert.equal(assignPilot(next,pilot.id).pilot,pilot.id);
 assert.deepEqual(validateSave(next),next);
});
test('unknown pilots, unaffordable hires and missing contracts cannot mutate the career',()=>{
 const career=foundTeam(eligible()),copy=structuredClone(career);
 assert.throws(()=>hirePilot(career,'fake'),/Неизвестный/);assert.throws(()=>assignPilot(career,'aki'),/Нет контракта/);
 assert.throws(()=>hirePilot({...career,money:0},'aki'),/Недостаточно/);assert.throws(()=>hirePilot(newCareer(),'ren'),/основать/);
 assert.deepEqual(career,copy);assert.equal(contractFor(career),null);
});
test('every HQ operation is blocked while a race is active',()=>{
 const career=hirePilot(foundTeam(eligible()),'ren');
 for(const action of [()=>foundTeam(career,true),()=>hirePilot(career,'aki',true),()=>assignPilot(career,'ren',true),
  ()=>renameTeam(career,'Other',true),()=>setTeamPlan(career,defaultPlan(),true)])assert.throws(action,/заезд/);
});
test('names are bounded literal text and plan fields normalize only documented rules',()=>{
 let career=foundTeam(eligible());career=renameTeam(career,'  <img src=x onerror=1>  ');
 assert.equal(career.team.name,'<img src=x onerror=1>');
 for(const value of ['',null,'x'.repeat(41)])assert.throws(()=>renameTeam(career,value),/40/);
 assert.throws(()=>setTeamPlan(career,{order:'fake'}),/Неизвестный/);
 const next=setTeamPlan(career,{order:'attack',rules:{wet:true,heat:false,focus:'wrong',unknown:true}});
 assert.deepEqual(next.team.plan,{order:'attack',rules:{focus:true,heat:false,wet:true,chase:false}});
 for(const order of ORDERS)assert.equal(orderName(order.id),order.name);assert.equal(orderName('fake'),'Неизвестный приказ');
});
test('legacy saves receive an empty team while malformed team data is repaired independently',()=>{
 const old=newCareer();delete old.team;delete old.control;assert.deepEqual(validateSave(old).team,emptyTeam());
 assert.deepEqual(normalizeTeam(null),emptyTeam());assert.deepEqual(normalizeTeam({founded:false,contracts:[{pilotId:'ren'}]}),emptyTeam());
 const team=normalizeTeam({founded:true,name:'  ',plan:{order:'fake'},contracts:[null,{pilotId:'fake'},{pilotId:'ren',trust:1000,experience:-4},{pilotId:'ren'}, {pilotId:'aki',trust:NaN,experience:Infinity},{pilotId:'yui',trust:-10,experience:2.5}]});
 assert.equal(team.name,emptyTeam().name);assert.deepEqual(team.plan,defaultPlan());assert.equal(team.contracts.length,3);
 assert.deepEqual(team.contracts.map(c=>c.trust),[100,70,40]);assert.deepEqual(team.contracts.map(c=>c.experience),[0,0,2]);
 const raw={...newCareer(),team,control:'manager'};assert.equal(validateSave(raw).control,'manager');
 assert.equal(validateSave({...newCareer(),control:'manager'}).control,'personal');assert.deepEqual(normalizePlan(null),defaultPlan());
});
test('trust changes are bounded, explainable and never charge a second fee',()=>{
 const career=hirePilot(foundTeam(eligible()),'ren'),team=career.team;
 const race={config:{pilot:{id:'ren'}},manager:{fee:1800,log:[{caution:true,refused:true},{caution:false,refused:true}]}};
 const result=teamAfterRace(team,race,{won:false,medal:null});assert.equal(result.feedback.before,70);assert.equal(result.feedback.after,68);
 assert.equal(result.feedback.caution,1);assert.equal(result.feedback.rebellion,1);assert.equal(result.team.contracts[0].experience,1);assert.equal(team.contracts[0].trust,70);
 const low=structuredClone(team);low.contracts[0].trust=40;assert.equal(teamAfterRace(low,race,{won:false}).feedback.after,40);
 const high=structuredClone(team);high.contracts[0].trust=100;high.contracts[0].experience=100000;
 const good={...race,manager:{fee:1800,log:[]}};const settled=teamAfterRace(high,good,{medal:'gold'});
 assert.equal(settled.feedback.after,100);assert.equal(settled.team.contracts[0].experience,100000);
 assert.equal(teamAfterRace(team,{},{won:true}).feedback,null);
 assert.throws(()=>teamAfterRace(emptyTeam(),race,{won:false}),/Контракт/);
 assert.match(teamAfterRace(team,{...race,manager:{fee:1800,log:[{refused:true,caution:false}]}},{won:false}).feedback.reason,/Разногласия/);
});
