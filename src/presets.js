import {CARS,PARTS} from './data.js';
import {normalizeBuild,partReason} from './tuning.js';
import {normalizeSetup,validSetup} from './setup.js';
export const PRESET_LIMIT=6;
export function normalizePresets(carId,raw,purchased){
 const seen=new Set();
 return (Array.isArray(raw)?raw:[]).filter(p=>{
  if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>32||seen.has(p.name.trim()))return false;
  if(!Array.isArray(p.parts)||p.parts.length>PARTS.length||p.parts.some(id=>!purchased.includes(id)||partReason(carId,id))||normalizeBuild(carId,p.parts).length!==p.parts.length||!validSetup(p.parts,p.setup))return false;
  seen.add(p.name.trim());return true;
 }).slice(0,PRESET_LIMIT).map(p=>({name:p.name.trim(),parts:[...p.parts],setup:normalizeSetup(p.parts,p.setup)}));
}
function editable(career,active){if(active)throw new Error('Сначала заверши текущий заезд');return structuredClone(career);}
export function savePreset(career,name,active=false){
 const next=editable(career,active);
 if(typeof name!=='string'||!name.trim()||name.trim().length>32)throw new Error('Имя пресета: от 1 до 32 символов');
 name=name.trim();next.presets??={};const list=next.presets[next.car]||[];
 const index=list.findIndex(p=>p.name===name);if(index<0&&list.length>=PRESET_LIMIT)throw new Error('Не больше шести пресетов на машину');
 const preset={name,parts:[...next.builds[next.car]],setup:normalizeSetup(next.builds[next.car],next.setups[next.car])};
 if(index<0)list.push(preset);else list[index]=preset;next.presets[next.car]=list;return next;
}
export function applyPreset(career,index,active=false){
 const next=editable(career,active),preset=next.presets?.[next.car]?.[index];
 if(!Number.isInteger(index)||!preset||normalizePresets(next.car,[preset],next.purchased[next.car]).length!==1)throw new Error('Пресет недоступен или содержит некупленные детали');
 next.builds[next.car]=[...preset.parts];next.setups[next.car]={...preset.setup};return next;
}
export function deletePreset(career,index,active=false){
 const next=editable(career,active);if(!Number.isInteger(index)||!next.presets?.[next.car]?.[index])throw new Error('Пресет не найден');next.presets[next.car].splice(index,1);return next;
}
export function emptyPresets(){return Object.fromEntries(CARS.map(c=>[c.id,[]]));}
