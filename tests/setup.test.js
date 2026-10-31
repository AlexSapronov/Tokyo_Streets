import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSetup,normalizeSetup,validSetup,setupKey,SETUP_FIELDS} from '../src/setup.js';
import {setupControlsHTML} from '../src/setup-view.js';
import {newCareer,validateSave} from '../src/storage.js';
import {setCarSetup,togglePart,selectCar} from '../src/garage.js';
import {configuration,createRace,simulate,chooseAI,resolveSector,futureSectors,availableCards} from '../src/engine.js';
import {CARDS,EVENTS,sectorAt} from '../src/data.js';
import {transmissionProfile,transmission} from '../src/telemetry.js';
import {raceRecord,awardRace,recordKey,bestFor} from '../src/progress.js';
import {unlockEverything} from '../src/balance.js';
import {beginManagedRace} from '../src/manager.js';
const cfg=configuration('ae86','ren'),balanced=CARDS.find(c=>c.id==='balanced');
test('default setup preserves old configurations and repairs malformed values, limits and unlocked fields',()=>{
 assert.deepEqual(cfg.setup,defaultSetup());assert.equal(setupKey(cfg.setup),'');assert.equal(setupKey(), '');assert.equal(validSetup([],null),false);assert.equal(validSetup([],[]),false);
 const raw={pressure:99,finalDrive:1.15,springRate:130,brakeBias:0,wing:100};
 assert.deepEqual(normalizeSetup([],raw),{pressure:2.6,finalDrive:1,springRate:100,brakeBias:55,wing:50});
 assert.equal(normalizeSetup(['gearbox'],{finalDrive:Infinity}).finalDrive,1);assert.equal(normalizeSetup([],null).pressure,2.2);
 assert.equal(normalizeSetup([],{pressure:2.13}).pressure,2.15);assert.equal(validSetup([],raw),false);assert.equal(validSetup([],{...defaultSetup(),unknown:2}),false);assert.equal(validSetup([],defaultSetup()),true);
});
test('stock gearbox cannot be adjusted; installation unlocks it, fixed alternatives reset the custom ratio',()=>{
 let career={...preparedCareer(),money:1e6};const before=structuredClone(career);
 assert.throws(()=>setCarSetup(career,{finalDrive:1.1}),/коробка/);assert.deepEqual(career,before);
 career=togglePart(career,'gearbox');const cash=career.money;career=setCarSetup(career,{finalDrive:1.12});assert.equal(career.money,cash);assert.equal(career.setups.ae86.finalDrive,1.12);
 const config=configuration('ae86','ren',career.builds.ae86,100,career.setups.ae86);assert.equal(config.car.finalRatio,1.12);assert.ok(transmissionProfile(config).final>transmissionProfile(cfg).final);
 career=togglePart(career,'longFinal');assert.ok(!career.builds.ae86.includes('gearbox'));assert.equal(career.setups.ae86.finalDrive,1);assert.throws(()=>setCarSetup(career,{finalDrive:.9}),/коробка/);
});
test('spring and wing controls require installed hardware and are restored to defaults when removed',()=>{
 let career={...preparedCareer(),money:1e6};assert.throws(()=>setCarSetup(career,{springRate:120}),/подвеска/);assert.throws(()=>setCarSetup(career,{wing:100}),/антикрыло/);
 career=togglePart(togglePart(career,'suspension'),'aero');career=setCarSetup(career,{springRate:120,wing:100,pressure:2.05});
 career=togglePart(togglePart(career,'suspension'),'aero');assert.equal(career.setups.ae86.springRate,100);assert.equal(career.setups.ae86.wing,50);assert.equal(career.setups.ae86.pressure,2.05);
});
test('setup edits are atomic, free, per car, blocked during races and survive reload',()=>{
 let career={...preparedCareer(),money:200000};const before=structuredClone(career);
 for(const values of [null,{pressure:NaN},{pressure:1},{pressure:9},{unknown:2}])assert.throws(()=>setCarSetup(career,values));
 assert.throws(()=>setCarSetup(career,{pressure:2},true),/заезд/);assert.deepEqual(career,before);
 career=setCarSetup(career,{pressure:2,brakeBias:65});career=selectCar(career,'mx5');assert.equal(career.setups.mx5.pressure,2.2);assert.equal(career.setups.ae86.pressure,2);assert.deepEqual(validateSave(career),career);
 const legacy={...career};delete legacy.setups;const loaded=validateSave(legacy);assert.deepEqual(loaded.setups.ae86,defaultSetup());assert.equal(loaded.money,career.money);
});
test('pressure changes real road grip, rolling resistance and drag preparation',()=>{
 const low=configuration('ae86','ren',[],100,{pressure:2}),high=configuration('ae86','ren',[],100,{pressure:2.6}),state={...createRace(cfg).player,velocity:30},s=sectorAt(2,'rain');
 assert.ok(simulate(low,state,s,balanced).time<simulate(high,state,s,balanced).time);assert.ok(low.car.rollingFactor>high.car.rollingFactor);
 let a=createRace(low,'dry','yokohama',null,42),b=createRace(high,'dry','yokohama',null,42);a=resolveSector(a,'drag-warm');b=resolveSector(b,'drag-warm');assert.ok(a.player.drag.pressure<b.player.drag.pressure);
 a=resolveSector(a,'drag-soft');b=resolveSector(b,'drag-soft');assert.notEqual(a.player.time,b.player.time);
});
test('springs have surface-dependent grip and different actual drift response',()=>{
 const soft=configuration('ae86','ren',['suspension'],100,{springRate:90}),hard=configuration('ae86','ren',['suspension'],100,{springRate:110}),state={...createRace(cfg).player,velocity:30};
 const wet=sectorAt(2,'rain'),dry=sectorAt(2,'dry');assert.ok(simulate(soft,state,wet,balanced).time<simulate(hard,state,wet,balanced).time);assert.ok(simulate(hard,state,dry,balanced).time<simulate(soft,state,dry,balanced).time);
 const drift=createRace(soft,'dry','ebisu'),s=sectorAt(0,'dry','ebisu'),action=availableCards(soft,'drift').find(c=>c.phase==='init');assert.notEqual(simulate(soft,drift.player,s,action).clip.angleDegrees,simulate(hard,drift.player,s,action).clip.angleDegrees);
});
test('brake balance trades braking against rotation and risk; wing adjustment trades drag against fast grip',()=>{
 const rear=configuration('ae86','ren',[],100,{brakeBias:55}),front=configuration('ae86','ren',[],100,{brakeBias:70});assert.ok(front.car.brakes>rear.car.brakes);assert.ok(rear.car.driftYaw>front.car.driftYaw);assert.ok(rear.car.setupRisk>front.car.setupRisk);
 const low=configuration('ae86','ren',['aero'],100,{wing:0}),high=configuration('ae86','ren',['aero'],100,{wing:100});assert.ok(high.car.airResistance>low.car.airResistance);
 const state={...createRace(cfg).player,velocity:55},corner={...sectorAt(2,'dry'),radius:120};assert.ok(simulate(high,state,corner,balanced).time<simulate(low,state,corner,balanced).time);assert.ok(simulate(high,state,sectorAt(0,'dry'),balanced).time>simulate(low,state,sectorAt(0,'dry'),balanced).time);
 const box=configuration('ae86','ren',['gearbox'],100,{finalDrive:1.12});assert.ok(transmission(box,140,'drag',{longFormat:true,forceTop:true}).rpm>transmission(cfg,140,'drag',{longFormat:true,forceTop:true}).rpm);
});
test('tuning UI exposes stock controls, disabled hardware-dependent controls, ranges and race locks',()=>{
 const stock=setupControlsHTML(cfg);assert.equal((stock.match(/type="range"/g)||[]).length,5);
 for(const key of ['finalDrive','springRate','wing'])assert.match(stock,new RegExp(`data-setup="${key}"[^>]*disabled`));
 for(const key of ['pressure','brakeBias'])assert.ok(!new RegExp(`data-setup="${key}"[^>]*disabled`).test(stock));
 const upgraded=configuration('ae86','ren',['gearbox','suspension','aero']);assert.ok(!/type="range"[^>]*disabled/.test(setupControlsHTML(upgraded)));
 const locked=setupControlsHTML(upgraded,true);assert.equal((locked.match(/type="range"[^>]*disabled/g)||[]).length,5);assert.match(locked,/id="setup-save"[^>]*disabled/);assert.match(locked,/id="setup-defaults"[^>]*disabled/);
});
for(const event of EVENTS)test(`non-default setup survives physics, record and replay inputs / ${event.id}`,()=>{
 const setup={pressure:2.05,finalDrive:1.06,springRate:90,brakeBias:58,wing:75},parts=['gearbox','suspension','aero'],config=configuration('s13','ren',parts,100,setup);
 let race=createRace(config,'rain',event.id,'setup-'+event.id,42);
 while(!race.finished){const choice=chooseAI(config,race.player,sectorAt(race.index,'rain',event.id),race.opponent.dnf?Infinity:race.player.time-race.opponent.time,futureSectors(race));race=resolveSector(race,choice.card.id);}
 const record=raceRecord(race),award=awardRace(preparedCareer(),race),loaded=validateSave(award.career);assert.deepEqual(record.setup,setup);
 assert.notEqual(record.key,recordKey(configuration('s13','ren',parts),event.id,'rain'));
 if(award.isBest){assert.deepEqual(loaded.bests[0],record);assert.equal(bestFor(loaded,configuration('s13','ren',parts),event.id,'rain'),null);assert.equal(bestFor(loaded,config,event.id,'rain').time,record.time);}
 const replayConfig=configuration(record.carId,record.pilotId,record.parts,record.condition,record.setup);assert.deepEqual(replayConfig.setup,config.setup);
 const bad=structuredClone(record);bad.setup.finalDrive=99;assert.equal(validateSave({...preparedCareer(),bests:[bad]}).bests.length,0);
});
test('manager booking snapshots the same setup and cannot be changed by later career edits',()=>{
 let career=unlockEverything(preparedCareer());career=togglePart(career,'gearbox');career=setCarSetup(career,{pressure:2.05,finalDrive:1.12});
 const started=beginManagedRace(career,'haruna','dry','setup-managed');assert.deepEqual(started.race.config.setup,career.setups.ae86);career.setups.ae86.pressure=2.5;assert.equal(started.race.config.setup.pressure,2.05);
});

function preparedCareer(){return {...newCareer(),street:60,streetPeak:60};}
