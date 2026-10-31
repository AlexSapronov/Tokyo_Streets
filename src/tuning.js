import {CARS,PARTS} from './data.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function partReason(carId,partId){
 const car=CARS.find(c=>c.id===carId),part=PARTS.find(p=>p.id===partId);
 if(!car||!part)return 'Неизвестная машина или деталь';
 if(part.turboOnly&&!car.engine.includes('TURBO'))return 'Только для турбомотора';
 if(part.naOnly&&car.engine.includes('TURBO'))return 'Только для атмосферного мотора';
 if(part.rearOnly&&!['FR','MR'].includes(car.drive))return 'Только для FR / MR';
 return '';
}
export function normalizeBuild(carId,parts){
 const result=[];
 for(const id of parts){
  if(partReason(carId,id))continue;
  const part=PARTS.find(p=>p.id===id);
  for(let i=result.length-1;i>=0;i--)if(result[i]===id||part.slot&&PARTS.find(p=>p.id===result[i]).slot===part.slot)result.splice(i,1);
  result.push(id);
 }
 return result;
}
// Only new hardware is applied here; legacy six retain their established model effects.
export function tunedCar(car,parts){
 const has=id=>parts.includes(id);
 return {...car,power:Math.round(car.power*(has('ecu')?1.08:1)*(has('turbo')?1.22:1)*(has('cams')?1.12:1)),
 mass:car.mass+(has('turbo')?18:0)+(has('aero')?12:0)+(has('angle')?4:0),
 heatFactor:(has('ecu')?1.12:1)*(has('turbo')?1.35:1)*(has('cams')?1.15:1)*(has('clutch')?1.08:1),
 wearFactor:(has('turbo')?1.15:1)*(has('slicks')?1.55:has('wetTires')?1.1:1)*(has('clutch')?1.06:1),
 focusFactor:has('turbo')?1.08:1,airResistance:.43*(has('aero')?1.14:1),aeroGrip:has('aero')?.1:0,
 finalRatio:has('shortFinal')?1.12:has('longFinal')?.88:1,shiftFactor:has('clutch')?.72:1,
 lowRpmFactor:has('cams')?.88:1,driftPrecision:has('angle')?.045:0,driftYaw:has('angle')?1.08:1};
}
export function tireFactor(config,wet){
 return config.parts.includes('wetTires')?(wet>.35?1.14:.95):config.parts.includes('slicks')?(wet>.35?.7:1.18):config.parts.includes('tires')?(wet>.35?.93:1.12):1;
}
export function aeroGrip(config,velocity){return 1+(config.car.aeroGrip||0)*clamp(velocity/55,0,1)**2;}
