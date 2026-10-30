import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,CARDS,sectorAt} from '../src/data.js';
import {configuration,createRace,resolveSector,chooseAI,futureSectors,simulate} from '../src/engine.js';
import {newCareer,validateSave,loadCareer,SAVE_KEY} from '../src/storage.js';
import {awardRace,raceRecord,bestFor,cumulativeTimes,unlockText,progressAtTime} from '../src/progress.js';
import {finishRace,generator} from './helpers.js';

test('configuration handles non-finite condition and duplicate parts without leaking input references',()=>{
 for(const bad of [NaN,Infinity,-Infinity,undefined])assert.equal(configuration('bad','bad',null,bad).condition,100);
 const input=['lsd','lsd'];const config=configuration('ae86','ren',input,-100);
 assert.equal(config.condition,35);assert.deepEqual(config.parts,['lsd']);assert.deepEqual(input,['lsd','lsd']);
 config.parts.push('brakes');assert.deepEqual(input,['lsd','lsd']);
});
test('defending penalizes the pursuer symmetrically and AI can select defence to win a close finish',()=>{
 let race=createRace(configuration('chaser','aki'));
 race.index=7;race.player.time=51;race.opponent.time=50;race.opponent.focus=8;race.opponent.cooldowns.study=1;
 const ai=chooseAI(race.rival,race.opponent,sectorAt(7),-1,futureSectors(race));
 assert.equal(ai.card.id,'defend');
 const baseline=simulate(race.config,race.player,sectorAt(7),CARDS[0]);
 const result=resolveSector(race,'balanced');
 assert.ok(Math.abs(result.history[0].playerTime-baseline.time-.35)<1e-9);
 assert.ok(result.history[0].reasons.some(reason=>reason.includes('закрыл')));
 race=createRace(configuration('chaser','aki'));race.player.time=49;race.opponent.time=50;
 const expected=chooseAI(race.rival,race.opponent,sectorAt(0),1,futureSectors(race)).result.time;
 assert.ok(Math.abs(resolveSector(race,'defend').history[0].aiTime-expected-.35)<1e-9);
});
test('a completed run ID cannot be awarded again through an old object or after save reload',()=>{
 const race=finishRace(configuration('ae86','ren'),'dry','haruna',null,'durable-run-id');
 const original=newCareer(),result=awardRace(original,race),snapshot=structuredClone(result.career);
 assert.throws(()=>awardRace(result.career,race),/повторно/);
 const loaded=loadCareer({getItem:key=>key===SAVE_KEY?JSON.stringify(result.career):null});
 assert.throws(()=>awardRace(loaded,race),/повторно/);assert.deepEqual(result.career,snapshot);
 const another=finishRace(configuration('ae86','ren'),'dry','haruna',null,'different-run-id');
 assert.equal(awardRace(loaded,another).career.races,2);
});
test('save validation rejects unsupported formats and repairs malformed defaults field by field',()=>{
 for(const value of [null,[],{},42,{version:999}])assert.throws(()=>validateSave(value),/сохранение/);
 const raw={version:2,money:Infinity,car:'evo',pilot:'unknown',ownedCars:'evo',builds:null,purchased:null,
  condition:{ae86:NaN,chaser:-100,evo:300},races:-3,wins:'oops',street:NaN,official:-10,
  best:-1,weather:'snow',eventId:'missing',ghostEnabled:false,helpSeen:'yes'};
 const fixed=validateSave(raw);assert.equal(fixed.money,80000);assert.equal(fixed.car,'ae86');assert.equal(fixed.pilot,'ren');
 assert.deepEqual(fixed.condition,{ae86:100,chaser:35,evo:100});assert.equal(fixed.races,0);assert.equal(fixed.wins,0);
 assert.equal(fixed.weather,'mixed');assert.equal(fixed.eventId,'haruna');assert.equal(fixed.ghostEnabled,false);assert.equal(fixed.helpSeen,false);
 assert.equal(validateSave({...newCareer(),money:2e9}).money,1e9);
});
test('inventory normalization drops unknown equipment and unequipped purchases remain owned',()=>{
 const raw={...newCareer(),ownedCars:['ae86','ae86','invented'],purchased:{ae86:['lsd','lsd','fake']},builds:{ae86:['brakes','lsd','lsd']}};
 const loaded=validateSave(raw);assert.deepEqual(loaded.ownedCars,['ae86']);assert.deepEqual(loaded.purchased.ae86,['lsd']);assert.deepEqual(loaded.builds.ae86,['lsd']);
});
test('history validation drops invalid timings and uses known labels, preventing persisted markup injection',()=>{
 const raw={...newCareer(),records:[null,{car:'<img onerror=1>',time:99,won:false,weather:'<script>',eventId:'bad',medal:'evil'},
  {car:CARS[0].name,time:NaN,won:true},{car:CARS[0].name,time:-1,won:true}]};
 const fixed=validateSave(raw);assert.equal(fixed.records.length,1);assert.equal(fixed.records[0].car,CARS[0].name);
 assert.equal(fixed.records[0].weather,'mixed');assert.equal(fixed.records[0].eventId,'haruna');assert.equal(fixed.records[0].medal,null);
});
test('ledger and histories are bounded and duplicate run IDs are removed',()=>{
 const raw={...newCareer(),awardedRuns:[null,'','x'.repeat(81),'same','same',...Array.from({length:300},(_,i)=>'run-'+i)],
  records:Array.from({length:50},()=>({car:CARS[0].name,time:100,won:true}))};
 const fixed=validateSave(raw);assert.equal(fixed.awardedRuns.length,256);assert.equal(fixed.records.length,30);assert.equal(fixed.awardedRuns.at(-1),'run-299');
});
test('replay validation checks phase ownership, preparation timing, finite drag telemetry and total time',()=>{
 const config=configuration('ae86','ren');
 const record=raceRecord(finishRace(config,'dry','yokohama'));
 const variations=[{...record,actions:['drag-soft',...record.actions.slice(1)]},
  {...record,actions:['apex',...record.actions.slice(1)]},
  {...record,sectorTimes:[0,0,record.time,0]},
  {...record,drag:null},{...record,drag:{...record.drag,falseStart:true}},
  {...record,drag:{...record.drag,et:Infinity}},{...record,time:record.time+1}];
 for(const bad of variations)assert.equal(validateSave({...newCareer(),bests:[bad]}).bests.length,0);
});
test('road replay cannot borrow a different pilot ability or an uninstalled equipment card',()=>{
 const record=raceRecord(finishRace(configuration('ae86','ren'),'dry'));
 for(const id of ['rain','dive','thermal']){
  const actions=[...record.actions];actions[1]=id;
  assert.equal(validateSave({...newCareer(),bests:[{...record,actions}]}).bests.length,0);
 }
});
test('valid duplicate leaderboard keys retain the fastest trace rather than the last loaded trace',()=>{
 const record=raceRecord(finishRace(configuration('ae86','ren'),'dry'));
 const faster=structuredClone(record);faster.sectorTimes[1]-=.1;faster.time-=.1;
 const career=validateSave({...newCareer(),bests:[record,faster,record]});
 assert.equal(career.bests.length,1);assert.equal(bestFor(career,configuration('ae86','ren'),'haruna','dry').time,faster.time);
});
test('zero-duration preparation and fractional finish boundaries cannot produce invalid ghost positions',()=>{
 const times=[0,2,8,3];assert.deepEqual(cumulativeTimes(times),[0,2,10,13]);
 assert.equal(progressAtTime(times,0,'yokohama'),0);assert.equal(progressAtTime(times,13+1e-9,'yokohama'),1);
 assert.equal(progressAtTime([0],1,'yokohama'),0);
 let last=0;for(let elapsed=0;elapsed<14;elapsed+=.013){const progress=progressAtTime(times,elapsed,'yokohama');assert.ok(Number.isFinite(progress)&&progress>=last&&progress<=1);last=progress;}
});
test('unlock explanations reflect the actual requirement',()=>{
 assert.equal(unlockText({unlockStreet:12,unlockRaces:0}),'Street Cred 12');
 assert.equal(unlockText({unlockStreet:0,unlockRaces:3}),'3 завершённых заезда');
});
test('seeded unusual but valid road states never produce nonfinite values or mutate inputs',()=>{
 const random=generator(3080),config=configuration('evo','aki',['cooling','brakes','lsd']);
 for(let index=0;index<250;index++){
  const race=createRace(config,index%2?'rain':'dry');const state=race.player;
  state.tires=random()*100;state.heat=35+random()*165;state.focus=random()*90;state.velocity=10+random()*60;
  const snapshot=structuredClone(state),sector=sectorAt(index%8,race.weather);
  const result=simulate(config,state,sector,CARDS[0]);assert.deepEqual(state,snapshot);
  assert.ok(Number.isFinite(result.time)&&result.time>0);assert.ok(Number.isFinite(result.speed));assert.ok(result.next.tires>=0&&result.next.focus>=0);
 }
});
