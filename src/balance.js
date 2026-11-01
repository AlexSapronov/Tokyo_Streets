import {hasPart} from './parts.js';
import {tireKey} from './wear.js';
import {installedEngineId} from './engine-data.js';
import {partReason,tunedCar} from './tuning.js';
import {engineCar} from './engine-data.js';
import {CARS,EVENTS,PARTS,PILOTS} from './data.js';
export const START_MONEY=18000;
export const SERVICE_RATE=450;
export function raceClass(config){
 // Class and payouts use the healthy installed build, never damage discounts.
 const platform=CARS.find(c=>c.id===config.car.id);
 const car=tunedCar(engineCar(platform,config.engineId),config.parts,config.setup);
 const mass=car.mass-(hasPart(config.parts,'weight')?65:0)+(hasPart(config.parts,'suspension')?8:0);
 const rating=car.power/mass+(hasPart(config.parts,'slicks')?.016:hasPart(config.parts,'tires')?.012:hasPart(config.parts,'wetTires')?.01:hasPart(config.parts,'dragRadial')?.012:hasPart(config.parts,'streetTires')?.005:hasPart(config.parts,'enduranceTires')?.009:0)+(hasPart(config.parts,'suspension')?.005:0)+(hasPart(config.parts,'lsd')?.006:0)+(hasPart(config.parts,'aero')?.01:0)+(hasPart(config.parts,'splitter')?.004:0)+(hasPart(config.parts,'brace')?.002:0)+(hasPart(config.parts,'pads')?.002:0);
 return rating<.17?{id:'club',name:'CLUB',car:'ae86',reward:.8}:rating<.205?{id:'sport',name:'SPORT',car:'chaser',reward:1}: {id:'expert',name:'EXPERT',car:'evo',reward:1.2};
}
export function payoutScale(career,eventId){return Math.max(.5,1/(1+(career.eventCompletions?.[eventId]||0)*.12));}
export function admissionReason(career,eventId){
 const event=EVENTS.find(e=>e.id===eventId)||EVENTS[0],minimum=event.officialOnly||['drag','drift','timeattack'].includes(event.mode)?55:45;
 const w=career.wear?.[career.car];if(w&&(w.engine<15||w.transmission<15||w.stockBrakes<10||w[tireKey(career.builds[career.car])]<10))return 'Критический износ узла: нужен сервис или аварийный ремонт до 60%';
 return career.condition[career.car]<minimum?`Для старта нужно состояние машины от ${minimum}%. Доступен ремонт в гараже.`:'';
}
export function unlockEverything(career){
 const next=structuredClone(career);next.money=1000000;next.races=Math.max(20,next.races);next.street=Math.max(100,next.street);next.official=Math.max(200,next.official);next.streetPeak=Math.max(next.streetPeak||0,next.street);next.repairDebt=0;
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

// Venue purses must match the world map and always reward a better medal.
export function medalPrize(event,medal){
 const bronze=Math.max(event.participation+1000,Math.round(event.prize*.4));
 const silver=Math.max(bronze+1000,Math.round(event.prize*.65));
 return {bronze,silver,gold:Math.max(silver+1000,event.prize)}[medal]??event.participation;
}
