import {hasPart} from './parts.js';
import {replayIndex} from './replay.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
// Approximate game transmission profiles, not homologated factory specifications.
const profiles={
  ae86:{ratios:[3.59,2.02,1.38,1,.86],final:4.3,circumference:1.8,redline:7600,idle:900},
  chaser:{ratios:[3.25,1.96,1.31,1,.75],final:3.73,circumference:1.98,redline:7200,idle:800},
  evo:{ratios:[2.93,1.95,1.41,1.03,.72],final:4.53,circumference:1.95,redline:8000,idle:900},
  mx5:{ratios:[3.14,1.89,1.33,1,.81],final:4.3,circumference:1.78,redline:7200,idle:850},
  s13:{ratios:[3.32,1.90,1.31,1,.76],final:4.08,circumference:1.92,redline:7500,idle:850},
  rx7:{ratios:[3.48,2.01,1.39,1,.72],final:4.3,circumference:1.95,redline:8200,idle:900},
  r32:{ratios:[3.21,1.93,1.3,1,.75],final:4.11,circumference:1.99,redline:8000,idle:850},
  supra:{ratios:[3.83,2.36,1.69,1.31,1,.79],final:3.27,circumference:2.03,redline:7200,idle:800},
  ek9:{ratios:[3.23,2.11,1.46,1.11,.85],final:4.4,circumference:1.82,redline:8600,idle:900},
  nsx:{ratios:[3.07,1.95,1.4,1.03,.77],final:4.06,circumference:1.97,redline:8200,idle:850}

};
export function transmissionProfile(config){const p=profiles[config.car.id]||profiles.ae86;return {...p,redline:config.car.engineRedline||p.redline,final:p.final*(config.car.finalRatio||1),ratios:[...p.ratios]};}
export function longShiftSpeeds(config,style='band',gearing=1){
  const profile=transmissionProfile(config),fraction={short:.78,band:.9,redline:.99}[style]||.9;
  return profile.ratios.slice(0,-1).map(ratio=>profile.redline*fraction*profile.circumference/(60*ratio*profile.final*gearing));
}
export function transmission(config,speed,mode='duel',drag=null){
  const profile=transmissionProfile(config);
  if(speed<1)return {gear:0,rpm:drag?.rpm??profile.idle,redline:profile.redline};
  const velocity=speed/3.6;
  let gear=1;
  const rpmFor=gear=>velocity/profile.circumference*60*profile.ratios[gear-1]*profile.final*(drag?.gearing||1);
  if(mode==='drag'){
    const style={short:.89,band:1,redline:1.1}[drag?.shiftStyle]||1;
    gear=drag?.longFormat?(drag.forceTop?profile.ratios.length:1+longShiftSpeeds(config,drag.shiftStyle,drag.gearing||1).filter(threshold=>velocity>=threshold).length):1+[13,23,34,46,59].filter(threshold=>velocity>=threshold*style/(config.car.finalRatio||1)).length;
    gear=Math.min(profile.ratios.length,gear);
  }else{
    while(gear<profile.ratios.length&&rpmFor(gear)>profile.redline*.82)gear++;
  }
  return {gear,rpm:Math.round(clamp(rpmFor(gear),profile.idle,profile.redline)),redline:profile.redline};
}
export function readTelemetry(config,state,mode){
  const speed=Math.max(0,state.velocity*3.6),drive=transmission(config,speed,mode,state.drag),saved=state.telemetry;
  return {speed,rpm:drive.rpm,gear:drive.gear,coolant:saved?.coolant??82,oil:saved?.oil??(mode==='drag'||mode==='drift'?state.heat:88),
    brakes:mode==='duel'||mode==='timeattack'?state.heat:saved?.brakes??35,
    tireTemp:state.drift?.temperature??state.drag?.temperature??saved?.tireTemp??60,
    tires:state.tires,focus:state.focus};
}
export function attachTelemetry(config,state,sector,card,result){
  const mode=sector.mode||'duel',previous=readTelemetry(config,state,mode),next=result.next;
  const duration=Math.max(result.time,sector.phase==='prep'?2:0);
  const cooling=config.car.cooling*(hasPart(config.parts,'cooling')?config.car.coolerFactor:1);
  const duty=clamp(config.car.power/config.car.mass*3+(card.focus>10?.25:0),.2,1.2);
  const oilTarget=['drag','drift'].includes(mode)?next.heat:85+duty*18*(config.car.engineHeat||1)*(config.car.heatFactor||1)/Math.sqrt(cooling);
  const oil=['drag','drift'].includes(mode)?next.heat:previous.oil+(oilTarget-previous.oil)*(1-Math.exp(-duration*cooling/70));
  const waterTarget=clamp(oil-10,65,135);
  const coolant=previous.coolant+(waterTarget-previous.coolant)*(1-Math.exp(-duration*cooling/90));
  const brakes=['duel','timeattack'].includes(mode)?next.heat:clamp(previous.brakes+(card.method==='brake'?card.heat: -duration*.13),30,200);
  const tireTarget=60+(100-next.tires)*.6+(card.id==='attack'?20:0)-sector.wet*12;
  const tireTemp=next.drift?.temperature??next.drag?.temperature??previous.tireTemp+(tireTarget-previous.tireTemp)*(1-Math.exp(-duration/60));
  return {...result,next:{...next,telemetry:{coolant:clamp(coolant,30,150),oil:clamp(oil,30,200),brakes,tireTemp:clamp(tireTemp,20,180)}}};
}
export function interpolateTelemetry(config,mode,from,to,fraction,drag=null){
  const t=clamp(fraction,0,1),values={};
  for(const key of ['speed','coolant','oil','brakes','tireTemp','tires','focus'])values[key]=from[key]+(to[key]-from[key])*t;
  const drive=transmission(config,values.speed,mode,drag);
  values.gear=drive.gear;values.rpm=values.speed<1?Math.round(from.rpm+(to.rpm-from.rpm)*t):drive.rpm;
  return values;
}
export function sampleTelemetry(config,mode,record,elapsed){
  if(!record.telemetry?.length)return null;
  const index=replayIndex(record.sectorTimes,elapsed),start=record.sectorTimes.slice(0,index).reduce((sum,time)=>sum+time,0);
  const to=record.telemetry[index],from=index?record.telemetry[index-1]:{...to,speed:0,rpm:transmission(config,0,mode).rpm,gear:0};
  const fraction=(elapsed-start)/Math.max(.001,record.sectorTimes[index]);
  const t=clamp(fraction,0,1),sample=interpolateTelemetry(config,mode,from,to,t,record.drag);
  // Replays must retain the recorded manual gear choice, not the final run's
  // automatic strategy (especially early top gear followed by a downshift).
  sample.rpm=Math.round(from.rpm+(to.rpm-from.rpm)*t);sample.gear=t<.5?from.gear:to.gear;
  return sample;
}
export function normalizeTelemetry(raw,count){
  if(!Array.isArray(raw)||raw.length!==count)return null;
  const ranges={speed:[0,600],rpm:[0,10000],gear:[0,6],coolant:[20,160],oil:[20,220],brakes:[20,250],tireTemp:[0,200],tires:[0,100],focus:[0,120]};
  const output=[];
  for(const row of raw){
    if(!row||Object.entries(ranges).some(([key,[min,max]])=>!Number.isFinite(row[key])||row[key]<min||row[key]>max)||!Number.isInteger(row.gear))return null;
    output.push(Object.fromEntries(Object.keys(ranges).map(key=>[key,row[key]])));
  }
  return output;
}
