import test from 'node:test';import assert from 'node:assert/strict';
import {configuration,createRace,resolveSector,simulate,availableCards,chooseAI,futureSectors} from '../src/engine.js';import {getEvent,sectorAt,CARDS} from '../src/data.js';import {raceRecord,bestFor,recordKey} from '../src/progress.js';import {newCareer,validateSave} from '../src/storage.js';import {cardComparison,cardMetricsHTML,strainHTML} from '../src/race-ui.js';import {finishRace} from './helpers.js';
function compare(race,card){const sector=sectorAt(race.index,race.weather,race.eventId,race.routeVersion),state={...race.player,focus:100,strain:4,recentActions:[]},repeated={...state,recentActions:[card.id,'balanced',card.id]},a=simulate(race.config,state,sector,card),b=simulate(race.config,repeated,sector,card);
 for(const key of ['time','risk','slip','speed'])assert.equal(a[key],b[key],race.eventId+' '+card.id+' '+key);for(const key of ['heat','tires','velocity'])assert.equal(a.next[key],b.next[key],race.eventId+' '+card.id+' '+key);if(a.clip)assert.deepEqual(a.clip,b.clip);assert.ok(card.focus>0?b.next.focus<a.next.focus:card.focus<0?b.next.focus<=a.next.focus:b.next.focus===a.next.focus);
 const calm=simulate(race.config,{...state,strain:0},sector,card);assert.equal(calm.time,a.time);assert.equal(calm.risk,a.risk);
}
test('equal-focus repeats preserve time, score, risk, heat, grip and wear in every discipline',()=>{
 for(const id of ['haruna','suzuka','yokohama','yokohama-mile','ebisu']){const config={...configuration('ae86','ren',['streetTires','brakes','cooling','lsd']),routeVersion:3};let r=createRace(config,'dry',id,null,42);
 while(!r.finished){const sector=sectorAt(r.index,r.weather,r.eventId,r.routeVersion),choice=chooseAI(config,r.player,sector,0,futureSectors(r)).card;compare(r,choice);r=resolveSector(r,choice.id);}}
});
test('repeated cooling preserves its thermal effect and low focus still makes execution risky',()=>{
 const r=createRace(configuration('ae86','ren'),'dry','haruna',null,42);r.player.heat=140;r.index=1;compare(r,CARDS.find(c=>c.id==='cool'));
 const s=sectorAt(1,'dry'),card=CARDS[0],high=simulate(r.config,{...r.player,focus:100,strain:0},s,card),low=simulate(r.config,{...r.player,focus:10,strain:0},s,card);assert.ok(low.risk>high.risk);
 const repeated={...r.player,focus:100,recentActions:['attack'],strain:3},metrics=cardMetricsHTML(cardComparison(r.config,repeated,s,CARDS.find(c=>c.id==='attack')));assert.match(metrics,/без штрафа темпа/);assert.ok(!metrics.includes('штраф времени'));assert.match(strainHTML(repeated),/только расход фокуса/);
});
test('prior road, drag and drift bests stay replayable archives with their original keys',()=>{
 for(const [id,prefix] of [['haruna','7'],['yokohama','drag-3'],['ebisu','drift-3']]){const cfg=configuration('ae86','ren'),record=raceRecord(finishRace(cfg,'dry',id)),old={...record,key:prefix+record.key.slice(record.key.indexOf('|'))},saved=validateSave({...newCareer(),bests:[old]});assert.equal(saved.bests.length,1);assert.equal(saved.bests[0].key,old.key);assert.deepEqual(saved.bests[0].sectorTimes,old.sectorTimes);assert.equal(bestFor(saved,cfg,id,'dry'),null);assert.notEqual(recordKey(cfg,id,'dry'),old.key);}
});
