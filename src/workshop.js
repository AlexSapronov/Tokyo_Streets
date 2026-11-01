import {hasPart} from './parts.js';
import {PARTS,getEvent} from './data.js';
import {getEngine,installedEngineId} from './engine-data.js';
import {SETUP_FIELDS,normalizeSetup} from './setup.js';
export const earnedStreet=career=>Math.max(career.streetPeak||0,career.street||0);
export const tuningReputation=career=>Math.max(earnedStreet(career),career.official||0);
const requirements={streetTires:4,pads:4,tires:12,brakes:12,lsd:12,suspension:12,weight:12,exhaust:12,brace:12,wetTires:24,dragRadial:24,cooling:24,radiator:24,clutch:24,flywheel:24,angle:24,shortFinal:24,longFinal:24,ecu:36,cams:36,intercooler:36,aero:36,splitter:36,gearbox:36,slicks:48,turbo:48};
export const partReputation=id=>{const part=PARTS.find(p=>p.id===id);return part?.reputation??requirements[part?.family||id]??0;};
export function partAccessReason(career,id){
 if(career.purchased[career.car].includes(id))return '';
 const need=partReputation(id);return tuningReputation(career)<need?`Нужно ${need} репутации (Street или Official)`:'';
}
export function engineAccessReason(career,id){
 const motor=getEngine(id);if(!motor)return 'Мотор не найден';
 const need=motor.extreme?60:36;return tuningReputation(career)<need?`Свап: нужно ${need} репутации (Street или Official)`:'';
}
export const WORKSHOP_PRESETS=[
 {id:'dry',name:'Сухая трасса',money:1000,street:1,description:'Точный отклик, умеренный прижим и баланс торможения.'},
 {id:'wet',name:'Дождь',money:1200,street:2,description:'Мягче подвеска, ниже давление и больше прижим.'},
 {id:'drag',name:'Дрэг',money:1200,street:1,description:'Разгон и меньше сопротивление. Для выбранной стоячей мили — длиннее главная пара.'},
 {id:'drift',name:'Дрифт',money:1500,street:2,description:'Отклик на перекладку, задний тормозной баланс и умеренный прижим.'}
];
function targetSetup(career,id){
 const parts=career.builds[career.car];
 const mile=getEvent(career.eventId).id==='yokohama-mile';
 const values={dry:{pressure:2.15,springRate:110,brakeBias:62,wing:50,finalDrive:1},wet:{pressure:2.05,springRate:90,brakeBias:64,wing:70,finalDrive:.96},drag:{pressure:mile?2.3:2.05,springRate:100,brakeBias:60,wing:0,finalDrive:mile?.92:1.08},drift:{pressure:2.1,springRate:105,brakeBias:58,wing:35,finalDrive:1.04}}[id];
 return normalizeSetup(parts,values);
}
// Public quote contains prices and eligibility only, never target parameters.
export function presetQuote(career,id){
 const profile=WORKSHOP_PRESETS.find(p=>p.id===id);if(!profile)throw new Error('Настройка не найдена');
 const reason=career.money<profile.money?'Недостаточно денег':career.street<profile.street?'Недостаточно Street Cred':'';
 return {...profile,reason};
}
const randomUnit=()=>globalThis.crypto?.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(1))[0]/4294967295:Math.random();
export function applyWorkshopPreset(career,id,active=false,rng=randomUnit){
 if(active)throw new Error('Сначала заверши текущий заезд');
 const quote=presetQuote(career,id),next=structuredClone(career);
 if(quote.reason)throw new Error(quote.reason);
 next.streetPeak=earnedStreet(career);next.money-=quote.money;next.street-=quote.street;
 const draw=()=>{const value=rng();if(!Number.isFinite(value)||value<0||value>1)throw new Error('Недопустимый результат настройки');return value;};
 const quality=Number((.85+.15*draw()).toFixed(6)),parts=next.builds[next.car],values=targetSetup(career,id);
 for(const field of SETUP_FIELDS){
  if(field.requires&&!hasPart(parts,field.requires))continue;
  values[field.key]+=(draw()*2-1)*(1-quality)*(field.max-field.min);
 }
 next.setups[next.car]=normalizeSetup(parts,values);
 next.lastWorkshop={carId:next.car,profile:id,quality,detailVersion:1,engineId:installedEngineId(next),parts:[...parts],before:normalizeSetup(parts,career.setups[career.car]),after:{...next.setups[next.car]},paidMoney:quote.money,paidStreet:quote.street};return next;
}
