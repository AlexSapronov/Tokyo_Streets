import test from 'node:test';import assert from 'node:assert/strict';
import {EVENTS,getEvent,sectorAt} from '../src/data.js';import {ROAD_TURNS} from '../src/road-sections.js';import {trackGeometry} from '../src/track-geometry.js';
import {configuration,createRace,availableCards,disabledReason,resolveSector,chooseAI,futureSectors} from '../src/engine.js';
import {presentationFrame,presentationRecord} from '../src/presentation.js';import {newCareer,validateSave} from '../src/storage.js';import {awardRace} from '../src/progress.js';
test('all nine road venues have authored entry/exit decisions without changing a single point of their silhouette',()=>{
 const roads=EVENTS.filter(e=>['duel','timeattack'].includes(e.mode));assert.equal(roads.length,9);
 for(const old of roads){const e=getEvent(old.id,3),raw=trackGeometry(old),g=trackGeometry(e),sum=e.sectors.reduce((n,s)=>n+s.length,0),total=old.sectors.reduce((n,s)=>n+s.length,0);assert.equal(e.routeVersion,3);assert.equal(e.sectors.filter(s=>s.requiresBraking).length,ROAD_TURNS[e.id].length);assert.ok(Math.abs(sum-total)<1e-7);assert.ok(Math.abs(e.sectors.reduce((n,s)=>n+s.decisionScale,0)-old.sectors.length)<1e-7);
 for(let i=0;i<=1000;i++)assert.deepEqual(g.at(i/1000),raw.at(i/1000));
 e.sectors.forEach((s,i)=>{assert.ok(s.length>20,e.id+' '+s.name);assert.ok(s.entry<s.exit);assert.equal(s.type==='corner',s.requiresBraking);assert.equal(s.radius>0,s.requiresBraking);if(i)assert.equal(e.sectors[i-1].exit,s.entry);if(s.flatOut){assert.equal(s.type,'straight');assert.equal(s.radius,0);}const a=g.pieces[i].at(0),b=raw.at(s.entry);assert.deepEqual(a,b);});
 assert.equal(e.sectors[0].entry,0);assert.equal(e.sectors.at(-1).exit,1);}
});
test('marked hairpins have paired checkpoints, while highway kinks are full-throttle straight decisions',()=>{
 for(const [id,count] of [['haruna',5],['hakone',3],['akagi',6]])assert.equal(getEvent(id,3).sectors.filter(s=>s.requiresBraking).length,count);
 const e=getEvent('wangan',3),config={...configuration('ae86','ren'),routeVersion:3},r=createRace(config,'dry',e.id,null,42),late=availableCards(config).find(c=>c.id==='late');assert.equal(e.sectors.length,5);assert.ok(e.sectors.every(s=>s.type==='straight'&&s.flatOut));for(let i=0;i<e.sectors.length;i++)assert.match(disabledReason(late,sectorAt(i,'dry',e.id,3),r.player,config),/поворот/);
});
test('every authored road completes, awards, saves and produces a replay with matching decisions',()=>{
 for(const e of EVENTS.filter(e=>['duel','timeattack'].includes(e.mode))){const config={...configuration('ae86','ren',['streetTires','brakes','cooling']),routeVersion:3};let r=createRace(config,'dry',e.id,'authored-'+e.id,42,e.mode==='duel'?'easy':null);while(!r.finished){const s=sectorAt(r.index,r.weather,r.eventId,3),choice=chooseAI(config,r.player,s,0,futureSectors(r));r=resolveSector(r,choice.card.id);}
 assert.ok(!r.player.dnf,e.id);assert.equal(r.index,getEvent(e.id,3).sectors.length);const after=validateSave(awardRace(newCareer(),r).career);assert.ok(after.bests.some(b=>b.routeVersion===3),e.id);const rec=presentationRecord(r);for(let i=0;i<r.index;i++){const start=rec.sectorTimes.slice(0,i).reduce((n,t)=>n+t,0);assert.equal(presentationFrame(rec,start+rec.sectorTimes[i]/2,e.id).index,i);}
 }
});
