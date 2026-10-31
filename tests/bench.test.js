import test from 'node:test';
import assert from 'node:assert/strict';
import {newCareer} from '../src/storage.js';
import {benchDraft,normalizeBenchDraft,compareBench,benchPart,benchmark} from '../src/bench.js';
import {configuration} from '../src/engine.js';
import {EVENTS} from '../src/data.js';
test('virtual comparison is deterministic and never purchases, repairs or mutates the career',()=>{
 const career=newCareer();career.condition.ae86=60;career.wear.ae86.engine=20;const before=structuredClone(career),draft=benchPart(career,benchDraft(career),'ecu',true);
 const result=compareBench(career,draft);assert.ok(result.after.profile.power>result.before.profile.power);assert.ok(result.after.time<result.before.time);assert.deepEqual(compareBench(career,draft),result);assert.deepEqual(career,before);
 assert.equal(result.before.profile.power,130);assert.equal(career.purchased.ae86.length,0);
});
test('a virtual tire replaces its slot, incompatible motor parts disappear and changed car resets the draft',()=>{
 const c=newCareer();let draft=benchPart(c,benchPart(c,benchDraft(c),'tires',true),'wetTires',true);assert.deepEqual(draft.parts,['wetTires']);draft=benchPart(c,draft,'wetTires',false);assert.deepEqual(draft.parts,[]);
 assert.throws(()=>benchPart(c,draft,'bogus',true));draft.engineId='1jz';draft.parts=['turbo','cams'];draft=normalizeBenchDraft(c,draft);assert.deepEqual(draft.parts,['turbo']);
 draft.engineId='4age';draft=normalizeBenchDraft(c,draft);assert.deepEqual(draft.parts,[]);
 c.car='evo';assert.equal(normalizeBenchDraft(c,draft).carId,'evo');assert.equal(normalizeBenchDraft(c,{...benchDraft(c),engineId:'bogus',weather:'snow',eventId:'missing'}).engineId,'4g63');
});
test('wet slick comparison exposes worse grip; every discipline returns finite comparable metrics',()=>{
 const c=newCareer(),draft={...benchDraft(c),weather:'rain',eventId:'tsukuba',parts:['slicks']};const result=compareBench(c,draft);
 assert.ok(result.after.profile.grip<result.before.profile.grip);assert.ok(result.after.time>result.before.time);assert.ok(result.notes.some(n=>n.includes('ниже')));
 for(const mode of ['duel','timeattack','drag','drift']){const e=EVENTS.find(e=>e.mode===mode),result=benchmark(configuration('s13','ren'),e.id,'dry');assert.ok(Number.isFinite(result.time));assert.equal(result.sectors.length,e.sectors.length);if(mode==='drift')assert.ok(result.score>0);}
 assert.throws(()=>benchmark(configuration('ae86','ren'),'bogus','dry'));
});
