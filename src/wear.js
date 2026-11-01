import {partFamily} from './parts.js';
import {CARS,PARTS,getEvent} from './data.js';
const clamp=n=>Math.max(0,Math.min(100,Number.isFinite(n)?n:100));
export const WEAR_KEYS=['engine','transmission','stockTires','stockBrakes','stockSuspension',...PARTS.map(p=>p.id)];
export const freshWear=()=>Object.fromEntries(WEAR_KEYS.map(id=>[id,100]));
export const normalizeComponentWear=raw=>Object.fromEntries(WEAR_KEYS.map(id=>[id,clamp(raw?.[id])]));
export const emptyWear=()=>Object.fromEntries(CARS.map(c=>[c.id,freshWear()]));
export const normalizeWear=raw=>Object.fromEntries(CARS.map(c=>[c.id,normalizeComponentWear(raw?.[c.id])]));
export const tireKey=parts=>PARTS.find(p=>p.slot==='tires'&&parts.includes(p.id))?.id||'stockTires';
export function wornCar(car,raw){const w=normalizeComponentWear(raw);return {...car,power:Math.round(car.power*(.6+.4*w.engine/100)*(.92+.08*w.transmission/100)),brakes:car.brakes*(.55+.45*w.stockBrakes/100),grip:car.grip*(.8+.2*w.stockSuspension/100),shiftWear:1+(100-w.transmission)/160};}
// distance / heat / corners / slip / shifts: different failure loads per component.
const rates={ecu:[.02,.08,0,0,0],turbo:[.14,.25,0,0,0],cams:[.08,.15,0,0,0],exhaust:[.04,.08,0,0,0],intercooler:[.07,.12,0,0,0],cooling:[.07,.2,0,0,0],radiator:[.06,.15,0,0,0],lsd:[.03,0,.05,.05,0],clutch:[.02,.04,0,.02,.12],gearbox:[.04,.03,0,0,.1],shortFinal:[.03,0,0,.02,.06],longFinal:[.03,0,0,.02,.06],flywheel:[.02,0,0,0,.04],brakes:[0,0,.2,.02,0],pads:[0,0,.3,.03,0],suspension:[.02,0,.07,.05,0],brace:[.01,0,.04,.03,0],angle:[.01,0,.1,.08,0],aero:[.04,0,0,0,0],splitter:[.05,0,0,0,0],weight:[.015,0,0,0,0]};
export function settleWear(career,race){
 const next=structuredClone(career);next.wear??=emptyWear();const id=race.config.car.id,w=normalizeComponentWear(next.wear[id]),start=normalizeComponentWear(race.config.wear),distance=getEvent(race.eventId).sectors.slice(0,race.index).reduce((n,s)=>n+s.length,0)/1000,damage=race.player.dnf?.damage||0;
 const corners=getEvent(race.eventId).sectors.slice(0,race.index).filter(s=>s.type==='corner').length,hot=race.history.reduce((n,r)=>n+Math.max(0,(r.telemetry?.oil||90)-110)/100,0),slip=race.history.reduce((n,r)=>n+r.slip,0);
 const loss={engine:distance*(.2+race.config.car.power/race.config.car.mass*.25)+hot*.3+damage*.55,transmission:race.index*.1+slip*.025+damage*.3,stockBrakes:corners*.22+damage*.25,stockSuspension:race.index*.07+slip*.04+damage*.35};
 const shifts=race.history.reduce((n,row,i)=>n+(row.drag?.shifts||Math.abs((row.telemetry?.gear||0)-(race.history[i-1]?.telemetry?.gear||0))),0);
 for(const part of race.config.parts){const family=partFamily(part),[d,h,c,s,g]=rates[part]||rates[family]||[.09,.08,0,0,0];loss[part]=d*distance+h*hot+c*corners+s*slip+g*shifts+damage*(['aero','splitter','flatFloor'].includes(family)?.6:.35);}
 for(const [key,amount] of Object.entries(loss))w[key]=clamp(start[key]-amount);
 w[tireKey(race.config.parts)]=clamp(race.player.tires);next.wear[id]=w;return next;
}
