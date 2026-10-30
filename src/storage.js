import {CARS,PILOTS,PARTS} from './data.js';
export const SAVE_KEY='tokyo-streets-v1';
export function newCareer(){return {version:1,money:80000,car:'ae86',pilot:'ren',ownedCars:['ae86'],builds:{ae86:[],chaser:[],evo:[]},purchased:{ae86:[],chaser:[],evo:[]},condition:{ae86:100,chaser:100,evo:100},races:0,wins:0,street:0,official:0,best:null,weather:'mixed',helpSeen:false,records:[]};}
export function validateSave(raw){
 if(!raw||raw.version!==1)throw new Error('Неподдерживаемое сохранение');
 const out=newCareer(),validCar=id=>CARS.some(c=>c.id===id),validPart=id=>PARTS.some(p=>p.id===id);
 out.money=Number.isFinite(raw.money)?Math.max(0,Math.min(1e9,raw.money)):80000;
 out.ownedCars=[...new Set(['ae86',...(Array.isArray(raw.ownedCars)?raw.ownedCars.filter(validCar):[])])];
 out.car=out.ownedCars.includes(raw.car)?raw.car:'ae86';out.pilot=PILOTS.some(p=>p.id===raw.pilot)?raw.pilot:'ren';
 for(const c of CARS){out.purchased[c.id]=[...new Set((Array.isArray(raw.purchased?.[c.id])?raw.purchased[c.id]:[]).filter(validPart))];out.builds[c.id]=[...new Set((Array.isArray(raw.builds?.[c.id])?raw.builds[c.id]:[]).filter(id=>out.purchased[c.id].includes(id)))];out.condition[c.id]=Number.isFinite(raw.condition?.[c.id])?Math.max(35,Math.min(100,raw.condition[c.id])):100;}
 for(const k of ['races','wins','street','official'])out[k]=Number.isFinite(raw[k])?Math.max(0,Math.floor(raw[k])):0;
 out.best=Number.isFinite(raw.best)&&raw.best>0?raw.best:null;out.weather=['dry','rain','mixed'].includes(raw.weather)?raw.weather:'mixed';out.helpSeen=raw.helpSeen===true;
 out.records=(Array.isArray(raw.records)?raw.records:[]).slice(0,15).filter(r=>r&&typeof r.car==='string'&&Number.isFinite(r.time)&&typeof r.won==='boolean').map(r=>({car:CARS.find(c=>c.name===r.car)?.name||'AE86',time:r.time,won:r.won}));
 return out;
}
export function loadCareer(storage){try{const data=storage.getItem(SAVE_KEY);return data?validateSave(JSON.parse(data)):newCareer();}catch{return newCareer();}}
export function storeCareer(storage,career){try{storage.setItem(SAVE_KEY,JSON.stringify(career));return true;}catch{return false;}}
