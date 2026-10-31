import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARS} from '../src/data.js';
import {garageArtworkHTML,garageCarsByPrice,GARAGE_ART_IDS} from '../src/garage-art.js';
import {stockEngineId,getEngine} from '../src/engine-data.js';
import {configuration,createRace} from '../src/engine.js';
import {newCareer,validateSave} from '../src/storage.js';

test('garage sorts cars by actual price, including filtered drive types',()=>{
 const ordered=garageCarsByPrice(CARS);
 assert.deepEqual(ordered.map(car=>car.id),['ae86','mx5','s13','ek9','chaser','evo','rx7','r32','supra','r34','nsx']);
 assert.deepEqual(garageCarsByPrice(CARS.filter(car=>car.drive==='FR')).map(car=>car.id),['ae86','mx5','s13','chaser','rx7','supra']);
 assert.deepEqual(CARS[1].id,'chaser'); // Source ordering is not mutated.
 assert.ok(ordered.every((car,i)=>i===0||ordered[i-1].price<=car.price));
});

test('studio render mappings cover all available portraits but retain R32-specific SVG',()=>{
 assert.deepEqual([...GARAGE_ART_IDS],['ae86','mx5','s13','rx7','evo','chaser','supra','ek9','nsx','r34']);
 for (const car of CARS){
   const html=garageArtworkHTML(car);
   if(GARAGE_ART_IDS.includes(car.id)){
     assert.match(html,new RegExp('garage-render-'+car.id));
     assert.match(html,/role="img"/);
     assert.match(html,/aria-label="/);
   }else{
     assert.match(html,/<svg/);
   }
 }
 assert.ok(!garageArtworkHTML(CARS.find(car=>car.id==='r32')).includes('garage-render-r34'));
 const escaped=garageArtworkHTML({...CARS[0],name:'<unsafe>'});
 assert.match(escaped,/&lt;unsafe&gt;/);assert.ok(!escaped.includes('<unsafe>'));
});

test('single local WebP atlas is a valid, compact browser asset',()=>{
 for (const name of ['garage-cars-v1.webp','garage-cars-v2.webp']){
  const webp=readFileSync(new URL('../assets/'+name,import.meta.url));
  assert.ok(webp.length>1000&&webp.length<100000,name);
  assert.equal(webp.toString('ascii',0,4),'RIFF');
  assert.equal(webp.toString('ascii',8,12),'WEBP');
 }
});

test('R34 is a separate playable car with its own stock engine and save data',()=>{
 const r32=CARS.find(c=>c.id==='r32'),r34=CARS.find(c=>c.id==='r34');
 assert.ok(r32&&r34&&r34.price>r32.price);
 assert.equal(r34.drive,'AWD');
 assert.equal(r34.power,280);
 assert.equal(stockEngineId('r32'),'rb26');
 assert.equal(stockEngineId('r34'),'rb26r34');
 assert.match(getEngine(stockEngineId('r34')).name,/RB26DETT/);
 const build=configuration('r34','ren');
 assert.equal(build.car.id,'r34');
 assert.equal(build.car.power,280);
 const race=createRace(build,'dry','haruna','r34-test',42,'equal');
 assert.equal(race.config.car.id,'r34');
 const save=newCareer();
 assert.deepEqual(save.builds.r34,[]);
 assert.equal(save.condition.r34,100);
 const normalized=validateSave({...save,ownedCars:['ae86','r34'],car:'r34'});
 assert.equal(normalized.car,'r34');
 assert.ok(normalized.ownedCars.includes('r34'));
});

test('every car has matching artwork or a vehicle-specific SVG',()=>{
 const htmls=CARS.map(car=>garageArtworkHTML(car));
 assert.ok(htmls.every(html=>html.includes('garage-render')||html.includes('<svg')));
 assert.equal(htmls.filter(html=>html.includes('garage-render')).length,10);
 assert.match(garageArtworkHTML(CARS.find(car=>car.id==='r32')),/<svg/);
});
