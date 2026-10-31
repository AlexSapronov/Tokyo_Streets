import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARS} from '../src/data.js';
import {garageArtworkHTML,garageCarsByPrice,GARAGE_ART_IDS} from '../src/garage-art.js';

test('garage sorts cars by actual price, including filtered drive types',()=>{
 const ordered=garageCarsByPrice(CARS);
 assert.deepEqual(ordered.map(car=>car.id),['ae86','mx5','s13','ek9','chaser','evo','rx7','r32','supra','nsx']);
 assert.deepEqual(garageCarsByPrice(CARS.filter(car=>car.drive==='FR')).map(car=>car.id),['ae86','mx5','s13','chaser','rx7','supra']);
 assert.deepEqual(CARS[1].id,'chaser'); // Source ordering is not mutated.
 assert.ok(ordered.every((car,i)=>i===0||ordered[i-1].price<=car.price));
});

test('studio render mappings only use the correct model and keep SVG for the others',()=>{
 assert.deepEqual([...GARAGE_ART_IDS],['ae86','mx5','s13','rx7','evo']);
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
 const webp=readFileSync(new URL('../assets/garage-cars-v1.webp',import.meta.url));
 assert.ok(webp.length>1000&&webp.length<100000);
 assert.equal(webp.toString('ascii',0,4),'RIFF');
 assert.equal(webp.toString('ascii',8,12),'WEBP');
});
