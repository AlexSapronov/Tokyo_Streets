import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTS,CARS,PILOTS} from '../src/data.js';
import {newCareer,validateSave} from '../src/storage.js';
import {selectCar,togglePart,selectPilot,serviceCar,serviceCost} from '../src/garage.js';
import {configuration} from '../src/engine.js';
import {awardRace} from '../src/progress.js';
import {finishRace,generator} from './helpers.js';
for(const part of PARTS){
 test(`garage purchase/install/remove/reinstall / ${part.id}`,()=>{
  const initial=newCareer(),copy=structuredClone(initial),bought=togglePart(initial,part.id);
  assert.deepEqual(initial,copy);assert.equal(bought.money,initial.money-part.price);
  assert.deepEqual(bought.purchased.ae86,[part.id]);assert.deepEqual(bought.builds.ae86,[part.id]);
  const removed=togglePart(bought,part.id);assert.deepEqual(removed.builds.ae86,[]);assert.equal(removed.money,bought.money);
  const installed=togglePart(removed,part.id);assert.equal(installed.money,bought.money);assert.equal(installed.builds.ae86.length,1);
  assert.deepEqual(validateSave(installed),installed);
 });
}
test('buying a car charges once and each car owns its equipment separately',()=>{
 let career={...newCareer(),money:200000};
 career=selectCar(career,'chaser');assert.equal(career.money,155000);
 const once=career.money;career=selectCar(career,'chaser');assert.equal(career.money,once);
 career=togglePart(career,'brakes');assert.deepEqual(career.builds.ae86,[]);assert.deepEqual(career.builds.chaser,['brakes']);
 career=selectCar(career,'ae86');const before=career.money;career=togglePart(career,'brakes');assert.equal(career.money,before-18000);
});
test('insufficient funds and unknown IDs cannot mutate money or inventory',()=>{
 const career={...newCareer(),money:0},copy=structuredClone(career);
 assert.throws(()=>selectCar(career,'evo'),/Недостаточно/);assert.throws(()=>togglePart(career,'tires'),/Недостаточно/);
 assert.throws(()=>selectCar(career,'invented'),/Неизвестный/);assert.throws(()=>togglePart(career,'invented'),/Неизвестная/);
 assert.throws(()=>selectPilot(career,'invented'),/Неизвестный/);assert.deepEqual(career,copy);
});
test('exact-balance purchases succeed and never create a negative wallet',()=>{
 const car=selectCar({...newCareer(),money:60000},'evo');assert.equal(car.money,0);
 const part=togglePart({...newCareer(),money:9000},'cooling');assert.equal(part.money,0);
});
test('active race blocks all four garage transactions',()=>{
 const career=newCareer(),copy=structuredClone(career);
 for(const action of [()=>selectCar(career,'chaser',true),()=>togglePart(career,'brakes',true),()=>selectPilot(career,'aki',true),()=>serviceCar(career,true)])assert.throws(action,/заезд/);
 assert.deepEqual(career,copy);
});
test('service charges the selected car only and a healthy car costs nothing',()=>{
 const career=newCareer();career.condition.ae86=60;career.condition.chaser=50;
 assert.equal(serviceCost(career),6000);
 const repaired=serviceCar(career);assert.equal(repaired.money,74000);assert.equal(repaired.condition.ae86,100);assert.equal(repaired.condition.chaser,50);
 assert.equal(serviceCar(repaired).money,repaired.money);
 const poor={...career,money:1};assert.throws(()=>serviceCar(poor),/Недостаточно/);assert.equal(poor.condition.ae86,60);
});
test('pilot switching is free and does not change the installed build',()=>{
 let career=togglePart(newCareer(),'lsd'),before=structuredClone(career);career=selectPilot(career,'yui');
 assert.equal(career.money,before.money);assert.deepEqual(career.builds,before.builds);assert.equal(career.pilot,'yui');
});
test('seeded 150-transaction campaign preserves funds, build ownership, save roundtrips and repeat guards',()=>{
 const random=generator(7800);let career=newCareer();
 for(let index=0;index<150;index++){
  const previous=structuredClone(career),choice=Math.floor(random()*5);
  try{
   if(choice===0)career=selectCar(career,CARS[Math.floor(random()*3)].id);
   if(choice===1)career=togglePart(career,PARTS[Math.floor(random()*6)].id);
   if(choice===2)career=selectPilot(career,PILOTS[Math.floor(random()*3)].id);
   if(choice===3)career=serviceCar(career);
   if(choice===4){
    const race=finishRace(configuration(career.car,career.pilot,career.builds[career.car],career.condition[career.car]),'mixed',index%2?'haruna':'yokohama',null,'campaign-'+index);
    const result=awardRace(career,race);career=result.career;
    assert.throws(()=>awardRace(validateSave(career),race),/повторно/);
   }
  }catch(error){assert.match(error.message,/Недостаточно/);assert.deepEqual(career,previous);}
  assert.ok(career.money>=0);
  for(const car of CARS){assert.ok(career.condition[car.id]>=35&&career.condition[car.id]<=100);assert.ok(career.builds[car.id].every(id=>career.purchased[car.id].includes(id)));}
  assert.deepEqual(validateSave(career),career);
 }
});
