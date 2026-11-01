import test from 'node:test';
import assert from 'node:assert/strict';
import {newCareer,SAVE_KEY,activeSlot,readSlot,loadCareer,storeCareer,writeSlot,slotKey,slotList,renameSlot,activateSlot,restoreSlot,exportCareer,importCareer,SAVE_FILE_LIMIT} from '../src/storage.js';
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};};
test('legacy key remains slot one, three independent careers persist across switching',()=>{
 const s=memory(),c=newCareer();c.money=1234;s.setItem(SAVE_KEY,JSON.stringify(c));assert.equal(activeSlot(s),1);assert.equal(loadCareer(s).money,1234);
 activateSlot(s,2);assert.equal(loadCareer(s).money,newCareer().money);c.money=9876;assert.equal(storeCareer(s,c),true);assert.equal(readSlot(s,1).career.money,1234);assert.equal(readSlot(s,2).career.money,9876);
 activateSlot(s,3);storeCareer(s,newCareer());assert.equal(slotList(s).length,3);assert.equal(readSlot(s,3).status,'ok');activateSlot(s,1);assert.equal(loadCareer(s).money,1234);
 for(const id of [0,4,1.5,'2',NaN])assert.throws(()=>slotKey(id));
});
test('previous good autosave is recoverable and corruption is never silently overwritten',()=>{
 const s=memory(),c=newCareer();writeSlot(s,1,c);c.money=5000;writeSlot(s,1,c);assert.equal(restoreSlot(s,1).money,18000);
 s.setItem(SAVE_KEY,'');assert.equal(readSlot(s).status,'error');assert.equal(storeCareer(s,c),false);assert.equal(s.getItem(SAVE_KEY),'');
 s.setItem(SAVE_KEY,'broken');assert.equal(readSlot(s).status,'error');assert.equal(storeCareer(s,c),false);assert.equal(s.getItem(SAVE_KEY),'broken');assert.throws(()=>activateSlot(s,1));assert.equal(slotList(s)[0].backup,true);restoreSlot(s,1);assert.equal(loadCareer(s).money,18000);
 s.setItem(SAVE_KEY,'broken again');writeSlot(s,1,c,{replace:true});assert.equal(loadCareer(s).money,5000);assert.equal(restoreSlot(s,1).money,18000);
});
test('replacement and duplicate saves preserve backup and failures do not destroy primary',()=>{
 const s=memory(),c=newCareer();writeSlot(s,2,c);c.money=750;writeSlot(s,2,c);const old=s.getItem(slotKey(2)+'-backup');writeSlot(s,2,c);assert.equal(s.getItem(slotKey(2)+'-backup'),old);
 const primary=s.getItem(slotKey(2)),limited={getItem:s.getItem,setItem(){throw Error('quota');}};assert.throws(()=>writeSlot(limited,2,newCareer()));assert.equal(s.getItem(slotKey(2)),primary);assert.throws(()=>restoreSlot(s,3));
 assert.equal(readSlot({getItem(){throw Error('denied');}}).status,'error');
});
test('portable files roundtrip independent snapshots and reject invalid or oversized inputs',()=>{
 const c=newCareer();c.helpSeen=true;c.street=40;c.streetPeak=40;c.money=7312;c.ownedCars.push('r32');c.purchased.ae86=['tires'];c.builds.ae86=['tires'];c.wear.ae86.tires=54;
 const imported=importCareer(exportCareer(c));assert.equal(imported.money,7312);assert.equal(imported.wear.ae86.tires,54);assert.deepEqual(imported.builds.ae86,['tires']);assert.equal(importCareer(JSON.stringify(c)).street,40);imported.money=0;assert.equal(c.money,7312);
 for(const text of ['bad','null','{}','{"format":"another","formatVersion":1}','{"format":"tokyo-streets-career","formatVersion":2}', ' '.repeat(SAVE_FILE_LIMIT+1)])assert.throws(()=>importCareer(text));
});
test('slot names are bounded and cannot affect another career',()=>{
 const s=memory();renameSlot(s,1,'  My\nCareer  ');assert.equal(slotList(s)[0].name,'MyCareer');renameSlot(s,2,'x'.repeat(70));assert.equal(slotList(s)[1].name.length,40);assert.throws(()=>renameSlot(s,3,'\n '));assert.equal(readSlot(s,1).status,'empty');
});
