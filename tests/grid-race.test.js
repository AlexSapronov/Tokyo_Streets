import test from 'node:test';import assert from 'node:assert/strict';
import {CARS,getEvent,sectorAt,eventLength} from '../src/data.js';
import {configuration,createRace,resolveSector,chooseAI,futureSectors,raceOutcome,disabledReason,availableCards} from '../src/engine.js';
import {newCareer,validateSave,exportCareer,importCareer} from '../src/storage.js';
import {unlocked,unlockText,awardRace,raceRecord,bestFor,progressAtTime,checkpointFractions} from '../src/progress.js';
import {GRID_ROSTER,GRID_REWARD,gridStandings,canPit,pitQuote,resolveGridSector,PIT_SECONDS} from '../src/grid-race.js';
import {selectCar,tradeInQuote} from '../src/garage.js';import {trackGeometry} from '../src/track-geometry.js';import {transmissionProfile} from '../src/telemetry.js';import {stockEngineId} from '../src/engine-data.js';import {routeLevel} from '../src/journey.js';
const id='tsukuba-grid',event=getEvent(id,3),parts=['slicks','brakes','suspension','lsd','ecu','exhaust','cams','cooling'];
const config=()=>configuration('nsx','ren',parts);
function drive(cfg=config(),seed=42,stops=[],run='grid-test'){
 let race=createRace(cfg,'rain',id,run,seed);
 while(!race.finished){race.grid.requestPit=stops.includes(race.index);const card=chooseAI(race.config,race.player,sectorAt(race.index,race.weather,id,3),0,futureSectors(race)).card;race=resolveSector(race,card.id);}
 return race;
}
test('invitation event needs 120 Official Rep and 12 finishes, with a real three-lap fixed dry course',()=>{
 const c=newCareer();c.street=1000;c.races=12;c.official=119;assert.equal(unlocked(event,c),false);c.official=120;c.races=11;assert.equal(unlocked(event,c),false);c.races=12;assert.equal(unlocked(event,c),true);assert.match(unlockText(event),/Official Rep 120/);
 assert.equal(event.laps,3);assert.equal(event.sectors.length,event.lapSectors*3);assert.ok(Math.abs(eventLength(event)-6135)<1e-7);assert.equal(createRace(config(),'rain',id).weather,'dry');assert.equal(sectorAt(0,'rain',id).wet,0);
});
test('all three fixed opponents use normal configurations and independent resources regardless of player build',()=>{
 const slow=createRace(configuration('ae86','ren'),'dry',id,null,42),fast=createRace(configuration('supra','ren',parts,100,{},'w16'),'dry',id,null,42);
 assert.equal(slow.grid.rivals.length,3);assert.deepEqual(slow.grid.rivals,fast.grid.rivals);
 for(const [i,e]of slow.grid.rivals.entries()){assert.equal(e.state.tires,100);assert.deepEqual(e.config.car,configuration(GRID_ROSTER[i].carId,GRID_ROSTER[i].pilotId,GRID_ROSTER[i].parts).car);}
 const snap=structuredClone(slow);assert.deepEqual(resolveSector(slow,'balanced'),resolveSector(slow,'balanced'));assert.deepEqual(slow,snap);
});
test('lap transitions carry resources and only lap entry offers optional tire service',()=>{
 let r=createRace(config(),'dry',id,null,42);assert.equal(canPit(r),false);
 while(r.index<event.lapSectors)r=resolveSector(r,'balanced');assert.equal(canPit(r),true);assert.ok(r.player.tires<100);const before=structuredClone(r);
 const plain=resolveGridSector(r,'balanced'),pitted=resolveGridSector(r,'balanced','neutral',true);
 assert.deepEqual(r,before);assert.ok(pitted.player.tires>plain.player.tires);assert.ok(pitted.player.time>plain.player.time+20);assert.equal(pitted.grid.pitBill,pitQuote(config()));assert.deepEqual(pitted.grid.pits,[event.lapSectors]);assert.equal(pitted.grid.requestPit,false);assert.equal(canPit(pitted),false);assert.throws(()=>resolveGridSector(pitted,'balanced','neutral',true),/между кругами/);
 assert.ok(Math.abs(pitted.history.reduce((n,s)=>n+s.playerTime,0)-pitted.player.time)<1e-8);
});
test('pit timing keeps the car stationary before driving and repeated laps share one closed silhouette',()=>{
 const race=drive(config(),42,[event.lapSectors]),record=raceRecord(race),i=event.lapSectors,start=record.sectorTimes.slice(0,i).reduce((a,b)=>a+b,0),checkpoints=checkpointFractions(id,3);
 assert.equal(progressAtTime(record.sectorTimes,start+1,id,3,record.grid.pits),checkpoints[i]);assert.equal(progressAtTime(record.sectorTimes,start+PIT_SECONDS-1,id,3,record.grid.pits),checkpoints[i]);assert.ok(progressAtTime(record.sectorTimes,start+PIT_SECONDS+1,id,3,record.grid.pits)>checkpoints[i]);
 const g=trackGeometry(event),lap=trackGeometry(getEvent('tsukuba',3));
 for(let j=0;j<3;j++)for(const f of [.01,.14,.49,.9]){const a=g.at((j+f)/3),b=lap.at(f);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7);}
});
test('an opponent retirement does not end the field race or award an early victory',()=>{
 let r=createRace(config(),'dry',id,null,42);for(const e of r.grid.rivals)e.state.dnf={damage:10};r=resolveSector(r,'balanced');assert.equal(r.finished,false);assert.equal(r.history.length,1);assert.equal(gridStandings(r)[0].id,'player');
 while(!r.finished)r=resolveSector(r,'balanced');assert.equal(r.history.length,event.sectors.length);assert.equal(raceOutcome(r).won,true);
});
test('first full victory grants the exclusive car once and survives reload; ordinary purchase and trade-in cannot bypass it',()=>{
 const winner=drive();assert.equal(raceOutcome(winner).won,true);const c=newCareer();c.money=100000;assert.throws(()=>selectCar(c,GRID_REWARD),/только за победу/);assert.throws(()=>tradeInQuote(c,GRID_REWARD),/Призовая/);
 const a=awardRace(c,winner);assert.equal(a.race.prizeCar,GRID_REWARD);assert.ok(a.career.ownedCars.includes(GRID_REWARD));assert.equal(a.career.car,'ae86');assert.throws(()=>awardRace(a.career,winner),/повторно/);
 const loaded=importCareer(exportCareer(a.career));assert.deepEqual(loaded.exclusiveRewards,[id]);assert.ok(loaded.ownedCars.includes(GRID_REWARD));assert.equal(loaded.condition[GRID_REWARD],100);assert.equal(stockEngineId(GRID_REWARD),'b58gt4');assert.equal(transmissionProfile(configuration(GRID_REWARD,'ren')).ratios.length,7);
 const again=awardRace(loaded,drive(config(),42,[],'grid-second'));assert.equal(again.race.prizeCar,null);assert.equal(again.career.ownedCars.filter(x=>x===GRID_REWARD).length,1);assert.equal(routeLevel(event,{won:true}),3);
});
test('losing or retiring cannot grant the car; tires are charged on retirement and shortfalls become service debt',()=>{
 const loser=drive(configuration('ae86','ren'));assert.equal(raceOutcome(loser).won,false);assert.equal(awardRace(newCareer(),loser).career.ownedCars.includes(GRID_REWARD),false);
 let r=createRace(config(),'dry',id,'dnf-pit',42);while(r.index<event.lapSectors)r=resolveSector(r,'balanced');r=resolveGridSector(r,'balanced','neutral',true);r.player.dnf={damage:12};r.finished=true;
 const c=newCareer();c.money=100;const a=awardRace(c,r);assert.equal(a.career.money,0);assert.equal(a.career.repairDebt,r.grid.pitBill-100);assert.equal(a.race.prizeCar,null);assert.equal(a.career.bests.length,0);
});
test('three-car replays, pit history and records survive validation without changing results',()=>{
 const r=drive(config(),42,[event.lapSectors,event.lapSectors*2]),record=raceRecord(r),c=validateSave(awardRace(newCareer(),r).career);
 assert.equal(c.bests.length,1);assert.deepEqual(c.bests[0],record);assert.equal(bestFor(c,config(),id,'rain').time,record.time);assert.equal(record.grid.rivals.length,3);
 for(const mutate of [x=>x.grid.rivals.pop(),x=>x.grid.rivals[0].sectorTimes[0]=NaN,x=>x.grid.pits.push(1),x=>x.grid.rivals[0].carId='w16']){const bad=structuredClone(record);mutate(bad);assert.equal(validateSave({...c,bests:[bad]}).bests.length,0);}
});
test('sprint tire changes are optional, and a prepared road car can win without the prize car',()=>{
 const prepared=drive(configuration('ae86','ren',parts)),stock=drive(configuration('ae86','ren'));
 assert.equal(raceOutcome(prepared).won,true);assert.equal(prepared.grid.pits.length,0);assert.ok(stock.player.time>prepared.player.time);assert.ok(prepared.player.focus>=0);
});

test('defending a lead delays only the adjacent pursuer, not all three opponents',()=>{
 const r=createRace(config(),'dry',id,null,42);r.index=event.sectors.findIndex(s=>s.type==='corner');r.player.velocity=35;
 for(const [i,e]of r.grid.rivals.entries()){e.state.time=[.5,5,10][i];e.state.velocity=35;}
 const next=resolveGridSector(r,'defend');assert.equal(next.history[0].impact.rivalDelay,.35);
 assert.equal(next.grid.rivals.filter(e=>e.history[0].reasons.some(s=>s.includes('защищала позицию'))).length,1);assert.ok(next.grid.rivals[0].history[0].reasons.some(s=>s.includes('защищала позицию')));
});
test('tight-corner traffic prevents passing through a car on the same line',()=>{
 const r=createRace(configuration('supraGT4','ren',['slicks','brakes','suspension','lsd']),'dry',id,null,42);r.index=event.sectors.findIndex(s=>s.type==='corner'&&s.radius<70);r.player.time=.01;r.player.velocity=45;
 for(const [i,e]of r.grid.rivals.entries()){e.state.time=[0,10,15][i];e.state.velocity=30;}
 const probe=resolveGridSector(r,'balanced'),line=probe.grid.rivals[0].history[0].lineId,blocked=resolveGridSector(r,'balanced',line);
 assert.ok(blocked.history[0].reasons.some(s=>s.includes('не хватило места')));assert.ok(blocked.player.time>blocked.grid.rivals[0].state.time);
});

test('geometry and race modules can be imported directly without early circular initialization',async()=>{
 const {execFileSync}=await import('node:child_process');
 for(const file of ['track-geometry.js','road-sections.js','grid-race.js']){const url=new URL('../src/'+file,import.meta.url).href;assert.doesNotThrow(()=>execFileSync(process.execPath,['--input-type=module','-e',`import '${url}';`],{stdio:'pipe'}));}
});

test('field breakdown separates grid, pit and traffic costs without double-counting defense',()=>{
 const race=drive(config(),42,[event.lapSectors]);
 for(const row of race.history){const total=Object.values(row.impact.breakdown).reduce((n,x)=>n+x,0)+(row.impact.playerDelay||0);assert.ok(Math.abs(total-row.playerTime)<1e-8);assert.equal(row.impact.decisionGain,null);}
 assert.equal(race.history[0].impact.breakdown.startGrid,.9);assert.equal(race.history[event.lapSectors].impact.breakdown.pit,25);
});
