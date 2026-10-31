import test from 'node:test';
import assert from 'node:assert/strict';
import {savePreset,applyPreset,deletePreset,normalizePresets,PRESET_LIMIT} from '../src/presets.js';
import {newCareer,validateSave} from '../src/storage.js';
import {togglePart,setCarSetup,selectCar} from '../src/garage.js';
import {unlockEverything} from '../src/balance.js';
import {presetsHTML,escapeHTML} from '../src/career-view.js';
test('presets capture paid parts and setup, apply without charging, and remain independent per car',()=>{
 let c=unlockEverything(newCareer());c=togglePart(togglePart(c,'gearbox'),'suspension');c=setCarSetup(c,{pressure:2.05,finalDrive:1.1,springRate:90});c=savePreset(c,'Дождь');const before=structuredClone(c),cash=c.money;
 c=togglePart(c,'gearbox');c=setCarSetup(c,{pressure:2.5});c=applyPreset(c,0);assert.equal(c.money,cash);assert.deepEqual(c.builds.ae86,before.builds.ae86);assert.deepEqual(c.setups.ae86,before.setups.ae86);
 c=selectCar(c,'s13');assert.equal(c.presets.s13.length,0);assert.equal(c.presets.ae86.length,1);assert.deepEqual(validateSave(c),c);
 c=selectCar(c,'ae86');c=setCarSetup(c,{pressure:2.3});c=savePreset(c,'Дождь');assert.equal(c.presets.ae86.length,1);assert.equal(c.presets.ae86[0].setup.pressure,2.3);assert.equal(before.presets.ae86[0].setup.pressure,2.05);
});
test('preset limits, missing entries, invalid names and active-race guards are atomic',()=>{
 let c=newCareer();for(let i=0;i<PRESET_LIMIT;i++)c=savePreset(c,'Вариант '+i);const copy=structuredClone(c);
 for(const name of ['',null,' '.repeat(5),'x'.repeat(33),'Седьмой'])assert.throws(()=>savePreset(c,name));
 for(const action of [()=>savePreset(c,'x',true),()=>applyPreset(c,0,true),()=>deletePreset(c,0,true)])assert.throws(action,/заезд/);
 for(const index of [-1,6,1.5,'0']){assert.throws(()=>applyPreset(c,index));assert.throws(()=>deletePreset(c,index));}
 assert.deepEqual(c,copy);assert.equal(deletePreset(c,0).presets.ae86.length,5);
});
test('corrupt, duplicate, incompatible and unpaid preset records are dropped without buying parts',()=>{
 const c=savePreset(newCareer(),'База'),base=c.presets.ae86[0];
 const raw=[null,{...base,name:''},{...base,name:'x'.repeat(33)},{...base,name:'Bad',parts:['turbo']},{...base,name:'Unknown',parts:['unknown']},{...base,name:'NoSetup',setup:null},base,base];
 assert.deepEqual(normalizePresets('ae86',raw,[]),[base]);assert.deepEqual(normalizePresets('ae86',undefined,[]),[]);
 const corrupt=structuredClone(c);corrupt.presets.ae86[0].parts=['ecu'];assert.throws(()=>applyPreset(corrupt,0),/некупленные/);
 const legacy={...newCareer()};delete legacy.presets;assert.deepEqual(validateSave(legacy).presets,newCareer().presets);
});
test('preset names are rendered as text and all actions are locked during a race',()=>{
 const c=savePreset(newCareer(),'<img src=x onerror=1>');const html=presetsHTML(c,true);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.match(html,/data-preset-apply="0" disabled/);assert.match(html,/id="preset-save"[^>]*disabled/);
 assert.equal(escapeHTML(`&<>"'`),'&amp;&lt;&gt;&quot;&#39;');
});
