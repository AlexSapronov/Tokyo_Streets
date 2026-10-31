import {getEngine,engineCar} from './engine-data.js';
import {normalizeSetup} from './setup.js';
import {CARS,PARTS} from './data.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function partReason(carId,partId,engineId){
 const platform=CARS.find(c=>c.id===carId),car=platform?engineCar(platform,engineId):null,part=PARTS.find(p=>p.id===partId);
 if(!car||!part)return 'Неизвестная машина или деталь';
 if(part.turboOnly&&!car.engine.includes('TURBO'))return 'Только для турбомотора';
 if(part.naOnly&&car.engine.includes('TURBO'))return 'Только для атмосферного мотора';
 if(part.rearOnly&&!['FR','MR'].includes(car.drive))return 'Только для FR / MR';
 return '';
}
export function normalizeBuild(carId,parts,engineId){
 const result=[];
 for(const id of parts){
  if(partReason(carId,id,engineId))continue;
  const part=PARTS.find(p=>p.id===id);
  for(let i=result.length-1;i>=0;i--)if(result[i]===id||part.slot&&PARTS.find(p=>p.id===result[i]).slot===part.slot)result.splice(i,1);
  result.push(id);
 }
 return result;
}
// Only new hardware is applied here; legacy six retain their established model effects.
export function tunedCar(car,parts,rawSetup={},rawWear={}){
 const setup=normalizeSetup(parts,rawSetup),bias=setup.brakeBias-60;
 const has=id=>parts.includes(id),q=id=>(rawWear[id]??100)/100,eff=(id,v)=>1+(v-1)*q(id);
 return {...car,brakes:car.brakes*(1+bias*.003)*(has('pads')?eff('pads',1.07):1),brakeHeatFactor:has('pads')?eff('pads',.9):1,partBrakeFactor:eff('brakes',1.18),partBrakeHeatFactor:eff('brakes',.7),partLsdHealth:q('lsd'),partSuspensionHealth:q('suspension'),coolerFactor:eff('cooling',1.3),cooling:car.cooling*(has('radiator')?eff('radiator',1.18):1),grip:car.grip*(has('brace')?eff('brace',1.015):1)*(1-Math.max(0,bias)*.001),setupRisk:Math.max(0,-bias)*.006+Math.max(0,bias)*.001,pressure:setup.pressure,springRate:setup.springRate,rollingFactor:(2.2/setup.pressure)**.6*(has('dragRadial')?1.04:1),power:Math.round(car.power*(has('ecu')?eff('ecu',1.08):1)*(has('turbo')?eff('turbo',1.22):1)*(has('cams')?eff('cams',1.12):1)*(has('exhaust')?eff('exhaust',1.035):1)*(has('intercooler')?eff('intercooler',1.04):1)),
 mass:car.mass+(has('turbo')?18:0)+(has('aero')?12:0)+(has('angle')?4:0)+(has('radiator')?5:0)+(has('intercooler')?9:0)+(has('brace')?3:0)+(has('splitter')?3:0)-(has('exhaust')?6:0)-(has('flywheel')?3:0),
 heatFactor:(has('ecu')?1.12:1)*(has('turbo')?1.35:1)*(has('cams')?1.15:1)*(has('clutch')?1.08:1)*(has('exhaust')?1.025:1)*(has('intercooler')?.9:1),
 wearFactor:(has('turbo')?1.15:1)*(has('slicks')?1.55:has('wetTires')||has('dragRadial')?1.1:has('streetTires')?.85:1)*(has('clutch')?1.06:1)*(1+Math.abs(setup.pressure-2.2)*.15)*(1+Math.max(0,setup.springRate-100)/300),
 focusFactor:(has('turbo')?1.08:1)*(has('weight')?1+(1-q('weight'))*.08:1),airResistance:.43*(has('splitter')?1.04:1)*(has('intercooler')?1.02:1)*(has('aero')?1+.14*setup.wing/50:1),aeroGrip:(has('aero')?.1*setup.wing/50*q('aero'):0)+(has('splitter')?.035*q('splitter'):0),
 finalRatio:has('shortFinal')?1.12:has('longFinal')?.88:setup.finalDrive,shiftFactor:(car.shiftWear||1)*(1+(['gearbox','shortFinal','longFinal'].some(has)?(1-q(['gearbox','shortFinal','longFinal'].find(has)))*.25:0))*(has('clutch')?eff('clutch',.72):1)*(has('flywheel')?eff('flywheel',.9):1),
 lowRpmFactor:(has('cams')?.88:1)*(has('flywheel')?.96:1),driftPrecision:has('angle')?.045*q('angle'):0,driftYaw:(has('angle')?eff('angle',1.08):1)*(has('brace')?eff('brace',1.02):1)*(1+(setup.springRate-100)*.002)*(1-bias*.005)};
}
export function tireFactor(config,wet,pressure=true,discipline='road'){
 const optimum=wet>.35?2.05:2.15,springs=wet>.35?90:110;
 const setup=(pressure?1-Math.abs((config.car.pressure||2.2)-optimum)*.1+Math.abs(2.2-optimum)*.1:1)*(1-Math.abs((config.car.springRate||100)-springs)/1000+Math.abs(100-springs)/1000);
 return setup*(config.parts.includes('streetTires')?(wet>.35?1.06:1.05):config.parts.includes('dragRadial')?(wet>.35?.72:discipline==='drag'?1.2:1.03):config.parts.includes('wetTires')?(wet>.35?1.14:.95):config.parts.includes('slicks')?(wet>.35?.7:1.18):config.parts.includes('tires')?(wet>.35?.93:1.12):1);
}
export function aeroGrip(config,velocity){return 1+(config.car.aeroGrip||0)*clamp(velocity/55,0,1)**2;}
