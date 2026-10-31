import {tireKey} from './wear.js';
import {installedEngineId} from './engine-data.js';
import {partReason} from './tuning.js';
import {CARS,EVENTS,PARTS,PILOTS} from './data.js';
export const START_MONEY=18000;
export const SERVICE_RATE=450;
export function raceClass(config){
 const mass=config.car.mass-(config.parts.includes('weight')?65:0)+(config.parts.includes('suspension')?8:0);
 const rating=config.car.power/mass+(config.parts.includes('slicks')?.016:config.parts.includes('tires')?.012:config.parts.includes('wetTires')?.01:config.parts.includes('dragRadial')?.012:config.parts.includes('streetTires')?.005:0)+(config.parts.includes('suspension')?.005:0)+(config.parts.includes('lsd')?.006:0)+(config.parts.includes('aero')?.01:0)+(config.parts.includes('splitter')?.004:0)+(config.parts.includes('brace')?.002:0)+(config.parts.includes('pads')?.002:0);
 return rating<.17?{id:'club',name:'CLUB',car:'ae86',reward:.8}:rating<.205?{id:'sport',name:'SPORT',car:'chaser',reward:1}: {id:'expert',name:'EXPERT',car:'evo',reward:1.2};
}
export function payoutScale(career,eventId){return Math.max(.5,1/(1+(career.eventCompletions?.[eventId]||0)*.12));}
export function admissionReason(career,eventId){
 const event=EVENTS.find(e=>e.id===eventId)||EVENTS[0],minimum=['drag','drift','timeattack'].includes(event.mode)?55:45;
 const w=career.wear?.[career.car];if(w&&(w.engine<15||w.transmission<15||w.stockBrakes<10||w[tireKey(career.builds[career.car])]<10))return 'Критический износ узла: нужен сервис или аварийный ремонт до 60%';
 return career.condition[career.car]<minimum?`Для старта нужно состояние машины от ${minimum}%. Доступен ремонт в гараже.`:'';
}
export function unlockEverything(career){
 const next=structuredClone(career);next.money=1000000;next.races=Math.max(20,next.races);next.street=Math.max(100,next.street);next.official=Math.max(100,next.official);next.repairDebt=0;
 next.championships??={active:null,history:[],completed:[]};next.championships.completed=['club','regional','masters','allstars','legends'];
 next.ownedCars=CARS.map(c=>c.id);
 for(const car of CARS){next.purchased[car.id]=PARTS.filter(p=>!partReason(car.id,p.id,installedEngineId(next,car.id))).map(p=>p.id);next.condition[car.id]=100;}
 next.team={...next.team,founded:true,contracts:PILOTS.map(p=>({pilotId:p.id,trust:100,experience:30}))};
 return next;
}
// Expected cost only: no seed, actual roll or future RNG is visible to planners.
export function incidentPrice(chance,config,remaining=1){
 const caution=config.pilot.id==='aki'?.65:config.pilot.id==='yui'?1.25:1;
 return chance*(8+remaining*5)*caution;
}

export function rewardFactor(config,mode){return .55*raceClass(config).reward*(mode==='drag'?.45:1);}
