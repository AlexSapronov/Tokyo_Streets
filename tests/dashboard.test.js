import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,EVENTS,sectorAt} from '../src/data.js';
import {configuration,createRace,resolveSector,simulate,availableCards} from '../src/engine.js';
import {readTelemetry,transmission,interpolateTelemetry,sampleTelemetry,normalizeTelemetry} from '../src/telemetry.js';
import {dashboardHTML,bindDashboard} from '../src/dashboard.js';
import {newCareer,validateSave} from '../src/storage.js';
import {raceRecord,awardRace} from '../src/progress.js';
import {finishRace} from './helpers.js';
const cfg=configuration('ae86','ren');
function fakeRoot(){
 const node=dataset=>({dataset,textContent:'',style:{},attributes:{},classes:new Set(),
  setAttribute(key,value){this.attributes[key]=value;},classList:{toggle(key,on){this.owner.classes[on?'add':'delete'](key);}}});
 const fields=['speed','rpm','gear','coolant','oil','brakes','tireTemp','tires','focus','warning'];
 const groups={'[data-value]':fields.map(value=>node({value})),
  '[data-needle]':['speed','rpm'].map(needle=>node({needle})),
  '[data-meter]':['speed','rpm'].map(meter=>node({meter})),
  '[data-temp]':['coolant','oil','brakes','tireTemp'].map(temp=>node({temp}))};
 for(const values of Object.values(groups))for(const value of values)value.classList.owner=value;
 return {querySelectorAll:selector=>groups[selector],values:Object.fromEntries(groups['[data-value]'].map(n=>[n.dataset.value,n])),
  needles:Object.fromEntries(groups['[data-needle]'].map(n=>[n.dataset.needle,n])),meters:Object.fromEntries(groups['[data-meter]'].map(n=>[n.dataset.meter,n])),
  lamps:Object.fromEntries(groups['[data-temp]'].map(n=>[n.dataset.temp,n]))};
}
test('dashboard contains two instrument dials, gear and all four thermal sensors for each car',()=>{
 for(const car of CARS){const html=dashboardHTML(configuration(car.id,'ren'));
  assert.ok(html.includes(car.name));assert.ok(html.includes('data-meter="speed"'));assert.ok(html.includes('data-meter="rpm"'));
  for(const field of ['gear','coolant','oil','brakes','tireTemp','tires','focus'])assert.ok(html.includes(`data-value="${field}"`));
  assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));assert.equal((html.match(/role="meter"/g)||[]).length,2);
 }
});
test('speedometer and tachometer update their needles, numbers, gear and accessible meter values',()=>{
 const root=fakeRoot(),update=bindDashboard(root,cfg),state=createRace(cfg).player,data=readTelemetry(cfg,state,'duel');
 update(data);assert.equal(root.values.speed.textContent,Math.round(data.speed));assert.equal(root.values.gear.textContent,data.gear);
 assert.equal(root.meters.speed.attributes['aria-valuenow'],Math.round(data.speed));
 assert.match(root.needles.speed.style.transform,/rotate\(/);assert.equal(root.values.rpm.textContent,(data.rpm/1000).toFixed(1));
});
test('temperature warning lamps follow actual samples and reset after cooling',()=>{
 const root=fakeRoot(),update=bindDashboard(root,cfg),data=readTelemetry(cfg,createRace(cfg).player,'duel');
 update({...data,coolant:120,oil:150,brakes:170,tireTemp:140});assert.equal(root.values.warning.textContent,'● TEMP');
 for(const lamp of Object.values(root.lamps))assert.ok(lamp.classes.has('hot'));
 update({...data,coolant:80,oil:90,brakes:60,tireTemp:55});assert.equal(root.values.warning.textContent,'● RUN');
 for(const lamp of Object.values(root.lamps))assert.ok(!lamp.classes.has('hot'));
});
test('neutral and redline indicators work while needle rotation stays bounded',()=>{
 const root=fakeRoot(),update=bindDashboard(root,cfg),data=readTelemetry(cfg,{...createRace(cfg).player,velocity:0},'duel');
 update(data);assert.equal(root.values.gear.textContent,'N');
 update({...data,speed:400,rpm:10000,gear:5});assert.equal(root.values.warning.textContent,'● SHIFT');
 assert.equal(root.needles.speed.style.transform,'rotate(130deg)');assert.equal(root.needles.rpm.style.transform,'rotate(130deg)');
});
test('approximate transmission responds to speed and profiles without nonfinite RPM or invalid gears',()=>{
 for(const car of CARS)for(let speed=0;speed<=350;speed+=.5){const config=configuration(car.id,'ren'),drive=transmission(config,speed);
  assert.ok(Number.isFinite(drive.rpm));assert.ok(drive.rpm>=0&&drive.rpm<=drive.redline);assert.ok(drive.gear>=0&&drive.gear<=5);
 }
 const fallback=transmission({car:{id:'unknown'}},50);assert.ok(fallback.rpm>0);
 assert.equal(transmission(cfg,0,'drag',{rpm:5700}).rpm,5700);
 assert.ok(transmission(cfg,140,'drag',{shiftStyle:'short'}).gear>=transmission(cfg,140,'drag',{shiftStyle:'redline'}).gear);
});
test('drag staging changes RPM while stationary and launch changes speed and gear',()=>{
 let race=createRace(cfg,'dry','yokohama');const initial=readTelemetry(cfg,race.player,'drag');
 race=resolveSector(race,'drag-burnout');const staged=readTelemetry(cfg,race.player,'drag');
 assert.equal(staged.speed,0);assert.equal(staged.gear,0);assert.equal(staged.rpm,5700);assert.ok(staged.rpm>initial.rpm);
 race=resolveSector(race,'drag-soft');const launched=readTelemetry(cfg,race.player,'drag');assert.ok(launched.speed>0&&launched.gear>=1);
});
test('live interpolation preserves endpoints and moves every sensor continuously',()=>{
 const race=createRace(cfg),next=resolveSector(race,'attack'),from=readTelemetry(cfg,race.player,'duel'),to=readTelemetry(cfg,next.player,'duel');
 for(const t of [0,.25,.5,.75,1]){const sample=interpolateTelemetry(cfg,'duel',from,to,t);
  for(const key of ['speed','coolant','oil','brakes','tireTemp','tires','focus']){
   assert.ok(Math.abs(sample[key]-(from[key]+(to[key]-from[key])*t))<1e-9);
  }
 }
 const stationary=interpolateTelemetry(cfg,'drag',{...from,speed:0,rpm:3500},{...to,speed:0,rpm:5700},.5);
 assert.equal(stationary.rpm,4600);assert.equal(stationary.gear,0);
});
test('recorded telemetry survives all five disciplines, migrates old replays and rejects corrupted overlays',()=>{
 for(const event of EVENTS){
  const race=finishRace(cfg,'mixed',event.id),record=raceRecord(race),loaded=validateSave(awardRace(newCareer(),race).career);
  assert.equal(record.telemetry.length,event.sectors.length);assert.deepEqual(loaded.bests[0].telemetry,record.telemetry);
  const frame=sampleTelemetry(cfg,event.mode,record,record.time/2);assert.ok(Number.isFinite(frame.speed)&&Number.isFinite(frame.rpm));
  const old={...record};delete old.telemetry;assert.equal(sampleTelemetry(cfg,event.mode,old,0),null);
  assert.equal(validateSave({...newCareer(),bests:[old]}).bests.length,1);
  const bad=structuredClone(record);bad.telemetry[0].rpm=Infinity;
  const repaired=validateSave({...newCareer(),bests:[bad]});assert.equal(repaired.bests.length,1);assert.equal(repaired.bests[0].telemetry,undefined);
 }
});
test('thermal calculation respects physical sensor sources and cooling equipment',()=>{
 const config=configuration('ae86','ren'),hks=configuration('ae86','ren',['cooling']);
 let base=createRace(config,'dry','yokohama'),cooled=createRace(hks,'dry','yokohama');
 for(const id of ['drag-burnout','drag-hard','drag-redline','drag-push']){base=resolveSector(base,id);cooled=resolveSector(cooled,id);}
 assert.ok(readTelemetry(hks,cooled.player,'drag').oil<readTelemetry(config,base.player,'drag').oil);
 const drift=finishRace(cfg,'mixed','ebisu');assert.equal(readTelemetry(cfg,drift.player,'drift').tireTemp,drift.player.drift.temperature);
 const road=finishRace(cfg);assert.equal(readTelemetry(cfg,road.player,'duel').brakes,road.player.heat);
});
test('telemetry validator requires finite bounded values and integral gears',()=>{
 const values=readTelemetry(cfg,createRace(cfg).player,'duel');assert.deepEqual(normalizeTelemetry([values],1),[values]);
 assert.equal(normalizeTelemetry(null,1),null);assert.equal(normalizeTelemetry([],1),null);
 for(const patch of [{speed:NaN},{rpm:10001},{gear:1.5},{oil:-1},{coolant:1000},{focus:-1},{tireTemp:500},{tires:101}])assert.equal(normalizeTelemetry([{...values,...patch}],1),null);
});
