import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTS,TUNING_GROUPS,CARDS,sectorAt} from '../src/data.js';
import {partFamily,partFor,hasPart,partCapabilities,SLOT_LABELS} from '../src/parts.js';
import {configuration,simulate,freshState,availableCards} from '../src/engine.js';
import {normalizeBuild,tireFactor,aeroGrip} from '../src/tuning.js';
import {newCareer,validateSave} from '../src/storage.js';
import {togglePart,setCarSetup} from '../src/garage.js';
import {exchangeEngines} from '../src/powertrain.js';
import {MOTOR_PARTS} from '../src/engine-data.js';
import {applyWorkshopPreset} from '../src/workshop.js';
import {awardRace,raceRecord} from '../src/progress.js';
import {finishRace} from './helpers.js';
const fresh=()=>({...newCareer(),money:1000000,street:60,streetPeak:60});
const balanced=CARDS.find(c=>c.id==='balanced');
const newIds=['enduranceTires','streetEcu','responseTurbo','compactOil','raceOil','brakeDucts','streetWing','trackWing','streetLip','flatFloor'];
test('six categories contain six unique choices each and every alternative has an explicit slot',()=>{
 assert.equal(PARTS.length,36);assert.equal(TUNING_GROUPS.length,6);
 const ids=TUNING_GROUPS.flatMap(g=>{assert.equal(g.parts.length,6,g.id);return g.parts;});
 assert.equal(new Set(ids).size,36);assert.deepEqual(new Set(ids),new Set(PARTS.map(p=>p.id)));
 for(const p of PARTS.filter(p=>p.family)){assert.ok(PARTS.some(base=>base.id===p.family));assert.ok(p.slot&&SLOT_LABELS[p.slot]);}
 assert.equal(partFamily('responseTurbo'),'turbo');assert.equal(partFamily('unknown'),'unknown');
 assert.equal(partFor(['compactOil'],'cooling').id,'compactOil');assert.ok(hasPart(['streetWing'],'aero'));assert.ok(!hasPart([],'aero'));
 assert.deepEqual(partCapabilities(['streetEcu','raceOil']),['streetEcu','ecu','raceOil','cooling']);
});
test('alternatives replace their own hardware, preserve receipts and wear, and do not stack',()=>{
 const groups=[['streetEcu','ecu'],['compactOil','cooling','raceOil'],['streetWing','aero','trackWing'],['streetLip','splitter']];
 for(const choices of groups){let c=fresh();
  for(const id of choices)c=togglePart(c,id);
  assert.deepEqual(c.builds.ae86,[choices.at(-1)]);for(const id of choices)assert.ok(c.purchased.ae86.includes(id));
  c.wear.ae86[choices[0]]=43;const cash=c.money;c=togglePart(c,choices[0]);assert.equal(c.money,cash);assert.equal(c.wear.ae86[choices[0]],43);
  assert.deepEqual(c.builds.ae86,[choices[0]]);assert.deepEqual(validateSave(c),c);
 }
 assert.deepEqual(normalizeBuild('s13',['responseTurbo','turbo','ecu','streetEcu']),['turbo','streetEcu']);
});
test('budget engine choices trade lower power for lower thermal and resource demand',()=>{
 const mild=configuration('s13','ren',['streetEcu','responseTurbo']),full=configuration('s13','ren',['ecu','turbo']);
 assert.ok(mild.car.power<full.car.power);assert.ok(mild.car.heatFactor<full.car.heatFactor);assert.ok(mild.car.mass<full.car.mass);assert.ok(mild.car.wearFactor<full.car.wearFactor);
 const worn=configuration('s13','ren',['streetEcu','responseTurbo'],100,{},null,{streetEcu:0,responseTurbo:0});assert.equal(worn.car.power,205);
 assert.deepEqual(configuration('ae86','ren',['responseTurbo']).parts,[]);
});
test('oil cooler choices share the equipment card and keep individual wear and thermal factors',()=>{
 const variants=['compactOil','cooling','raceOil'].map(id=>configuration('ae86','ren',[id]));
 assert.ok(variants[0].car.coolerFactor<variants[1].car.coolerFactor&&variants[1].car.coolerFactor<variants[2].car.coolerFactor);
 for(const cfg of variants)assert.ok(availableCards(cfg).some(c=>c.id==='thermal'));
 assert.equal(configuration('ae86','ren',['raceOil'],100,{},null,{raceOil:0}).car.coolerFactor,1);
 assert.ok(variants[2].car.mass>variants[0].car.mass);
 const cfg=configuration('ae86','ren'),ducts=configuration('ae86','ren',['brakeDucts']),state={...freshState(cfg),heat:160,velocity:45},s=sectorAt(0,'dry','fuji');
 assert.ok(simulate(ducts,state,s,balanced).next.heat<simulate(cfg,state,s,balanced).next.heat);
 assert.equal(ducts.car.cooling,cfg.car.cooling);assert.equal(ducts.car.coolerFactor,cfg.car.coolerFactor);
});
test('wings and front aero have distinct drag/downforce and unlock the same manual and paid controls',()=>{
 const low=configuration('ae86','ren',['streetWing']),normal=configuration('ae86','ren',['aero']),high=configuration('ae86','ren',['trackWing']);
 assert.ok(aeroGrip(low,70)<aeroGrip(normal,70)&&aeroGrip(normal,70)<aeroGrip(high,70));
 assert.ok(low.car.airResistance<normal.car.airResistance&&normal.car.airResistance<high.car.airResistance);
 assert.equal(configuration('ae86','ren',['trackWing'],100,{},null,{trackWing:0}).car.aeroGrip,0);
 const lip=configuration('ae86','ren',['streetLip']),splitter=configuration('ae86','ren',['splitter']),floor=configuration('ae86','ren',['flatFloor']);
 assert.ok(lip.car.aeroGrip<splitter.car.aeroGrip&&lip.car.airResistance<splitter.car.airResistance);assert.ok(floor.car.aeroGrip>0);
 let c=togglePart(fresh(),'streetWing');c=setCarSetup(c,{wing:80});assert.equal(c.setups.ae86.wing,80);
 const paid=applyWorkshopPreset(c,'wet',false,()=>1);assert.equal(paid.setups.ae86.wing,70);assert.deepEqual(validateSave(paid),paid);
});
test('endurance tires exchange peak grip and wet performance for rubber life',()=>{
 const street=configuration('ae86','ren',['streetTires']),endurance=configuration('ae86','ren',['enduranceTires']),soft=configuration('ae86','ren',['slicks']);
 assert.ok(tireFactor(endurance,0)>tireFactor(street,0));assert.ok(tireFactor(endurance,1)<tireFactor(street,1));assert.ok(tireFactor(endurance,0)<tireFactor(soft,0));
 const state=freshState(endurance),s=sectorAt(2,'dry','suzuka');
 assert.ok(simulate(endurance,state,s,balanced).next.tires>simulate(street,state,s,balanced).next.tires);
});
test('motor exchange carries ECU/turbo alternatives with their exact ownership and wear',()=>{
 let c=fresh();c.car='s13';c.ownedCars=['s13','ae86'];
 for(const id of ['streetEcu','responseTurbo','compactOil'])c=togglePart(c,id);
 c.wear.s13.responseTurbo=63;assert.ok(MOTOR_PARTS.includes('responseTurbo'));assert.ok(!MOTOR_PARTS.includes('compactOil'));
 const next=exchangeEngines(c,'ae86');assert.ok(next.builds.ae86.includes('responseTurbo'));assert.ok(next.purchased.ae86.includes('streetEcu'));assert.equal(next.wear.ae86.responseTurbo,63);
 assert.deepEqual(next.builds.s13,['compactOil']);assert.ok(!next.purchased.s13.includes('streetEcu'));assert.deepEqual(validateSave(next),next);
});
for(const id of newIds)test('new part completes, wears and records by its actual inventory ID / '+id,()=>{
 const car=id==='responseTurbo'?'s13':'ae86',cfg=configuration(car,'ren',[id]);
 for(const event of ['suzuka','yokohama','ebisu'])for(const weather of ['dry','rain']){
  const race=finishRace(cfg,weather,event);assert.ok(race.finished);assert.ok(Number.isFinite(race.player.time));assert.ok(race.player.tires>=0&&race.player.tires<=100);
  const career=fresh();career.car=car;career.ownedCars=[car];career.builds[car]=[id];career.purchased[car]=[id];
  const after=awardRace(career,race).career,saved=validateSave(after);assert.deepEqual(saved,after);
  assert.ok(saved.wear[car][id]<100,id+' must have its own service node');assert.deepEqual(raceRecord(race).parts,[id]);
 }
});

test('older saves keep original purchases and worn nodes while new hardware starts with separate fresh health',()=>{
 const old=fresh();old.purchased.ae86=['ecu','cooling','aero'];old.builds.ae86=[...old.purchased.ae86];old.wear.ae86.ecu=47;
 for(const car of Object.keys(old.wear))for(const id of newIds)delete old.wear[car][id];
 const loaded=validateSave(old);assert.deepEqual(loaded.builds.ae86,old.builds.ae86);assert.equal(loaded.wear.ae86.ecu,47);assert.equal(loaded.wear.ae86.streetEcu,100);
 const bought=togglePart(loaded,'streetEcu');assert.ok(!bought.builds.ae86.includes('ecu'));assert.ok(bought.purchased.ae86.includes('ecu'));assert.equal(bought.wear.ae86.ecu,47);
 const cash=bought.money,restored=togglePart(bought,'ecu');assert.equal(restored.money,cash);assert.equal(restored.wear.ae86.ecu,47);assert.ok(!restored.builds.ae86.includes('streetEcu'));
});
