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

test('all garage vehicles get their own correct high-definition artwork',()=>{
 assert.deepEqual([...GARAGE_ART_IDS],["ae86","mx5","s13","rx7","evo","chaser","r32","r34","supra","ek9","nsx"]);
 assert.equal(new Set(GARAGE_ART_IDS).size,CARS.length);
 for(const car of CARS){
   const html=garageArtworkHTML(car);
   assert.match(html,new RegExp('garage-render-'+car.id));
   assert.match(html,/role="img"/);
   assert.match(html,/aria-label="/);
   assert.ok(!html.includes('<svg'),car.id+' should not use the old SVG');
 }
 assert.ok(!garageArtworkHTML(CARS.find(car=>car.id==='r32')).includes('garage-render-r34'));
 const escaped=garageArtworkHTML({...CARS[0],name:'<unsafe>'});
 assert.match(escaped,/&lt;unsafe&gt;/);assert.ok(!escaped.includes('<unsafe>'));
});

test('every car portrait is a separate 960×720 WebP with enough resolution for 2× previews',()=>{
 for (const id of GARAGE_ART_IDS){
  const asset=readFileSync(new URL('../assets/garage-hd/'+id+'.webp',import.meta.url));
  assert.ok(asset.length>30000&&asset.length<250000,id+' size');
  assert.equal(asset.toString('ascii',0,4),'RIFF',id);
  assert.equal(asset.toString('ascii',8,12),'WEBP',id);
  assert.equal(asset.toString('ascii',12,16),'VP8X',id);
  assert.equal(asset.readUIntLE(24,3)+1,960,id+' image width');
  assert.equal(asset.readUIntLE(27,3)+1,720,id+' image height');
 }
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 for(const id of GARAGE_ART_IDS)assert.ok(css.includes('assets/garage-hd/'+id+'.webp'),id+' CSS');
 assert.ok(!css.includes('background-image:url("assets/garage-cars-v1.webp")'));
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

test('every model has a unique high-resolution image instead of a vector fallback',()=>{
 const htmls=CARS.map(car=>garageArtworkHTML(car));
 assert.ok(htmls.every(html=>html.includes('garage-render')&&!html.includes('<svg')));
 assert.equal(htmls.length,11);
});
