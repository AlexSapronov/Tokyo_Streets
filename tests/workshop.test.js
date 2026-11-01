import test from 'node:test';
import assert from 'node:assert/strict';
import {newCareer,validateSave} from '../src/storage.js';
import {togglePart,serviceCost,setCarSetup} from '../src/garage.js';
import {partReputation,partAccessReason,tuningReputation,engineAccessReason,WORKSHOP_PRESETS,presetQuote,applyWorkshopPreset} from '../src/workshop.js';
import {workshopHTML} from '../src/workshop-view.js';
import {SETUP_FIELDS,normalizeSetup} from '../src/setup.js';
import {PARTS,getEvent} from '../src/data.js';
import {unlocked} from '../src/progress.js';
const prepared=()=>({...newCareer(),money:100000,street:60,streetPeak:60,official:0});
test('all parts unlock from Street or Official reputation, with atomic purchase checks',()=>{
 for(const part of PARTS){const c=newCareer();c.money=100000;c.car=part.turboOnly?'chaser':'ae86';c.ownedCars=['ae86','chaser'];
  const need=partReputation(part.id);assert.ok(need>0);assert.ok(partAccessReason(c,part.id));assert.throws(()=>togglePart(c,part.id),/репутации/);
  c.official=need;const bought=togglePart(c,part.id);assert.ok(bought.purchased[c.car].includes(part.id));
  bought.official=0;bought.street=0;assert.equal(partAccessReason(bought,part.id),'');assert.ok(togglePart(bought,part.id));
 }
 const c=prepared();c.team.founded=false;c.operations.staff.engineer=0;assert.equal(engineAccessReason(c,'w16'),'');
 assert.ok(engineAccessReason(newCareer(),'1uz'));assert.ok(engineAccessReason(newCareer(),'missing'));
});
test('paid setup changes actual installed-car settings, charges once per attempt and preserves purchases',()=>{
 const c=prepared(),before=structuredClone(c),q=presetQuote(c,'wet');const next=applyWorkshopPreset(c,'wet',false,()=>1);
 assert.deepEqual(c,before);assert.equal(next.money,c.money-q.money);assert.equal(next.street,c.street-q.street);assert.equal(next.streetPeak,60);
 assert.equal(next.setups.ae86.pressure,2.05);assert.equal(next.setups.ae86.brakeBias,64);assert.deepEqual(next.purchased,c.purchased);assert.deepEqual(next.builds,c.builds);
 assert.equal(next.setups.ae86.springRate,100);assert.equal(next.setups.ae86.wing,50);assert.equal(next.lastWorkshop.quality,1);
 assert.deepEqual(validateSave(next),next);assert.equal(tuningReputation(next),60);assert.ok(unlocked(getEvent('akagi'),next));
 const repeat=applyWorkshopPreset(next,'wet',false,()=>0);assert.equal(repeat.money,next.money-q.money);assert.equal(repeat.street,next.street-q.street);assert.equal(repeat.lastWorkshop.quality,.85);
});
test('85 percent workmanship produces bounded, valid deviations and each paid reroll is stored',()=>{
 let c=prepared();c.builds.ae86=['gearbox','suspension','aero'];c.purchased.ae86=[...c.builds.ae86];
 for(const p of WORKSHOP_PRESETS){const next=applyWorkshopPreset(c,p.id,false,()=>0);assert.equal(next.lastWorkshop.quality,.85);assert.notDeepEqual(next.setups.ae86,applyWorkshopPreset(c,p.id,false,()=>1).setups.ae86);
  assert.deepEqual(normalizeSetup(next.builds.ae86,next.setups.ae86),next.setups.ae86);
  for(const field of SETUP_FIELDS)assert.ok(next.setups.ae86[field.key]>=field.min&&next.setups.ae86[field.key]<=field.max);
  const reroll=applyWorkshopPreset(next,p.id,false,()=>.5);assert.ok(reroll.money<next.money&&reroll.street<next.street);assert.equal(reroll.lastWorkshop.quality,.925);
 }
});
test('insufficient funds, reputation, in-race edits and invalid random draws cannot partially charge',()=>{
 for(const patch of [{money:0},{street:0}]){const c={...prepared(),...patch},copy=structuredClone(c);assert.throws(()=>applyWorkshopPreset(c,'wet'));assert.deepEqual(c,copy);}
 const c=prepared(),copy=structuredClone(c);assert.throws(()=>applyWorkshopPreset(c,'wet',true));assert.throws(()=>applyWorkshopPreset(c,'bad'));assert.throws(()=>applyWorkshopPreset(c,'wet',false,()=>NaN));assert.throws(()=>applyWorkshopPreset(c,'wet',false,()=>2));assert.deepEqual(c,copy);
});
test('manual setup remains free and reputation spending never re-locks earned workshop access',()=>{
 const c=prepared();c.streetPeak=0;c.street=12;const next=applyWorkshopPreset(c,'wet',false,()=>1);assert.equal(next.street,10);assert.equal(next.streetPeak,12);assert.equal(partAccessReason(next,'brakes'),'');
 const manual=setCarSetup(next,{pressure:2.5});assert.equal(manual.street,next.street);assert.equal(manual.money,next.money);
 assert.equal(engineAccessReason({...c,street:0,streetPeak:36},'1uz'),'');assert.ok(engineAccessReason({...c,street:59,streetPeak:59},'w16'));
});
test('workshop reveals only price and mode, including when the current setup matches its hidden target',()=>{
 const c=prepared(),html=workshopHTML(c);for(const p of WORKSHOP_PRESETS)assert.ok(html.includes('data-workshop-preset="'+p.id+'"'));
 assert.match(html,/85–100%/);assert.match(html,/−2 Street Cred/);assert.doesNotMatch(html,/ориентир|<li>|Уже настроено|Параметры уже совпадают/);
 assert.equal(presetQuote(c,'wet').setup,undefined);assert.equal(presetQuote(c,'wet').changes,undefined);
 const perfect=applyWorkshopPreset(c,'wet',false,()=>1);perfect.money=c.money;perfect.street=c.street;perfect.lastWorkshop=null;
 assert.equal(workshopHTML(perfect),html);assert.match(workshopHTML(c,true),/disabled/);
 const next=applyWorkshopPreset(c,'dry',false,()=>.5);assert.match(workshopHTML(next),/93% качества/);
 assert.match(workshopHTML({...c,money:0}),/Недостаточно денег/);
});
test('legacy support purchases and current part inventory survive migration without discounts',()=>{
 const c=prepared();c.operations.staff.mechanic=2;c.team.founded=true;c.purchased.ae86=['slicks'];c.builds.ae86=['slicks'];c.wear.ae86.slicks=70;
 const old=structuredClone(c);delete old.streetPeak;delete old.lastWorkshop;const saved=validateSave(old);
 assert.equal(saved.streetPeak,60);assert.equal(saved.wear.ae86.slicks,70);assert.deepEqual(saved.purchased.ae86,['slicks']);
 const plain=structuredClone(saved);plain.operations.staff.mechanic=0;assert.equal(serviceCost(saved),serviceCost(plain));
 assert.equal(validateSave({...c,lastWorkshop:{carId:'bad',profile:'wet',quality:1}}).lastWorkshop,null);
 assert.equal(validateSave({...c,lastWorkshop:{carId:'ae86',profile:'wet',quality:.5}}).lastWorkshop,null);
});

test('workshop receipt stores actual paid parameters and marks later edits instead of advertising old quality as current',()=>{
 const c=prepared(),paid=applyWorkshopPreset(c,'wet',false,()=>0),receipt=structuredClone(paid.lastWorkshop);
 assert.deepEqual(receipt.before,c.setups.ae86);assert.deepEqual(receipt.after,paid.setups.ae86);
 assert.equal(receipt.paidMoney,1200);assert.equal(receipt.paidStreet,2);assert.equal(receipt.engineId,'4age');assert.deepEqual(receipt.parts,[]);
 assert.deepEqual(validateSave(paid),paid);
 const html=workshopHTML(paid);assert.match(html,/Дождь · 85%/);assert.match(html,/Было/);assert.match(html,/Получено/);assert.match(html,/Этот результат сейчас установлен/);
 assert.doesNotMatch(html,/ориентир|Уже настроено/);
 const edited=setCarSetup(paid,{pressure:2.6});assert.deepEqual(edited.lastWorkshop,receipt);assert.match(workshopHTML(edited),/сборка или настройки изменены/);
 const hardware=togglePart(paid,'streetTires');assert.match(workshopHTML(hardware),/сборка или настройки изменены/);
 const swapped=structuredClone(paid);swapped.engines.installed.ae86.engineId='1uz';assert.match(workshopHTML(swapped),/сборка или настройки изменены/);
 const other=structuredClone(paid);other.car='s13';assert.doesNotMatch(workshopHTML(other),/Последняя работа:/);
});
test('legacy or corrupted receipt details never invent a paid price or parameter history',()=>{
 const paid=applyWorkshopPreset(prepared(),'dry',false,()=>1),base={carId:'ae86',profile:'dry',quality:1};
 for(const patch of [{detailVersion:2},{engineId:'missing'},{parts:null},{parts:['bogus']},{parts:['gearbox','gearbox']},{before:{pressure:100}},{after:{...paid.lastWorkshop.after,brakeBias:NaN}},{paidMoney:-1},{paidMoney:Infinity},{paidStreet:101},{paidStreet:1.5}]){
  const loaded=validateSave({...paid,lastWorkshop:{...paid.lastWorkshop,...patch}});assert.deepEqual(loaded.lastWorkshop,base);
  const html=workshopHTML(loaded);assert.match(html,/В старом сохранении нет подробностей/);assert.doesNotMatch(html,/Списано:|<th>Получено/);
 }
 const legacy=validateSave({...paid,lastWorkshop:base});assert.deepEqual(legacy.lastWorkshop,base);
 const unchanged=prepared();unchanged.setups.ae86=paid.lastWorkshop.after;
 const second=applyWorkshopPreset(unchanged,'dry',false,()=>1);assert.match(workshopHTML(second),/После округления параметры остались прежними/);
});
