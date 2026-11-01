import {hasPart} from './parts.js';
import {emptyEngines} from './powertrain.js';
import {installedEngineId,getEngine,stockEngineId} from './engine-data.js';
import {emptyWear,normalizeComponentWear,freshWear,tireKey} from './wear.js';
import {partAccessReason} from './workshop.js';
import {normalizeSetup,SETUP_FIELDS,defaultSetup} from './setup.js';
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
  if(car.rewardOnly&&!next.ownedCars.includes(id))throw Error('Эта машина выдаётся только за победу в Tsukuba Club Trophy');
  if(!next.ownedCars.includes(id)){pay(next,car.price);next.ownedCars.push(id);}
  next.car=id;
  return next;
}
export function togglePart(career,id,activeRace=false) {
  const part=PARTS.find(part=>part.id===id);
  if(!part)throw new Error('Неизвестная деталь');
  const next=editable(career,activeRace),carId=next.car;
  const reason=partReason(carId,id,installedEngineId(next,carId))||partAccessReason(next,id);if(reason)throw new Error(reason);
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
  return Math.ceil((100-career.condition[career.car])*SERVICE_RATE)+componentIds(career).reduce((n,id)=>n+componentRepairCost(career,id),0);
}
export function serviceCar(career,activeRace=false) {
  const next=editable(career,activeRace),cost=serviceCost(next);
  pay(next,cost);next.condition[next.car]=100;next.wear??=emptyWear();for(const id of componentIds(next))next.wear[next.car][id]=100;return next;
}

export function recoveryService(career,activeRace=false){
 const next=editable(career,activeRace),condition=next.condition[next.car];
 if(!recoveryNeeded(next))throw new Error('Аварийный ремонт доступен при состоянии ниже 60%');
 next.wear??=emptyWear();const keys=componentIds(next).filter(id=>['engine','transmission','stockBrakes','stockSuspension','stockTires'].includes(id)||PARTS.find(p=>p.id===id)?.slot==='tires');
 const cost=Math.ceil(Math.max(0,60-condition)*SERVICE_RATE)+keys.reduce((n,id)=>n+componentRepairCost(next,id,60),0),paid=Math.min(next.money,cost);
 next.money-=paid;next.repairDebt=(next.repairDebt||0)+cost-paid;next.condition[next.car]=Math.max(60,condition);for(const id of keys)next.wear[next.car][id]=Math.max(60,next.wear[next.car][id]);return next;
}

export function setCarSetup(career,values,activeRace=false){
 const next=editable(career,activeRace),parts=next.builds[next.car],current=normalizeSetup(parts,next.setups?.[next.car]);
 if(!values||Object.keys(values).some(key=>!SETUP_FIELDS.some(f=>f.key===key)))throw new Error('Неизвестная настройка');
 for(const [key,value] of Object.entries(values)){
  const field=SETUP_FIELDS.find(f=>f.key===key);
  if(!Number.isFinite(value)||value<field.min||value>field.max)throw new Error('Настройка вне допустимого диапазона');
  if(field.requires&&!hasPart(parts,field.requires)&&value!==field.value)throw new Error(field.lock);
 }
 next.setups??={};next.setups[next.car]=normalizeSetup(parts,{...current,...values});return next;
}

export function componentIds(career,carId=career.car){
 const parts=career.builds[carId];return [...new Set(['engine','transmission','stockBrakes','stockSuspension',parts.find(id=>PARTS.find(p=>p.id===id)?.slot==='tires')||'stockTires',...parts])];
}
export function componentPrice(career,id){return id==='engine'?getEngine(installedEngineId(career)).price:id==='transmission'?24000:id==='stockTires'?6000:id==='stockBrakes'?10000:id==='stockSuspension'?12000:PARTS.find(p=>p.id===id)?.price||10000;}
export function componentRepairCost(career,id,target=100){const health=career.wear?.[career.car]?.[id]??100;return Math.ceil(Math.max(0,target-health)*componentPrice(career,id)*.0065);}
export function repairComponent(career,id,activeRace=false){const next=editable(career,activeRace);if(!componentIds(next).includes(id))throw new Error('Узел не установлен');next.wear??=emptyWear();const cost=componentRepairCost(next,id);pay(next,cost);next.wear[next.car][id]=100;return next;}
export function recoveryNeeded(career){return career.condition[career.car]<60||['engine','transmission','stockBrakes','stockSuspension',...componentIds(career).filter(id=>id==='stockTires'||PARTS.find(p=>p.id===id)?.slot==='tires')].some(id=>(career.wear?.[career.car]?.[id]??100)<60);}

export const TRADE_IN_RATE=.6;
export function tradeInQuote(career,targetId,sourceId=career.car){
 const source=CARS.find(c=>c.id===sourceId),target=CARS.find(c=>c.id===targetId);
 if(!source||!target||!career.ownedCars.includes(sourceId))throw new Error('Выбери свою машину и новую модель');
 if(source.rewardOnly||target.rewardOnly)throw Error('Призовая машина не участвует в трейд-ин');
 if(career.ownedCars.includes(targetId))throw new Error('Новая машина уже есть в гараже');
 if(career.championships?.active?.carId===sourceId)throw new Error('Машина зарегистрирована в чемпионате: сначала заверши или покинь его');
 const health=id=>Math.max(0,Math.min(100,career.wear?.[sourceId]?.[id]??100))/100;
 const core=['engine','transmission','stockBrakes','stockSuspension',tireKey(career.builds[sourceId])];
 const condition=Math.max(0,Math.min(100,career.condition[sourceId]))/100;
 const base=source.price*condition*core.reduce((n,id)=>n+health(id),0)/core.length;
 const engineId=installedEngineId(career,sourceId),engineAdjustment=(getEngine(engineId).price-getEngine(stockEngineId(sourceId)).price)*health('engine');
 const parts=career.purchased[sourceId].map(id=>{const part=PARTS.find(p=>p.id===id);return {id,name:part.name,price:part.price,condition:health(id),value:part.price*health(id)};});
 const credit=Math.floor(Math.max(0,base+engineAdjustment+parts.reduce((n,p)=>n+p.value,0))*TRADE_IN_RATE);
 return {sourceId,targetId,base,condition,engineId,engineAdjustment,parts,rate:TRADE_IN_RATE,credit,price:target.price,due:Math.max(0,target.price-credit),cashback:Math.max(0,credit-target.price),affordable:career.money+credit>=target.price};
}
export function tradeInCar(career,targetId,activeRace=false){
 const next=editable(career,activeRace),quote=tradeInQuote(next,targetId);
 if(!quote.affordable)throw new Error('Недостаточно денег на доплату по трейд-ин');
 const sourceId=next.car;
 next.money+=quote.credit-quote.price;next.ownedCars=next.ownedCars.filter(id=>id!==sourceId);next.ownedCars.push(targetId);next.car=targetId;
 // The whole car-specific inventory is included in the quote; global spare engines stay.
 next.builds[sourceId]=[];next.purchased[sourceId]=[];next.presets[sourceId]=[];next.setups[sourceId]=defaultSetup();next.condition[sourceId]=100;
 next.wear??=emptyWear();next.wear[sourceId]=freshWear();next.engines??=emptyEngines();
 let sequence=0,instanceId;const used=new Set([...Object.values(next.engines.installed),...next.engines.spares].map(e=>e.instanceId));
 do{instanceId=`replacement-${sourceId}-${sequence++}`;}while(used.has(instanceId));
 next.engines.installed[sourceId]={instanceId,engineId:stockEngineId(sourceId)};
 return next;
}
