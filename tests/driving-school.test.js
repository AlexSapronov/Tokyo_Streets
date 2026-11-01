import test from 'node:test';
import assert from 'node:assert/strict';
import {newCareer,validateSave} from '../src/storage.js';
import {createLesson,resolveLesson,lessonResult,settleLesson,schoolCards,normalizeSchool,schoolHint} from '../src/driving-school.js';
import {chooseAI,futureSectors} from '../src/engine.js';
import {getEvent,sectorAt} from '../src/data.js';
import {awardRace} from '../src/progress.js';
function finish(c,step,plan=true){let r=createLesson(c,step,'school-'+step);while(!r.finished){const s=sectorAt(r.index,r.weather,r.eventId,r.routeVersion);const id=!plan?'balanced':step===0?(r.index===1?'attack':r.index===3?'breathe':'balanced'):step===1?(r.index===0?'cool':'balanced'):step===2?(r.index===0||r.index===2?'attack':r.index===1?'breathe':'balanced'):chooseAI(r.config,r.player,s,0,futureSectors(r)).card.id;r=resolveLesson(r,id,plan&&step===1&&s.type==='corner'?'late-apex':'neutral');assert.equal(r.player.tires,100);assert.equal(r.history.at(-1).telemetry.tires,100);}return r;}
test('four school sessions unlock sequentially and leave money, XP, reputation and every garage component intact',()=>{
 let c=newCareer();c.condition.ae86=54;c.wear.ae86.engine=61;c.wear.ae86.stockTires=32;const original=structuredClone(c);assert.throws(()=>createLesson(c,1));
 for(let step=0;step<4;step++){const r=finish(c,step);assert.equal(r.config.condition,100);assert.equal(r.config.routeVersion,2);assert.equal(lessonResult(r).passed,true);assert.throws(()=>awardRace(c,r),/Учебные/);const result=settleLesson(c,r);assert.throws(()=>settleLesson(result.career,r),/уже учтён/);assert.throws(()=>settleLesson(c,result.race));c=validateSave(result.career);assert.equal(c.school.step,step+1);assert.equal(c.school.attempts[step],1);const withoutSchool=structuredClone(c);withoutSchool.school=original.school;assert.deepEqual(withoutSchool,original);}
 assert.ok(c.school.bestExam>0);
});
test('failed lesson can be retried and malformed or old saves normalize school state',()=>{
 const c=newCareer(),r=finish(c,0,false);assert.equal(lessonResult(r).passed,false);const result=settleLesson(c,r);assert.equal(result.career.school.step,0);assert.equal(result.career.school.attempts[0],1);assert.throws(()=>settleLesson(c,createLesson(c,0,'unfinished')));const old={...c};delete old.school;assert.equal(validateSave(old).school.step,0);assert.deepEqual(normalizeSchool({step:99,attempts:[-1,NaN,2],bestExam:-1,settled:[1,'ok','ok']}),{step:4,attempts:[0,0,2,0],bestExam:null,settled:['ok']});
});
test('lesson one gates actions and lines in simulation, and teaching advances with checkpoints',()=>{
 const c=newCareer();let r=createLesson(c,0);assert.deepEqual(schoolCards(r).map(c=>c.id),['balanced']);assert.throws(()=>resolveLesson(r,'attack'));assert.throws(()=>resolveLesson(r,'balanced','inside'));r=resolveLesson(r,'balanced');assert.ok(schoolCards(r).some(c=>c.id==='attack'));assert.match(schoolHint(r),/Полная атака/);while(r.index<3)r=resolveLesson(r,'balanced');assert.ok(schoolCards(r).some(c=>c.id==='breathe'));assert.ok(getEvent(r.eventId,2).sectors.length>getEvent(r.eventId).sectors.length);
});
test('exam checks actual time, focus, heat and full finish independently',()=>{
 const c=newCareer();c.school.step=3;const r=finish(c,3);assert.equal(lessonResult(r).passed,true);for(const patch of [{time:r.targets.bronze+1},{focus:29},{heat:146},{dnf:{damage:0}}])assert.equal(lessonResult({...r,player:{...r.player,...patch}}).passed,false);assert.equal(lessonResult({...r,history:r.history.slice(1)}).passed,false);
});
