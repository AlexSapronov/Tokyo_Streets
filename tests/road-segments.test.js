import test from 'node:test';import assert from 'node:assert/strict';
import {EVENTS,getEvent,sectorAt,CARS} from '../src/data.js';import {trackGeometry} from '../src/track-geometry.js';
import {configuration,modernRoadRace,createRace,resolveSector,chooseAI,futureSectors,freeRivalOptions} from '../src/engine.js';
import {newCareer,validateSave} from '../src/storage.js';import {enterCup,prepareStage,bookCupRace} from '../src/championship.js';
import {awardRace,recordKey,checkpointFractions,progressAtTime} from '../src/progress.js';
test('modern road decisions alternate arcs and straight connectors with preserved distance and focus budget',()=>{
 for(const old of EVENTS.filter(e=>['duel','timeattack'].includes(e.mode))){const e=getEvent(old.id,2),g=trackGeometry(e);assert.equal(getEvent(old.id),old);assert.ok(e.sectors.some(s=>s.type==='corner'));assert.ok(e.sectors.some(s=>s.type==='straight'));assert.ok(Math.abs(e.sectors.reduce((n,s)=>n+s.length,0)-old.sectors.reduce((n,s)=>n+s.length,0))<1e-7);assert.ok(Math.abs(e.sectors.reduce((n,s)=>n+s.decisionScale,0)-old.sectors.length)<1e-7);
 e.sectors.forEach((s,i)=>{assert.ok(s.length>=23);if(i)assert.notEqual(s.type,e.sectors[i-1].type);const p=g.pieces[i];if(s.type==='straight'){const a=p.at(0),b=p.at(1),m=p.at(.5);assert.ok(Math.hypot(m[0]-(a[0]+b[0])/2,m[1]-(a[1]+b[1])/2)<1e-6);}else assert.ok(s.radius>=18&&s.radius<=650);if(i){const a=g.pieces[i-1].at(1),b=p.at(0);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6);}});
 }
 const e=getEvent('haruna',2),f=(640+120)/2770,p=trackGeometry(e).pieces.find(p=>f>=p.start&&f<p.end);assert.equal(p.type,'straight');assert.equal(e.sectors[2].type,'straight');assert.ok(e.sectors[2].nextRadius>0);
});
test('new and legacy recorded runs roundtrip independently with matching checkpoint counts',()=>{
 let c=newCareer();for(const version of [undefined,2]){const cfg=configuration('ae86','ren',['streetTires','brakes','cooling']);if(version)cfg.routeVersion=version;let r=createRace(cfg,'dry','haruna','road-'+version,42,'easy');while(!r.finished){const choice=chooseAI(r.config,r.player,sectorAt(r.index,r.weather,r.eventId,r.routeVersion),0,futureSectors(r));r=resolveSector(r,choice.card.id,choice.lineId||'neutral');}assert.ok(!r.player.dnf);c=awardRace(c,r).career;assert.ok(c.bests.find(b=>b.key===recordKey(r.config,r.eventId,r.weather)));const fractions=checkpointFractions(r.eventId,r.routeVersion);assert.equal(fractions.length,r.index+1);assert.ok(Math.abs(progressAtTime(r.history.map(h=>h.playerTime),r.player.time,r.eventId,r.routeVersion)-1)<1e-9);}
 const saved=validateSave(c);assert.equal(Object.keys(saved.bests).length,2);assert.ok(Object.values(saved.bests).some(r=>r.routeVersion===2));assert.ok(saved.player.xp>0);
});
test('modern free-race opponents use the same revision and remain ordered by advertised strength',()=>{
 for(const car of CARS){const options=freeRivalOptions({...configuration(car.id,'ren'),routeVersion:2},'haruna','dry');assert.ok(options.every(o=>o.rival.routeVersion===2));assert.ok(options[0].profile.rating<options[1].profile.rating);assert.ok(options[1].profile.rating<options[2].profile.rating);}
});

test('modernizing a booked season retains its opponent and seed and settles all entrants on the new course',()=>{
 let c=newCareer();c.money=100000;c.races=20;c.street=100;c=prepareStage(enterCup(c,'club','modern-cup'));const booked=bookCupRace(c,'modern-stage'),old=booked.race;let r=modernRoadRace(old);assert.equal(r.seed,old.seed);assert.deepEqual(r.season,old.season);assert.equal(r.rival.car.id,old.rival.car.id);assert.equal(r.rivalName,old.rivalName);assert.equal(r.rival.routeVersion,2);assert.equal(modernRoadRace(r),r);assert.throws(()=>modernRoadRace({...old,index:1}));
 while(!r.finished){const choice=chooseAI(r.config,r.player,sectorAt(r.index,r.weather,r.eventId,2),0,futureSectors(r));r=resolveSector(r,choice.card.id,choice.lineId||'neutral');}
 const result=awardRace(booked.career,r);assert.equal(result.race.seasonReport.rows.length,4);assert.equal(result.career.championships.active.stage,1);assert.deepEqual(validateSave(result.career),result.career);
});
