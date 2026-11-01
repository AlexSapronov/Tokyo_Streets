import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {newCareer,validateSave} from '../src/storage.js';
import {configuration} from '../src/engine.js';
import {awardRace,unlockText} from '../src/progress.js';
import {EVENTS,getEvent} from '../src/data.js';
import {emptyJourney,normalizeJourney,routeLevel,routeTarget,settleJourney,nextMilestone,MILESTONES,MAIN_MILESTONES} from '../src/journey.js';
import {journeyHTML,journeyFocusHTML,routeMasteryHTML,journeyReportHTML} from '../src/journey-view.js';
import {mountWorkbench} from '../src/workbench.js';
import {finishRace} from './helpers.js';
const cfg=configuration('ae86','ren');
const race=(event='haruna',weather='dry')=>finishRace(cfg,weather,event,null,event+weather);
test('route stamps cover all disciplines, explicit thresholds and invalid finishes',()=>{
 for(const e of EVENTS.filter(e=>!e.grid)){
  assert.equal(routeLevel(e,{dnf:true,won:true,medal:'gold'}),0);
  assert.equal(routeLevel(e,{falseStart:true,won:true,medal:'gold'}),0);
  assert.equal(routeLevel(e,{}),1);
  for(let n=0;n<=3;n++)assert.ok(routeTarget(e,n).length);
  if(e.mode==='duel'){assert.equal(routeLevel(e,{won:true,weather:'dry'}),2);assert.equal(routeLevel(e,{won:true,weather:'rain'}),3);}
  else if(e.mode==='drag'){for(const reaction of [-1,NaN,undefined,.251])assert.equal(routeLevel(e,{won:true,reaction}),2);for(const reaction of [0,.25])assert.equal(routeLevel(e,{won:true,reaction}),3);}
  else {assert.equal(routeLevel(e,{medal:'bronze'}),2);assert.equal(routeLevel(e,{medal:'silver'}),2);assert.equal(routeLevel(e,{medal:'gold'}),3);}
 }
 assert.match(unlockText(getEvent('irohazaka')),/28.* и .*5/);assert.equal(unlockText(getEvent('haruna')),'Доступно');assert.match(unlockText(getEvent('akagi')),/12/);assert.match(unlockText(getEvent('tsukuba')),/2/);
});
test('new stamps pay each crossed tier once across builds and reloads; no downgrade',()=>{
 const c=newCareer(),r=race(),before=structuredClone(c);
 const a=settleJourney(c,r,{won:true});assert.deepEqual(c,before);assert.equal(a.career.journey.routes.haruna,2);assert.equal(a.report.bonus,12000);assert.equal(a.report.stamps.length,2);
 const b=settleJourney(validateSave(a.career),{...r,weather:'rain',config:configuration('evo','aki')},{won:true});assert.equal(b.report.bonus,4000);assert.equal(b.career.journey.routes.haruna,3);
 const repeat=settleJourney(b.career,r,{won:false});assert.equal(repeat.report.bonus,0);assert.equal(repeat.career.journey.routes.haruna,3);
 assert.deepEqual(validateSave(b.career),b.career);
 for(const player of [{...r.player,dnf:{damage:10}},{...r.player,drag:{falseStart:true}}]){const a=settleJourney(c,{...r,player},{won:true});assert.equal(a.report.bonus,0);assert.deepEqual(a.career,c);}
});
test('milestones support multiple disciplines and complete through preparation and cups',()=>{
 let c=newCareer();assert.equal(nextMilestone(c).id,'club');
 for(const [id,outcome] of [['haruna',{}],['tsukuba',{medal:'bronze'}],['ebisu',{medal:'gold'}]])c=settleJourney(c,race(id),outcome).career;
 assert.deepEqual(c.journey.claimed,['debut','result','explore']);assert.equal(nextMilestone(c).id,'club');
 c.purchased.ae86=['streetTires','brakes','lsd'];for(const id of ['club','regional','masters','allstars','legends'])c.championships.completed.push(id);
 const a=settleJourney(c,race(),{});assert.deepEqual(a.career.journey.claimed,MILESTONES.map(m=>m.id));assert.equal(a.report.milestones.length,6);assert.equal(nextMilestone(a.career),undefined);
 assert.equal(settleJourney(a.career,race(),{}).report.bonus,0);
});
test('new premium debt deduction is bounded and transaction shares duplicate-run protection',()=>{
 const c={...newCareer(),repairDebt:100000},r=race();
 const a=awardRace(c,r);assert.ok(a.race.journeyReport.bonus>0);assert.equal(a.race.journeyReport.debtPaid,Math.floor(a.race.journeyReport.bonus/2));
 assert.equal(a.career.money,c.money+a.race.outcome.reward-a.race.debtPaid+a.race.journeyReport.bonus-a.race.journeyReport.debtPaid);
 assert.equal(a.career.repairDebt,c.repairDebt-a.race.debtPaid-a.race.journeyReport.debtPaid);
 assert.throws(()=>awardRace(validateSave(a.career),r),/повторно/);
 const tiny=settleJourney({...newCareer(),repairDebt:1},r,{});assert.equal(tiny.report.debtPaid,1);assert.equal(tiny.career.repairDebt,0);
});
test('migration preserves provable legacy progress without retroactive rewards and normalizes corruption',()=>{
 const c=newCareer();delete c.journey;c.eventCompletions={haruna:40,akagi:1};c.records=[{eventId:'haruna',won:true,weather:'rain'},{eventId:'ebisu',medal:'gold'},{eventId:'yokohama',won:true,falseStart:true}];c.bests=[{eventId:'nikko'}];
 const j=normalizeJourney(null,c);assert.deepEqual(j.routes,{haruna:3,akagi:1,ebisu:3,nikko:1});assert.deepEqual(j.claimed,['debut','result','explore']);
 c.journey=j;assert.equal(settleJourney(c,race(),{}).report.bonus,0);
 assert.deepEqual(normalizeJourney({routes:{haruna:4,akagi:-1,ebisu:2,nikko:1.5,unknown:3},claimed:['unknown','debut','debut']},newCareer()),{routes:{ebisu:2},claimed:['debut']});
 const old=newCareer();delete old.journey;old.eventCompletions.haruna=3;const loaded=validateSave(old);assert.equal(loaded.money,old.money);assert.equal(loaded.journey.routes.haruna,1);assert.ok(loaded.journey.claimed.includes('debut'));assert.deepEqual(validateSave(loaded),loaded);
 const noJourney={...newCareer()};delete noJourney.journey;assert.deepEqual(settleJourney(noJourney,race(),{}).career.journey.routes,{haruna:1});assert.deepEqual(normalizeJourney('bad',newCareer()),emptyJourney());
});
test('career views expose goals, route targets, discipline progress, completion and race locks',()=>{
 const c=newCareer();assert.match(journeyFocusHTML(c),/data-journey-event="haruna"/);assert.match(journeyFocusHTML(c,true),/disabled/);
 for(const e of EVENTS)for(let n=0;n<=3;n++){c.journey.routes[e.id]=n;assert.match(routeMasteryHTML(c,e),new RegExp(n+'/3'));}
 assert.ok(journeyHTML(c).includes('Твоя специализация'));
 for(const m of MAIN_MILESTONES){c.championships.completed=MAIN_MILESTONES.slice(0,MAIN_MILESTONES.indexOf(m)).map(x=>x.id);assert.ok(journeyFocusHTML(c).includes(m.title));}c.championships.completed=MAIN_MILESTONES.map(m=>m.id);
 c.journey.claimed=MILESTONES.map(m=>m.id);assert.match(journeyFocusHTML(c),/Легенда/);assert.match(journeyHTML(c),/ЗАЧТЕНО/);
 assert.equal(journeyReportHTML(null,'haruna'),'');assert.match(journeyReportHTML({bonus:0},'haruna'),/Новых отметок нет/);
 const a=settleJourney(newCareer(),race(),{won:true});assert.match(journeyReportHTML({...a.report,debtPaid:2},'haruna'),/удержано/);assert.match(journeyReportHTML(a.report,'haruna'),/разовые|Разовые/);
 const {document,HTMLElement}=parseHTML('<main>'+journeyHTML(c)+'<div class="event-grid"></div><div class="section-title">records</div><h2>history</h2></main>');HTMLElement.prototype.getBoundingClientRect=()=>({top:200});const root=document.querySelector('main');mountWorkbench(root,'world',c,null);assert.ok(root.querySelector('#pane-world-journey .journey-panel'));assert.ok(!root.querySelector('#pane-world-events .journey-panel'));
});
test('route rivals stay fixed when the player upgrades through classes',async()=>{
 const {createRace}=await import('../src/engine.js');
 for(const e of EVENTS.filter(e=>!e.grid)){const rivals=['ae86','chaser','evo','supra'].map(id=>createRace(configuration(id,'ren'),'dry',e.id).rival);for(const rival of rivals){assert.equal(rival.car.id,e.rivalCar);assert.deepEqual(rival.parts,e.rivalParts);}}
 const stock=race(),upgraded=finishRace(configuration('supra','ren'),'dry','haruna',null,'harunadry');
 assert.ok(!stock.player.dnf&&!upgraded.player.dnf);assert.ok(upgraded.player.time<stock.player.time);
});
