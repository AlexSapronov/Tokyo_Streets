import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration,createRace,resolveSector,isRaceFinished,raceOutcome} from '../src/engine.js';
import {newCareer,validateSave} from '../src/storage.js';
import {awardRace} from '../src/progress.js';

test('duel ends on rival retirement, even at first checkpoint',()=>{
 assert.equal(isRaceFinished({}, {},1,8),false);
 assert.equal(isRaceFinished({}, {dnf:{reason:'off track'}},1,8),true);
 assert.equal(isRaceFinished({dnf:{reason:'off track'}},{},1,8),true);
 assert.equal(isRaceFinished({}, {},8,8),true);
});
test('rival retirement grants a proper win without inventing a full-course best or replay',()=>{
 const config=configuration('ae86','ren');
 const start=createRace(config,'dry','haruna','opponent-retired',42,'equal');
 const first=resolveSector(start,'attack');
 assert.equal(first.history.length,1);
 const race={...first,finished:true,opponent:{...first.opponent,dnf:{reason:'off track',damage:0,speed:0}}};
 const result=raceOutcome(race);
 assert.equal(result.won,true);
 assert.match(result.label,/сход соперника/);
 const {career, race:awarded}=awardRace(newCareer(),race);
 assert.equal(awarded.finished,true);assert.equal(awarded.awarded,true);
 assert.equal(career.races,1);assert.equal(career.wins,1);
 assert.equal(career.bests.length,0);
 assert.equal(career.best,null);
 assert.ok(career.records[0].won);
 assert.equal(validateSave(career).bests.length,0);
 assert.throws(()=>awardRace(career,awarded),/повторно/);
});
test('normal full-distance results remain eligible for ghost records',()=>{
 let race=createRace(configuration('ae86','ren'),'dry','haruna','full-course',42,'equal');
 while(!race.finished){
   race=resolveSector(race,'balanced');
 }
 const {career, race:result}=awardRace(newCareer(),race);
 assert.equal(result.awarded,true);
 assert.equal(career.records.length,1);
 if(!race.player.dnf&&!race.player.drag?.falseStart){
   assert.equal(career.bests.length,1);
   assert.equal(career.bests[0].sectorTimes.length,8);
 }
});
