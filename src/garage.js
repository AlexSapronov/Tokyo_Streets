import {installedEngineId,getEngine} from './engine-data.js';
import {emptyWear,normalizeComponentWear} from './wear.js';
import {repairMultiplier} from './operations.js';
import {normalizeSetup,SETUP_FIELDS} from './setup.js';
import {partReason,normalizeBuild} from './tuning.js';
import {SERVICE_RATE} from './balance.js';
import {CARS,PILOTS,PARTS} from './data.js';

function editable(career,activeRace) {
  if(activeRace)throw new Error('Сначала заверши текущий заезд или выйди из него');
  return structuredClone(career);
}
function pay(career,price) {
  if(career.money<price)throw new Error('Недостаточно денег');
  career.money-=price;
}
export function selectCar(career,id,activeRace=false) {
  const car=CARS.find(car=>car.id===id);
  if(!car)throw new Error('Неизвестный автомобиль');
  const next=editable(career,activeRace);
  if(!next.ownedCars.includes(id)){pay(next,car.price);next.ownedCars.push(id);}
  next.car=id;
  return next;
}
export function togglePart(career,id,activeRace=false) {
  const part=PARTS.find(part=>part.id===id);
  if(!part)throw new Error('Неизвестная деталь');
  const next=editable(career,activeRace),carId=next.car;
  const reason=partReason(carId,id,installedEngineId(next,carId));if(reason)throw new Error(reason);
  if(!next.purchased[carId].includes(id)){pay(next,part.price);next.purchased[carId].push(id);next.wear??=emptyWear();next.wear[carId][id]=100;}
  next.builds[carId]=next.builds[carId].includes(id)?next.builds[carId].filter(item=>item!==id):normalizeBuild(carId,[...next.builds[carId],id],installedEngineId(next,carId));
  next.setups??={};next.setups[carId]=normalizeSetup(next.builds[carId],next.setups[carId]);
  return next;
}
export function selectPilot(career,id,activeRace=false) {
  if(!PILOTS.some(pilot=>pilot.id===id))throw new Error('Неизвестный пилот');
  const next=editable(career,activeRace);next.pilot=id;return next;
}
export function serviceCost(career) {
  return Math.ceil((100-career.condition[career.car])*SERVICE_RATE*repairMultiplier(career))+componentIds(career).reduce((n,id)=>n+componentRepairCost(career,id),0);
}
export function serviceCar(career,activeRace=false) {
  const next=editable(career,activeRace),cost=serviceCost(next);
  pay(next,cost);next.condition[next.car]=100;next.wear??=emptyWear();for(const id of componentIds(next))next.wear[next.car][id]=100;return next;
}

export function recoveryService(career,activeRace=false){
 const next=editable(career,activeRace),condition=next.condition[next.car];
 if(!recoveryNeeded(next))throw new Error('Аварийный ремонт доступен при состоянии ниже 60%');
 next.wear??=emptyWear();const keys=componentIds(next).filter(id=>['engine','transmission','stockBrakes','stockSuspension','stockTires'].includes(id)||PARTS.find(p=>p.id===id)?.slot==='tires');
 const cost=Math.ceil(Math.max(0,60-condition)*SERVICE_RATE*repairMultiplier(career))+keys.reduce((n,id)=>n+componentRepairCost(next,id,60),0),paid=Math.min(next.money,cost);
 next.money-=paid;next.repairDebt=(next.repairDebt||0)+cost-paid;next.condition[next.car]=Math.max(60,condition);for(const id of keys)next.wear[next.car][id]=Math.max(60,next.wear[next.car][id]);return next;
}

export function setCarSetup(career,values,activeRace=false){
 const next=editable(career,activeRace),parts=next.builds[next.car],current=normalizeSetup(parts,next.setups?.[next.car]);
 if(!values||Object.keys(values).some(key=>!SETUP_FIELDS.some(f=>f.key===key)))throw new Error('Неизвестная настройка');
 for(const [key,value] of Object.entries(values)){
  const field=SETUP_FIELDS.find(f=>f.key===key);
  if(!Number.isFinite(value)||value<field.min||value>field.max)throw new Error('Настройка вне допустимого диапазона');
  if(field.requires&&!parts.includes(field.requires)&&value!==field.value)throw new Error(field.lock);
 }
 next.setups??={};next.setups[next.car]=normalizeSetup(parts,{...current,...values});return next;
}

export function componentIds(career,carId=career.car){
 const parts=career.builds[carId];return [...new Set(['engine','transmission','stockBrakes','stockSuspension',parts.find(id=>PARTS.find(p=>p.id===id)?.slot==='tires')||'stockTires',...parts])];
}
export function componentPrice(career,id){return id==='engine'?getEngine(installedEngineId(career)).price:id==='transmission'?24000:id==='stockTires'?6000:id==='stockBrakes'?10000:id==='stockSuspension'?12000:PARTS.find(p=>p.id===id)?.price||10000;}
export function componentRepairCost(career,id,target=100){const health=career.wear?.[career.car]?.[id]??100;return Math.ceil(Math.max(0,target-health)*componentPrice(career,id)*.0065*repairMultiplier(career));}
export function repairComponent(career,id,activeRace=false){const next=editable(career,activeRace);if(!componentIds(next).includes(id))throw new Error('Узел не установлен');next.wear??=emptyWear();const cost=componentRepairCost(next,id);pay(next,cost);next.wear[next.car][id]=100;return next;}
export function recoveryNeeded(career){return career.condition[career.car]<60||['engine','transmission','stockBrakes','stockSuspension',...componentIds(career).filter(id=>id==='stockTires'||PARTS.find(p=>p.id===id)?.slot==='tires')].some(id=>(career.wear?.[career.car]?.[id]??100)<60);}
