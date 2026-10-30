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
  if(!next.purchased[carId].includes(id)){pay(next,part.price);next.purchased[carId].push(id);}
  next.builds[carId]=next.builds[carId].includes(id)?next.builds[carId].filter(item=>item!==id):[...next.builds[carId],id];
  return next;
}
export function selectPilot(career,id,activeRace=false) {
  if(!PILOTS.some(pilot=>pilot.id===id))throw new Error('Неизвестный пилот');
  const next=editable(career,activeRace);next.pilot=id;return next;
}
export function serviceCost(career) {
  return Math.ceil((100-career.condition[career.car])*150);
}
export function serviceCar(career,activeRace=false) {
  const next=editable(career,activeRace),cost=serviceCost(next);
  pay(next,cost);next.condition[next.car]=100;return next;
}
