import {hasPart} from './parts.js';
export const SETUP_FIELDS=[
 {key:'pressure',label:'Давление в шинах',min:1.8,max:2.6,step:.05,value:2.2,unit:'бар',description:'Низкое давление помогает стартовому сцеплению, но увеличивает сопротивление и износ. Высокое давление уменьшает сопротивление качению, но может ухудшить сцепление.'},
 {key:'finalDrive',label:'Передаточное отношение главной пары',min:.85,max:1.15,step:.01,value:1,unit:'×',requires:'gearbox',lock:'Нужна регулируемая коробка HKS Dog Mission.',description:'Больше число — выше обороты и раньше переключения. Меньше — ниже обороты, но слабее разгон. Множитель к заводской главной паре.'},
 {key:'springRate',label:'Жёсткость пружин',min:70,max:130,step:5,value:100,unit:'%',requires:'suspension',lock:'Нужна регулируемая подвеска TEIN Flex Z.',description:'На сухом полезна умеренная жёсткость, на мокром — более мягкая настройка. Жёсткие пружины резче меняют угол в дрифте и повышают износ.'},
 {key:'brakeBias',label:'Тормозной баланс: передняя ось',min:55,max:70,step:1,value:60,unit:'%',description:'Смещение вперёд помогает торможению, но затрудняет поворот. Смещение назад облегчает разворот машины, повышая риск.'},
 {key:'wing',label:'Прижим антикрыла',min:0,max:100,step:5,value:50,unit:'%',requires:'aero',lock:'Нужно установленное регулируемое антикрыло.',description:'Больше прижим — лучше быстрая дуга, но выше сопротивление на прямой. На малой скорости эффект слабый.'}
];
export function defaultSetup(){return Object.fromEntries(SETUP_FIELDS.map(f=>[f.key,f.value]));}
export function normalizeSetup(parts,raw={}){
 return Object.fromEntries(SETUP_FIELDS.map(f=>{
  const v=raw?.[f.key];
  const value=f.requires&&!hasPart(parts,f.requires)||!Number.isFinite(v)?f.value:Math.max(f.min,Math.min(f.max,v));
  return [f.key,Number((f.min+Math.round((value-f.min)/f.step)*f.step).toFixed(2))];
 }));
}
export function setupKey(setup={}){
 const values=defaultSetup();
 return SETUP_FIELDS.every(f=>(setup[f.key]??f.value)===values[f.key])?'':SETUP_FIELDS.map(f=>setup[f.key]??f.value).join(',');
}
export function validSetup(parts,raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const normalized=normalizeSetup(parts,raw);
 return Object.keys(raw).every(key=>SETUP_FIELDS.some(f=>f.key===key))&&SETUP_FIELDS.every(f=>Number.isFinite(raw[f.key])&&raw[f.key]===normalized[f.key]);
}
