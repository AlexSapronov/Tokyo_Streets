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
  const reason=partReason(carId,id);if(reason)throw new Error(reason);
  if(!next.purchased[carId].includes(id)){pay(next,part.price);next.purchased[carId].push(id);}
  next.builds[carId]=next.builds[carId].includes(id)?next.builds[carId].filter(item=>item!==id):normalizeBuild(carId,[...next.builds[carId],id]);
  next.setups??={};next.setups[carId]=normalizeSetup(next.builds[carId],next.setups[carId]);
  return next;
}
export function selectPilot(career,id,activeRace=false) {
  if(!PILOTS.some(pilot=>pilot.id===id))throw new Error('Неизвестный пилот');
  const next=editable(career,activeRace);next.pilot=id;return next;
}
export function serviceCost(career) {
  return Math.ceil((100-career.condition[career.car])*SERVICE_RATE);
}
export function serviceCar(career,activeRace=false) {
  const next=editable(career,activeRace),cost=serviceCost(next);
  pay(next,cost);next.condition[next.car]=100;return next;
}

export function recoveryService(career,activeRace=false){
 const next=editable(career,activeRace),condition=next.condition[next.car];
 if(condition>=60)throw new Error('Аварийный ремонт доступен при состоянии ниже 60%');
 const cost=Math.ceil((60-condition)*SERVICE_RATE),paid=Math.min(next.money,cost);
 next.money-=paid;next.repairDebt=(next.repairDebt||0)+cost-paid;next.condition[next.car]=60;
 return next;
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
