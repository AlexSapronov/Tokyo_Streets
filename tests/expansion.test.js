import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,PARTS,EVENTS,TUNING_GROUPS,sectorAt,getEvent,eventLength,CARDS} from '../src/data.js';
import {ENGINES,getEngine,stockEngineId,installedEngineId,MOTOR_PARTS} from '../src/engine-data.js';
import {emptyEngines,normalizeEngines,buyEngine,installEngine,exchangeEngines,swapReason,fittingCost} from '../src/powertrain.js';
import {freshWear,emptyWear,normalizeWear,normalizeComponentWear,tireKey} from '../src/wear.js';
import {powertrainHTML,maintenanceHTML} from '../src/powertrain-view.js';
import {newCareer,validateSave} from '../src/storage.js';
import {unlockEverything,admissionReason} from '../src/balance.js';
import {hireStaff} from '../src/operations.js';
import {configuration,createRace,resolveSector,simulate,freshState} from '../src/engine.js';
import {tireFactor,aeroGrip,partReason} from '../src/tuning.js';
import {togglePart,selectCar,serviceCar,serviceCost,repairComponent,componentRepairCost,componentIds,recoveryService,recoveryNeeded} from '../src/garage.js';
import {recordKey,raceRecord,awardRace,bestFor} from '../src/progress.js';
import {savePreset,applyPreset} from '../src/presets.js';
import {transmissionProfile,normalizeTelemetry} from '../src/telemetry.js';
import {finishRace,assertState} from './helpers.js';
import {beginManagedRace,resolveManagedSector} from '../src/manager.js';
import {enterCup,prepareStage,bookCupRace,regulationReason} from '../src/championship.js';
import {saveSeries,defaultSeries} from '../src/organizer.js';
const workshop=()=>hireStaff(hireStaff(unlockEverything(newCareer()),'engineer'),'engineer');
const cfg=c=>configuration(c.car,c.pilot,c.builds[c.car],c.condition[c.car],c.setups[c.car],installedEngineId(c),c.wear[c.car]);
const swapped=(engineId='ls3')=>installEngine(buyEngine(workshop(),engineId,'crate-'+engineId),'crate-'+engineId);
const newParts=['streetTires','dragRadial','exhaust','radiator','intercooler','flywheel','pads','brace','splitter'];
test('catalog groups cover every part exactly once and the five new venues have distinct geometry',()=>{
 assert.equal(PARTS.length,26);assert.equal(new Set(TUNING_GROUPS.flatMap(g=>g.parts)).size,26);assert.equal(TUNING_GROUPS.flatMap(g=>g.parts).length,26);
 const venues=['irohazaka','hakone','wangan','nikko','meihan'].map(getEvent);assert.equal(new Set(venues.map(e=>JSON.stringify(e.anchors))).size,5);for(const e of venues){assert.ok(eventLength(e)>800);assert.ok(e.sectors.length>=8);assert.ok(e.sectors.every(s=>s.length>0&&Number.isFinite(s.slope)&&s.wet>=0));}
});
test('every street venue supports touge and drift on identical roads with separate valid judging zones',()=>{
 for(const e of EVENTS.filter(e=>e.streetVenue&&e.mode==='duel')){const drift=getEvent(e.id+'-drift');assert.equal(drift.mode,'drift');assert.equal(drift.venueId,e.id);assert.deepEqual(drift.anchors,e.anchors);assert.ok(Math.abs(eventLength(drift)-eventLength(e))<1e-6);assert.equal(drift.sectors.length,8);assert.deepEqual(drift.sectors.map(s=>s.phase),['init','hold','transition','exit','init','hold','transition','exit']);assert.notEqual(recordKey(configuration('ae86','ren'),e.id,'dry'),recordKey(configuration('ae86','ren'),drift.id,'dry'));}
});
for(const event of EVENTS.filter(e=>['irohazaka','hakone','wangan','nikko','meihan'].includes(e.id)||e.id.endsWith('-drift')))test(`new route completes, awards and replays through a save / ${event.id}`,()=>{
 for(const weather of ['dry','mixed','rain']){
  const c=workshop(),config=configuration('s13','yui',['radiator','exhaust','brace','streetTires','splitter']),r=finishRace(config,weather,event.id,null,'new-'+event.id+weather);assertState(assert,r);const out=awardRace(c,r),loaded=validateSave(out.career);assert.deepEqual(loaded,out.career);if(!r.player.dnf&&!r.player.drag?.falseStart){assert.ok(raceRecord(r).telemetry);assert.ok(bestFor(loaded,config,event.id,weather));}
 }
});
test('new tire compounds specialize dry drag, wet roads and longevity without stacking tire slots',()=>{
 const stock=configuration('ae86','ren'),street=configuration('ae86','ren',['streetTires']),radial=configuration('ae86','ren',['dragRadial']);assert.equal(tireFactor(street,0),1.05);assert.equal(tireFactor(street,1),1.06);assert.equal(street.car.wearFactor,.85);assert.equal(tireFactor(radial,0,false,'drag'),1.2);assert.equal(tireFactor(radial,0),1.03);assert.equal(tireFactor(radial,1),.72);assert.ok(radial.car.rollingFactor>stock.car.rollingFactor);
 let c=workshop();for(const id of ['streetTires','tires','dragRadial','wetTires','slicks']){c=togglePart(c,id);assert.equal(c.builds[c.car].filter(p=>PARTS.find(x=>x.id===p).slot==='tires').length,1);}assert.ok(c.purchased.ae86.includes('dragRadial'));
});
test('new hardware has actual mass, cooling, power, braking and speed-dependent aero effects',()=>{
 const base=configuration('s13','ren'),tuned=configuration('s13','ren',['exhaust','radiator','intercooler','flywheel','pads','brace','splitter']);assert.ok(tuned.car.power>base.car.power);assert.equal(tuned.car.mass,base.car.mass+11);assert.ok(tuned.car.cooling>base.car.cooling);assert.ok(tuned.car.shiftFactor<base.car.shiftFactor);assert.ok(tuned.car.brakes>base.car.brakes);assert.ok(tuned.car.lowRpmFactor<1);assert.ok(tuned.car.airResistance>base.car.airResistance);assert.ok(aeroGrip(tuned,70)>aeroGrip(tuned,10));assert.ok(partReason('ae86','intercooler'));assert.equal(partReason('ae86','intercooler','2jz'),'');
 const sector=sectorAt(1,'dry'),card=CARDS.find(c=>c.id==='late'),state=freshState(base);assert.ok(simulate(tuned,state,sector,card).next.heat<simulate(base,state,sector,card).next.heat);
});
test('engine purchase, mounting, permissions, active guards, capacity and token identity are atomic',()=>{
 const c=workshop(),copy=structuredClone(c);assert.ok(swapReason(newCareer(),'ls3'));assert.ok(swapReason(c,'missing'));assert.ok(swapReason({...c,street:0,streetPeak:0,official:0},'ls3'));assert.equal(swapReason({...c,operations:{...c.operations,staff:{engineer:0}}},'ls3'),'');
 assert.throws(()=>buyEngine(c,'missing','x'));assert.throws(()=>buyEngine(c,'1uz','',false));assert.throws(()=>buyEngine(c,'1uz','x',true));assert.throws(()=>buyEngine({...c,money:1},'ls3','x'));
 const b=buyEngine(c,'ls3','crate');assert.equal(c.money-b.money,getEngine('ls3').price);assert.throws(()=>buyEngine(b,'ls3','crate'));assert.equal(b.engines.spares.length,1);const mounted=installEngine(b,'crate');assert.equal(b.money-mounted.money,fittingCost('ls3'));assert.equal(installedEngineId(mounted),'ls3');assert.equal(mounted.engines.spares[0].engineId,'4age');assert.throws(()=>installEngine(mounted,'missing'));assert.throws(()=>installEngine(b,'crate',true));assert.throws(()=>installEngine({...b,money:0},'crate'));assert.throws(()=>exchangeEngines(c,'ae86'));assert.throws(()=>exchangeEngines(newCareer(),'s13'));assert.throws(()=>exchangeEngines(c,'s13',true));assert.deepEqual(c,copy);
 let full=c;for(let i=0;i<16;i++)full=buyEngine(full,'b6','engine-'+i);assert.throws(()=>buyEngine(full,'b6','overflow'));
});
test('exchange carries the exact purchased motor package and its wear, leaves chassis hardware in place, and cannot duplicate receipts',()=>{
 let c=workshop();c=selectCar(c,'s13');for(const p of ['ecu','turbo','intercooler','exhaust','brakes','radiator','lsd'])c=togglePart(c,p);c=togglePart(c,'exhaust');c.wear.s13.engine=67;c.wear.s13.turbo=42;c.wear.s13.brakes=51;c=selectCar(c,'ae86');c=togglePart(c,'cams');c.wear.ae86.engine=83;c.wear.ae86.cams=60;
 const before=structuredClone(c),swapped=exchangeEngines(c,'s13');assert.equal(installedEngineId(swapped),'sr20');assert.ok(swapped.builds.ae86.includes('turbo'));assert.ok(swapped.purchased.ae86.includes('exhaust'));assert.ok(!swapped.builds.ae86.includes('exhaust'));assert.ok(!swapped.purchased.s13.includes('turbo'));assert.ok(swapped.builds.s13.includes('cams'));assert.ok(swapped.builds.s13.includes('brakes'));assert.equal(swapped.wear.ae86.engine,67);assert.equal(swapped.wear.ae86.turbo,42);assert.equal(swapped.wear.s13.engine,83);assert.equal(swapped.wear.s13.cams,60);assert.equal(swapped.wear.s13.brakes,51);assert.deepEqual(c,before);assert.deepEqual(validateSave(swapped),swapped);
 const reversed=exchangeEngines(swapped,'s13');for(const id of CARS.map(c=>c.id)){assert.deepEqual([...reversed.builds[id]].sort(),[...before.builds[id]].sort());assert.deepEqual([...reversed.purchased[id]].sort(),[...before.purchased[id]].sort());}assert.deepEqual(reversed.engines,before.engines);assert.equal(reversed.wear.s13.turbo,42);
});
for(const e of ENGINES.filter(e=>!CARS.some(c=>stockEngineId(c.id)===e.id)))test(`extreme engine has finite physics, working RPM and valid snapshot in every discipline / ${e.id}`,()=>{
 let c=swapped(e.id);const config=cfg(c);assert.equal(config.car.engine,e.name);assert.equal(transmissionProfile(config).redline,e.redline);assert.equal(config.car.mass,940+e.mass-getEngine('4age').mass+(e.extreme?35:12));
 for(const eventId of ['haruna','yokohama','yokohama-mile','meihan']){const race=finishRace(config,'dry',eventId,null,e.id+eventId);assertState(assert,race);const out=awardRace(c,race),loaded=validateSave(out.career);assert.deepEqual(loaded,out.career);assert.equal(raceRecord(race).engineId,e.id);if(out.isBest)assert.equal(loaded.bests[0].engineId,e.id);}
 assert.notEqual(recordKey(config,'haruna','dry'),recordKey(configuration('ae86','ren'),'haruna','dry'));
});
test('swapped engines persist in presets, manager and championship configuration without bypassing regulations',()=>{
 let c=swapped('1uz');c=savePreset(c,'V8');assert.equal(c.presets.ae86[0].engineId,'1uz');c=installEngine(c,'factory-ae86');assert.throws(()=>applyPreset(c,0));c=installEngine(c,'crate-1uz');assert.ok(applyPreset(c,0));
 const manager=beginManagedRace(c,'haruna','dry','manager-v8');assert.equal(manager.race.config.engineId,'1uz');assert.equal(manager.race.config.car.engine,getEngine('1uz').name);assert.throws(()=>enterCup(c,'club','too-much-power'));
 c=saveSeries(c,{...defaultSeries(),maxPower:400},'custom-swap');c=prepareStage(enterCup(c,'custom-swap','v8-cup'));assert.equal(bookCupRace(c,'v8-stage').race.config.engineId,'1uz');assert.ok(regulationReason(cfg(swapped('w16')),{maxPower:500,drives:['FR'],naOnly:false}));
});
test('wear lowers individual engine, tires, brakes, suspension, transmission and purchased hardware performance',()=>{
 const healthy=configuration('s13','ren',['ecu','brakes','suspension','radiator','lsd','aero','angle','gearbox']),w=freshWear();for(const id of Object.keys(w))w[id]=20;const worn=configuration('s13','ren',healthy.parts,100,{},null,w);assert.ok(worn.car.power<healthy.car.power);assert.ok(worn.car.brakes<healthy.car.brakes);assert.ok(worn.car.grip<healthy.car.grip);assert.ok(worn.car.shiftFactor>healthy.car.shiftFactor);assert.ok(worn.car.cooling<healthy.car.cooling);assert.ok(worn.car.driftPrecision<healthy.car.driftPrecision);assert.ok(worn.car.coolerFactor<healthy.car.coolerFactor);assert.ok(worn.car.partLsdHealth<1);assert.equal(createRace(worn).player.tires,20);assert.ok(aeroGrip(worn,60)<aeroGrip(healthy,60));
 const sector=sectorAt(1,'dry'),card=CARDS[0];assert.ok(simulate(worn,freshState(worn),sector,card).time>simulate(healthy,freshState(healthy),sector,card).time);
});
test('race wear persists per component, follows actual starting tire health and never heals when toggled',()=>{
 let c=workshop();c=togglePart(togglePart(togglePart(c,'streetTires'),'ecu'),'radiator');c.wear.ae86.streetTires=65;c.wear.ae86.engine=80;const config=cfg(c),r=finishRace(config,'dry','haruna',null,'wear');assert.equal(createRace(config).player.tires,65);const out=awardRace(c,r);assert.ok(out.career.wear.ae86.engine<80);assert.notEqual(out.career.wear.ae86.ecu,out.career.wear.ae86.radiator);assert.equal(out.career.wear.ae86.streetTires,r.player.tires);assert.equal(out.career.wear.ae86.stockTires,100);assert.ok(out.career.wear.ae86.stockBrakes<100);assert.ok(out.career.wear.ae86.transmission<100);assert.deepEqual(validateSave(out.career),out.career);
 const unequipped=togglePart(out.career,'streetTires'),equipped=togglePart(unequipped,'streetTires');assert.equal(equipped.wear.ae86.streetTires,out.career.wear.ae86.streetTires);assert.equal(cfg(equipped).tireCondition,r.player.tires);
 const rec=raceRecord(r);assert.equal(rec.wear.engine,80);assert.equal(validateSave({...c,bests:[rec]}).bests[0].wear.streetTires,65);
});
test('individual repair, full service and emergency credit repair affect only requested components',()=>{
 let c=workshop();c=togglePart(c,'ecu');c.wear.ae86.engine=20;c.wear.ae86.ecu=35;c.wear.ae86.stockTires=8;assert.ok(admissionReason(c,'haruna'));assert.ok(recoveryNeeded(c));assert.ok(componentIds(c).includes('ecu'));const price=componentRepairCost(c,'engine'),one=repairComponent(c,'engine');assert.equal(c.money-one.money,price);assert.equal(one.wear.ae86.engine,100);assert.equal(one.wear.ae86.ecu,35);assert.throws(()=>repairComponent(c,'turbo'));assert.throws(()=>repairComponent(c,'engine',true));assert.throws(()=>repairComponent({...c,money:0},'engine'));
 const full=serviceCar(c);assert.equal(c.money-full.money,serviceCost(c));assert.ok(componentIds(full).every(id=>full.wear.ae86[id]===100));const emergency=recoveryService({...c,money:0});assert.equal(emergency.wear.ae86.engine,60);assert.equal(emergency.wear.ae86.stockTires,60);assert.equal(emergency.wear.ae86.ecu,35);assert.ok(emergency.repairDebt>0);assert.equal(admissionReason(emergency,'haruna'),'');assert.equal(emergency.condition.ae86,100);
});
test('legacy saves migrate to factory motors and healthy components; malformed assemblies cannot duplicate an engine',()=>{
 const c=newCareer();delete c.engines;delete c.wear;const migrated=validateSave(c);assert.deepEqual(migrated.engines,emptyEngines());assert.deepEqual(migrated.wear,emptyWear());assert.equal(normalizeComponentWear({engine:-1,stockTires:NaN}).engine,0);assert.equal(normalizeWear({ae86:{engine:150}}).ae86.engine,100);
 const raw={installed:{ae86:{instanceId:'factory-chaser',engineId:'ls3'},chaser:{instanceId:'factory-chaser',engineId:'2jz'}},spares:[{instanceId:'factory-chaser',engineId:'w16'},{instanceId:'spare',engineId:'bad'},{instanceId:'valid',engineId:'ls3',parts:['cams','turbo','ecu'],purchased:['cams','turbo','ecu'],wear:{engine:42}}]};const n=normalizeEngines(raw);assert.equal(new Set(Object.values(n.installed).map(e=>e.instanceId)).size,CARS.length);assert.equal(n.spares.length,1);assert.deepEqual(n.spares[0].parts,['cams','ecu']);assert.equal(n.spares[0].wear.engine,42);
 const good=swapped('om606'),bad=structuredClone(good);bad.bests=[{engineId:'missing'}];assert.deepEqual(validateSave(bad).bests,[]);assert.ok(normalizeTelemetry([{speed:510,rpm:6500,gear:6,coolant:90,oil:100,brakes:50,tireTemp:70,tires:90,focus:100}],1));
});
test('workshop views show motor transfer contents, warehouse health, repair prices and race locks',()=>{
 let c=swapped('ls3');assert.match(powertrainHTML(c,true),/DIESEL/);assert.match(powertrainHTML(c,true),/W16/);assert.match(powertrainHTML(c,true),/disabled/);assert.match(powertrainHTML(c),/Обменять/);c.wear.ae86.engine=40;assert.match(maintenanceHTML(c),/40.0%/);assert.match(maintenanceHTML(c,true),/disabled/);assert.match(maintenanceHTML(c),/До 100%/);
});
test('a removed worn engine retains its installed and spare purchased parts on the shelf and when refitted',()=>{
 let c=workshop();for(const id of ['ecu','cams','exhaust'])c=togglePart(c,id);c=togglePart(c,'exhaust');c.wear.ae86.engine=57;c.wear.ae86.cams=44;c.wear.ae86.exhaust=72;
 c=installEngine(buyEngine(c,'om606','diesel'),'diesel');const old=c.engines.spares.find(e=>e.instanceId==='factory-ae86');assert.equal(old.wear.engine,57);assert.equal(old.wear.cams,44);assert.equal(old.wear.exhaust,72);assert.ok(old.purchased.includes('exhaust'));assert.ok(!old.parts.includes('exhaust'));assert.match(powertrainHTML(c),/Моторные детали/);assert.deepEqual(validateSave(c),c);
 c=installEngine(c,'factory-ae86');assert.equal(c.wear.ae86.engine,57);assert.equal(c.wear.ae86.cams,44);assert.ok(c.builds.ae86.includes('cams'));assert.ok(c.purchased.ae86.includes('exhaust'));assert.equal(c.engines.spares[0].engineId,'om606');assert.deepEqual(validateSave(c),c);
 c=savePreset(c,'worn');const restored=applyPreset(c,0);assert.deepEqual(restored.wear,c.wear);
});
