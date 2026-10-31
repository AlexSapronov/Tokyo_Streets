import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSeries,seriesDefinition,organizerReason,saveSeries,deleteSeries,normalizeOrganizer,exportSeries,importSeries,MAX_SERIES} from '../src/organizer.js';
import {organizerHTML,seriesQuoteHTML} from '../src/organizer-view.js';
import {newCareer,validateSave} from '../src/storage.js';
import {unlockEverything} from '../src/balance.js';
import {activeCup,getCup,enterCup,withdrawCup,prepareStage,bookCupRace,regulationReason,standings,normalizeChampionship} from '../src/championship.js';
import {configuration,chooseAI,futureSectors,resolveSector} from '../src/engine.js';
import {sectorAt} from '../src/data.js';
import {awardRace} from '../src/progress.js';
import {serviceCar,togglePart} from '../src/garage.js';
import {hireStaff,acceptSponsor,supportCost} from '../src/operations.js';
import {resolveManagedSector} from '../src/manager.js';
import {championshipHTML,seasonReportHTML} from '../src/career-view.js';
const id='custom-test';
const rich=()=>unlockEverything(newCareer());
const project=(raw={})=>seriesDefinition({...defaultSeries(),...raw},id);
const saved=(raw={})=>saveSeries(rich(),{...defaultSeries(),...raw},id);
function finish(race){while(!race.finished){const action=chooseAI(race.config,race.player,sectorAt(race.index,race.weather,race.eventId),race.player.time-race.opponent.time,futureSectors(race)).card.id;race=race.manager?resolveManagedSector(race):resolveSector(race,action);}return race;}
test('definition derives all financial and NPC fields and strips imported authority',()=>{
 const s=project({fee:-1,prizes:[1e9],roster:[],budget:1e9,custom:false,tier:3});assert.equal(s.fee,28000);assert.deepEqual(s.prizes,[10000,6000,3000,1000]);assert.equal(s.budget,18000);assert.equal(s.roster.length,3);assert.equal(s.custom,true);
 assert.equal(project({kind:'street'}).fee,25000);
 for(const drives of [['FR'],['FF'],['AWD'],['MR']]){
  const def=project({maxPower:500,drives});for(const r of def.roster)assert.equal(regulationReason(configuration(r[2],r[3],r[5]),def),'');
 }
 const na=project({naOnly:true,maxPower:150});for(const r of na.roster)assert.equal(regulationReason(configuration(r[2],r[3],r[5]),na),'');
 assert.equal(getCup(undefined),undefined);assert.equal(getCup(id),undefined);assert.equal(getCup(id,saved()).id,id);
});
test('editor rejects malformed names, regulations, calendar, funding and unknown identifiers',()=>{
 for(const raw of [null,{},...['','a'.repeat(49),42].map(name=>({...defaultSeries(),name})),...['bad',null].map(kind=>({...defaultSeries(),kind})),...[149,501,150.5,NaN].map(maxPower=>({...defaultSeries(),maxPower})),...[[],['FR','FR'],['4WD'],'FR'].map(drives=>({...defaultSeries(),drives})),{...defaultSeries(),naOnly:1},...[9999,100001,11001,Infinity].map(pool=>({...defaultSeries(),pool})),...[[['haruna','dry']],[...Array(7)].map(()=>['haruna','dry']),[['bad','dry'],['haruna','dry']],[['haruna','snow'],['haruna','dry']],null,[null,null],[['haruna','dry','x'],['haruna','dry']]].map(stages=>({...defaultSeries(),stages})),{...defaultSeries(),drives:['AWD'],maxPower:150}])assert.throws(()=>seriesDefinition(raw,id));
 for(const key of [null,'club','custom-','custom-'+('x'.repeat(65)),'custom-<script>'])assert.throws(()=>seriesDefinition(defaultSeries(),key));
 const s=project({name:'   Моя серия   '});assert.equal(s.name,'Моя серия');assert.equal(project({maxPower:150,pool:10000}).pool,10000);assert.equal(project({maxPower:500,pool:100000}).pool,100000);
});
test('permits depend on both reputation paths, finished races and open tracks',()=>{
 const official=project(),street=project({kind:'street'}),c=rich();assert.match(organizerReason(newCareer(),official),/восемь/);assert.match(organizerReason({...c,races:7},official),/восемь/);assert.match(organizerReason({...c,official:23},official),/Official/);assert.match(organizerReason({...c,street:39,streetPeak:0},street),/Street/);
 assert.equal(organizerReason({...c,street:0,streetPeak:0},official),'');assert.match(organizerReason({...c,street:0,streetPeak:0},project({stages:[['akagi','dry'],['haruna','rain']]})),/маршрут/);
 assert.equal(organizerReason(c,street),'');assert.throws(()=>enterCup(saveSeries(newCareer(),defaultSeries(),id),id,'permit'));
});
test('blueprint editing, capacity, deleting and locks preserve independent immutable careers',()=>{
 const c=rich(),copy=structuredClone(c);let next=saveSeries(c,defaultSeries(),id);assert.deepEqual(c,copy);assert.equal(next.money,c.money);next=saveSeries(next,{...defaultSeries(),name:'Новая серия'},id);assert.equal(next.organizer.series.length,1);assert.equal(next.organizer.series[0].name,'Новая серия');
 for(let i=1;i<MAX_SERIES;i++)next=saveSeries(next,defaultSeries(),'custom-'+i);assert.throws(()=>saveSeries(next,defaultSeries(),'custom-full'),/восьми/);assert.throws(()=>saveSeries(c,defaultSeries(),id,true));assert.throws(()=>deleteSeries(next,id,true));assert.throws(()=>deleteSeries(next,'custom-missing'));
 next=deleteSeries(next,id);assert.equal(next.organizer.series.length,7);
 const active=enterCup(saved(),id,'active');assert.throws(()=>saveSeries(active,defaultSeries(),id),/зафиксирован/);assert.throws(()=>deleteSeries(active,id));const left=withdrawCup(active);assert.equal(deleteSeries(left,id).organizer.series.length,0);assert.equal(left.money,active.money);
 assert.deepEqual(validateSave(next),next);
});
test('JSON sharing copies only rules and calendar, never money, progress or privileged fields',()=>{
 const c=saved(),json=exportSeries(c.organizer.series[0]),parsed=JSON.parse(json);assert.equal(parsed.format,'tokyo-streets-series');assert.equal(parsed.series.id,undefined);assert.equal(parsed.series.fee,undefined);
 parsed.money=1e9;parsed.series.prizes=[1e9];const copied=importSeries(rich(),JSON.stringify(parsed),'custom-import');assert.equal(copied.money,rich().money);assert.deepEqual(copied.organizer.series[0],seriesDefinition(defaultSeries(),'custom-import'));
 for(const text of [null,'x'.repeat(16001),'{','{}','null',JSON.stringify({...parsed,version:2}),JSON.stringify({...parsed,series:{}})])assert.throws(()=>importSeries(rich(),text,'custom-import'));
 assert.throws(()=>importSeries(rich(),json,'custom-import',true));assert.deepEqual(c,saved());
});
for(const control of ['personal','manager'])test(`full six-stage mixed series survives every reload, fixes budget and pays only funded prize / ${control}`,()=>{
 let c=saved({name:'Все дисциплины',stages:[['haruna','dry'],['tsukuba','mixed'],['yokohama','dry'],['ebisu','mixed'],['yokohama-half','dry'],['yokohama-mile','dry']]});c.control=control;c=hireStaff(c,'mechanic');c=acceptSponsor(c,'hks','sponsor');const def=c.organizer.series[0],before=c.money;
 c=enterCup(c,id,'full-'+control);assert.equal(before-c.money,def.fee);assert.deepEqual(activeCup(c.championships.active),def);assert.deepEqual(getCup(id,{championships:c.championships}),def);
 for(let i=0;i<6;i++){
  c=serviceCar(prepareStage(c));const b=bookCupRace(c,'stage-'+control+i),retry=bookCupRace(c,'retry-'+control+i);assert.equal(b.race.seed,retry.race.seed);assert.equal(c.money-b.career.money,0);
  const race=finish(b.race),a=awardRace(b.career,race);assert.equal(a.race.seasonReport.custom,true);assert.equal(a.race.seasonReport.name,'Все дисциплины');assert.equal(a.race.seasonReport.stage,i);assert.equal(a.race.seasonReport.finished,i===5);assert.ok(seasonReportHTML(a.race.seasonReport).includes('Все дисциплины'));
  assert.throws(()=>awardRace(a.career,race));if(i<5)assert.equal(standings(a.career.championships.active).length,4);else{assert.equal(a.race.seasonReport.bonus,def.prizes[a.race.seasonReport.rank-1]);assert.equal(a.career.championships.active,null);assert.ok(a.career.championships.history[0].definition);assert.ok(!a.career.championships.completed.includes(id));}
  c=validateSave(a.career);assert.deepEqual(c,a.career);
 }
 c=deleteSeries(c,id);assert.ok(championshipHTML(c,configuration(c.car,c.pilot),false).includes('Все дисциплины'));assert.deepEqual(validateSave(c),c);
});
test('snapshot is independent from blueprint mutations and cannot replay wrong stages or incompatible car',()=>{
 const entered=enterCup(saved(),id,'frozen'),snapshot=structuredClone(entered.championships.active.definition);entered.organizer.series[0].name='Изменено';entered.organizer.series[0].stages[0]=['akagi','rain'];assert.deepEqual(activeCup(entered.championships.active),snapshot);assert.equal(prepareStage(entered).eventId,'haruna');
 const b=bookCupRace(prepareStage(entered),'snapshot'),race=finish(b.race);assert.throws(()=>awardRace(b.career,{...race,season:{...race.season,stage:1}}));assert.throws(()=>bookCupRace({...entered,car:'evo'},'wrong'));
 let limited=enterCup(saved({maxPower:150}),id,'limit');limited=togglePart(togglePart(limited,'ecu'),'cams');assert.throws(()=>bookCupRace(limited,'power'),/Лимит/);
 assert.throws(()=>enterCup({...saved(),money:1},id,'poor'));assert.throws(()=>enterCup(saved(),id,'locked',true));
});
test('all-DNF custom series loses its fund and awards no final prize or career tier',()=>{
 let c=enterCup(saved(),id,'dnf');for(let i=0;i<2;i++){const b=bookCupRace(serviceCar(prepareStage(c)),'dnf'+i);const race=resolveSector(b.race,'balanced'),a=awardRace(b.career,{...race,finished:true,player:{...race.player,dnf:{damage:30}}});c=a.career;if(i===1){assert.equal(a.race.seasonReport.bonus,0);assert.equal(a.race.seasonReport.validFinishes,0);}}
 assert.equal(c.championships.active,null);assert.equal(c.championships.history[0].bonus,0);assert.equal(c.championships.completed.includes(id),false);
});
test('hostile and legacy saves rebuild definitions and drop invalid projects or snapshots',()=>{
 const old=newCareer();delete old.organizer;assert.deepEqual(validateSave(old).organizer,{series:[]});assert.deepEqual(normalizeOrganizer(null),{series:[]});assert.deepEqual(normalizeOrganizer({series:[null,{},project(),project(),{...project(),id:'club'}]}),{series:[project()]});
 assert.equal(normalizeOrganizer({series:Array.from({length:12},(_,i)=>({...project(),id:'custom-'+i}))}).series.length,8);
 const c=enterCup(saved(),id,'save');c.organizer.series[0].fee=-1;c.championships.active.definition.prizes=[1e9];const clean=validateSave(c);assert.equal(clean.organizer.series[0].fee,28000);assert.deepEqual(clean.championships.active.definition.prizes,[10000,6000,3000,1000]);
 const bad=structuredClone(c);bad.championships.active.definition.stages=[];assert.equal(validateSave(bad).championships.active,null);
 const collision=structuredClone(c);collision.championships.active.definition.id='custom-other';assert.equal(validateSave(collision).championships.active,null);
 const missing=structuredClone(c);delete missing.championships.active.definition;assert.equal(validateSave(missing).championships.active,null);
 const h={cupId:id,definition:project(),rank:1,points:21,bonus:10000,attempt:'history'};assert.equal(normalizeChampionship({history:[h]}).history.length,0);assert.equal(normalizeChampionship({history:[{...h,points:20}]}).history.length,1);
});
test('UI escapes names, exposes financial risk and locks active projects',()=>{
 const c=saved({name:'<img src=x onerror=alert(1)>'}),def=c.organizer.series[0];let html=organizerHTML(c,def,id,false);assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));assert.match(html,/Провести и участвовать/);assert.match(html,/28/);assert.match(html,/невыплаченные/);assert.match(html,/JSON для обмена/);
 assert.match(organizerHTML(newCareer(),defaultSeries(),null,true),/disabled/);assert.match(seriesQuoteHTML(c,{...defaultSeries(),pool:0}),/negative/);assert.match(seriesQuoteHTML(newCareer(),defaultSeries()),/восемь/);
 const active=enterCup(c,id,'ui');html=championshipHTML(active,configuration('ae86','ren'),false);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
 assert.match(organizerHTML({...c,organizer:{series:[]}},defaultSeries()),/первый проект/);
});
