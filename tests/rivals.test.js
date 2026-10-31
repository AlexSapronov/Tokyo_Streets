import test from 'node:test';
import assert from 'node:assert/strict';
import {newCareer,validateSave} from '../src/storage.js';
import {CHALLENGES,CREWS,challengeReason,challengeTarget,previewChallenge,bookChallenge,normalizeRivals,settleChallenge} from '../src/rivals.js';
import {configuration,resolveSector} from '../src/engine.js';
import {awardRace} from '../src/progress.js';
import {getEvent} from '../src/data.js';
const rich=()=>({...newCareer(),money:100000,races:30,street:100});
test('crew chains gate their next rival and route, fixed opponents never scale with player tuning',()=>{
 const c=newCareer();assert.equal(challengeReason(c,'cedar-1'),'');assert.match(challengeReason(c,'cedar-2'),/предыдущего/);assert.match(challengeReason(c,'harbor-1'),/трассу/);
 const before=structuredClone(c),a=previewChallenge(configuration('ae86','ren'),'cedar-1'),b=previewChallenge(configuration('supra','ren',['ecu','turbo']),'cedar-1');
 assert.deepEqual(a.rival,b.rival);assert.equal(a.weather,'dry');assert.equal(a.config.rivalLevel,undefined);assert.deepEqual(c,before);
 assert.throws(()=>bookChallenge(c,'cedar-2','blocked'),/предыдущего/);assert.deepEqual(c,before);
});
test('every crew definition has a supported discipline and a finite fixed drift benchmark',()=>{
 for(const c of CHALLENGES){assert.ok(CREWS.some(crew=>crew.id===c.crew));assert.equal(getEvent(c.eventId).id,c.eventId);const target=challengeTarget(c);if(c.crew==='sideways'){assert.equal(getEvent(c.eventId).mode,'drift');assert.ok(target>0&&target<=800);assert.equal(challengeTarget(c),target);}else assert.equal(target,null);}
});
test('first challenge victory pays once, repays debt and survives reload; duplicate award is refused',()=>{
 let c=rich();c.car='ae86';c.repairDebt=10000;const booked=bookChallenge(c,'cedar-1','crew-win'),before=structuredClone(c);let r=booked.race;
 while(!r.finished)r=resolveSector(r,'balanced');
 // A legitimate opponent retirement makes this a guaranteed winning fixture.
 r.opponent.dnf={reason:'test retirement',damage:0,speed:0};
 const first=awardRace(booked.career,r);assert.equal(first.race.challengeReport.reward,4000);assert.equal(first.race.challengeReport.debtPaid,2000);
 assert.ok(first.career.rivals.completed.includes('cedar-1'));assert.deepEqual(c,before);
 assert.throws(()=>awardRace(first.career,r),/повторно/);
 c=validateSave(first.career);assert.ok(c.rivals.completed.includes('cedar-1'));assert.equal(challengeReason(c,'cedar-2'),'');
 const again=settleChallenge(c,r,{won:true});assert.equal(again.report.reward,0);assert.equal(again.career.money,c.money);
 const lost=settleChallenge(rich(),{...r,player:{...r.player,dnf:{}}},{won:false});assert.equal(lost.report.reward,0);assert.deepEqual(lost.career.rivals.completed,[]);
});
test('last crew victory grants a persistent badge by completed chain, corrupt IDs are dropped',()=>{
 const c=rich();c.rivals.completed=['cedar-1','cedar-2'];const r=bookChallenge(c,'cedar-3','final').race;r.finished=true;
 const done=settleChallenge(c,r,{won:true});assert.equal(done.report.badge,CREWS[0].badge);assert.equal(done.career.rivals.completed.length,3);
 assert.deepEqual(normalizeRivals({completed:['bogus','cedar-1','cedar-1']}),{completed:['cedar-1']});
});
