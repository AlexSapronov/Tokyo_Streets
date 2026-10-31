import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,PARTS,CARDS,EVENTS,sectorAt} from '../src/data.js';
import {partReason,normalizeBuild,tireFactor,aeroGrip} from '../src/tuning.js';
import {configuration,createRace,simulate,availableCards,disabledReason,chooseAI,resolveSector,futureSectors} from '../src/engine.js';
import {selectCar,togglePart} from '../src/garage.js';
import {newCareer,validateSave} from '../src/storage.js';
import {raceClass,unlockEverything} from '../src/balance.js';
import {freshDragState,simulateDrag} from '../src/drag.js';
import {ALL_DRAG_CARDS} from '../src/drag-data.js';
import {transmissionProfile,transmission,longShiftSpeeds} from '../src/telemetry.js';
import {raceRecord,awardRace} from '../src/progress.js';
import {generator,assertState} from './helpers.js';
const cfg=configuration('ae86','ren'),card=id=>CARDS.find(c=>c.id===id),dragCard=id=>ALL_DRAG_CARDS.find(c=>c.id===id);
test('expanded fleet has ten distinct identities, all four layouts and independent transmission profiles',()=>{
 assert.equal(CARS.length,10);assert.equal(PARTS.length,16);assert.equal(new Set(CARS.map(c=>c.id)).size,10);assert.deepEqual(new Set(CARS.map(c=>c.drive)),new Set(['FR','AWD','FF','MR']));
 for(const car of CARS){const profile=transmissionProfile(configuration(car.id,'ren'));assert.ok(profile.ratios.length>=5);assert.ok(profile.redline>6500);profile.ratios[0]=999;assert.notEqual(transmissionProfile(configuration(car.id,'ren')).ratios[0],999);}
 assert.equal(transmissionProfile(configuration('supra','ren')).ratios.length,6);assert.equal(transmission(configuration('supra','ren'),350).gear,6);
});
test('legacy three-car save migrates without changing money, ownership, conditions or installed hardware',()=>{
 const legacy={...newCareer(),money:54321,ownedCars:['ae86','chaser'],car:'chaser',builds:{ae86:['cooling'],chaser:['lsd']},purchased:{ae86:['cooling'],chaser:['lsd']},condition:{ae86:80,chaser:70,evo:95}};
 const loaded=validateSave(legacy);assert.equal(loaded.money,54321);assert.deepEqual(loaded.ownedCars,['ae86','chaser']);assert.deepEqual(loaded.builds.chaser,['lsd']);assert.equal(loaded.condition.chaser,70);
 for(const car of CARS.slice(3)){assert.deepEqual(loaded.builds[car.id],[]);assert.deepEqual(loaded.purchased[car.id],[]);assert.equal(loaded.condition[car.id],100);}
 assert.deepEqual(validateSave(loaded),loaded);
});
test('hardware compatibility rejects impossible purchases atomically and normalizes impossible builds',()=>{
 const career={...newCareer(),money:1e6},copy=structuredClone(career);
 assert.match(partReason('missing','ecu'),/Неизвест/);assert.match(partReason('ae86','unknown'),/Неизвест/);
 assert.match(partReason('ae86','turbo'),/турбо/);assert.match(partReason('chaser','cams'),/атмосфер/);assert.match(partReason('ek9','angle'),/FR/);assert.match(partReason('evo','angle'),/FR/);
 for(const [car,id] of [['ae86','turbo'],['chaser','cams'],['ek9','angle']])assert.throws(()=>togglePart({...career,car},id),/Только/);
 assert.deepEqual(career,copy);assert.equal(partReason('nsx','angle'),'');assert.equal(partReason('rx7','turbo'),'');
 assert.deepEqual(configuration('ae86','ren',['turbo','cams','ecu','unknown']).parts,['cams','ecu']);
});
test('tires and final drives replace their slot but retain purchased hardware for free switching',()=>{
 let career={...newCareer(),money:1e6};
 career=togglePart(career,'tires');career=togglePart(career,'wetTires');assert.deepEqual(career.builds.ae86,['wetTires']);assert.ok(career.purchased.ae86.includes('tires'));
 const cash=career.money;career=togglePart(career,'tires');assert.equal(career.money,cash);assert.deepEqual(career.builds.ae86,['tires']);
 career=togglePart(career,'shortFinal');career=togglePart(career,'longFinal');assert.ok(!career.builds.ae86.includes('shortFinal'));assert.ok(career.builds.ae86.includes('longFinal'));
 assert.deepEqual(normalizeBuild('ae86',['tires','wetTires','slicks','shortFinal','longFinal','ecu','ecu']),['slicks','longFinal','ecu']);
 assert.deepEqual(validateSave(career),career);
 const corrupted={...career,builds:{...career.builds,ae86:['tires','wetTires','shortFinal','longFinal']}};const repaired=validateSave(corrupted);assert.deepEqual(repaired.builds.ae86,['wetTires','longFinal']);
});
test('rain tires and slicks have opposite physical effects on dry and wet corners',()=>{
 const state={...createRace(cfg).player,velocity:30},base=configuration('ae86','ren'),wet=configuration('ae86','ren',['wetTires']),slick=configuration('ae86','ren',['slicks']);
 for(const weather of ['dry','rain']){
  const sector=sectorAt(2,weather),normal=simulate(base,state,sector,card('balanced')).time;
  if(weather==='dry'){assert.ok(simulate(wet,state,sector,card('balanced')).time>normal);assert.ok(simulate(slick,state,sector,card('balanced')).time<normal);}
  else{assert.ok(simulate(wet,state,sector,card('balanced')).time<normal);assert.ok(simulate(slick,state,sector,card('balanced')).time>normal);}
 }
 assert.equal(tireFactor(base,0),1);assert.equal(tireFactor(slick,1),.7);
});
test('engine tuning changes delivered acceleration, heat, focus cost and class without mutating factory data',()=>{
 const base=configuration('s13','ren'),boost=configuration('s13','ren',['ecu','turbo']),state={...freshDragState(base),velocity:30},sector=sectorAt(2,'dry','yokohama');
 const a=simulateDrag(base,state,sector,dragCard('drag-band')),b=simulateDrag(boost,state,sector,dragCard('drag-band'));
 assert.ok(b.time<a.time);assert.ok(b.next.heat>a.next.heat);assert.ok(b.next.tires<a.next.tires);assert.ok(b.next.focus<a.next.focus);assert.equal(raceClass(boost).id,'expert');assert.equal(CARS.find(c=>c.id==='s13').power,205);
 assert.ok(boost.car.mass>base.car.mass);assert.ok(boost.car.power>base.car.power);
});
test('final drives change actual RPM, shift points and launch execution, with independent prep gearing',()=>{
 const base=configuration('ae86','ren'),short=configuration('ae86','ren',['shortFinal']),long=configuration('ae86','ren',['longFinal']);
 const d={longFormat:true,forceTop:true,shiftStyle:'band',gearing:1};
 assert.ok(transmission(short,140,'drag',d).rpm>transmission(base,140,'drag',d).rpm);assert.ok(transmission(long,140,'drag',d).rpm<transmission(base,140,'drag',d).rpm);
 assert.ok(longShiftSpeeds(short)[0]<longShiftSpeeds(base)[0]);assert.ok(longShiftSpeeds(long)[0]>longShiftSpeeds(base)[0]);
 let a=createRace(short,'dry','yokohama-mile',null,42),b=createRace(long,'dry','yokohama-mile',null,42);
 for(const id of ['drag-warm','drag-soft']){a=resolveSector(a,id);b=resolveSector(b,id);}assert.notEqual(a.player.time,b.player.time);
 const prep=simulateDrag(short,freshDragState(short),sectorAt(0,'dry','yokohama-mile'),dragCard('drag-longgear'));assert.equal(prep.next.drag.gearing,.88);assert.equal(short.car.finalRatio,1.12);
});
test('aero helps fast corners but increases straight-line resistance; clutch buys shift time with wear and heat',()=>{
 const wing=configuration('ae86','ren',['aero']),state={...createRace(cfg).player,velocity:55};
 assert.equal(aeroGrip(wing,0),1);assert.ok(aeroGrip(wing,55)>1);
 const corner={...sectorAt(2,'dry'),radius:120};assert.ok(simulate(wing,state,corner,card('balanced')).time<simulate(cfg,state,corner,card('balanced')).time);
 assert.ok(simulate(wing,state,sectorAt(0,'dry'),card('balanced')).time>simulate(cfg,state,sectorAt(0,'dry'),card('balanced')).time);
 const clutch=configuration('ae86','ren',['clutch']),drag={...freshDragState(cfg),velocity:30},sector=sectorAt(2,'dry','yokohama');
 const a=simulateDrag(cfg,drag,sector,dragCard('drag-band')),b=simulateDrag(clutch,drag,sector,dragCard('drag-band'));assert.ok(b.time<a.time);assert.ok(b.next.heat>a.next.heat);assert.ok(b.next.tires<a.next.tires);
});
test('cams trade low-end delivery for peak output and drift geometry changes actual angle response',()=>{
 const cams=configuration('ae86','ren',['cams']),low={...createRace(cfg).player,velocity:5},fast={...low,velocity:40},sector=sectorAt(0,'dry');
 assert.ok(simulate(cams,low,sector,card('balanced')).time>simulate(cfg,low,sector,card('balanced')).time);assert.ok(simulate(cams,fast,sector,card('balanced')).time<simulate(cfg,fast,sector,card('balanced')).time);
 const setup=configuration('ae86','ren',['angle']),race=createRace(cfg,'dry','ebisu'),clip=sectorAt(0,'dry','ebisu'),action=availableCards(cfg,'drift').find(c=>c.phase==='init');
 assert.ok(simulate(setup,race.player,clip,action).clip.angleDegrees>simulate(cfg,race.player,clip,action).clip.angleDegrees);
 const ff=configuration('ek9','ren'),mr=configuration('nsx','ren');assert.ok(simulate(ff,createRace(ff,'dry','ebisu').player,clip,action).clip.continuity<simulate(mr,createRace(mr,'dry','ebisu').player,clip,action).clip.continuity);
});
for(const car of CARS)test(`expanded tuning cross-mode saves and bounded physics / ${car.id}`,()=>{
 const random=generator(81);
 for(let recipe=0;recipe<2;recipe++){
  const installed=PARTS.filter(()=>random()>.45).map(p=>p.id),config=configuration(car.id,'ren',installed);
  for(const event of EVENTS){
   let race=createRace(config,'rain',event.id,'expanded-'+car.id+'-'+event.id+'-'+recipe,42);
   while(!race.finished){const sector=sectorAt(race.index,'rain',event.id),choice=chooseAI(config,race.player,sector,race.opponent.dnf?Infinity:race.player.time-race.opponent.time,futureSectors(race));assert.equal(disabledReason(choice.card,sector,race.player,config,race.opponent.dnf?Infinity:race.player.time-race.opponent.time),'');race=resolveSector(race,choice.card.id);}
   assertState(assert,race);const award=awardRace(newCareer(),race),loaded=validateSave(award.career);
   if(award.isBest){assert.deepEqual(loaded.bests[0],raceRecord(race));}
  }
 }
});
test('debug unlock only grants compatible hardware and purchases remain independent for all cars',()=>{
 const career=unlockEverything(newCareer());assert.deepEqual(validateSave(career),career);
 for(const car of CARS){assert.ok(career.purchased[car.id].every(id=>!partReason(car.id,id)));assert.deepEqual(career.builds[car.id],[]);}
 const bought=togglePart(selectCar(career,'rx7'),'turbo');assert.deepEqual(bought.builds.rx7,['turbo']);assert.deepEqual(bought.builds.s13,[]);
});
