import {emptyPlayer,normalizePlayer,SKILL_CARDS,validTraining,withTraining} from './player.js';
import {emptyRivals,normalizeRivals,getChallenge} from './rivals.js';
import {RACING_LINES,roadMode} from './racing-lines.js';
import {emptyJourney,normalizeJourney} from './journey.js';
import {emptyWear,normalizeWear} from './wear.js';
import {emptyEngines,normalizeEngines} from './powertrain.js';
import {getEngine,installedEngineId} from './engine-data.js';
import {normalizeOrganizer} from './organizer.js';
import {emptyOperations,normalizeOperations} from './operations.js';
import {emptyPresets,normalizePresets} from './presets.js';
import {emptyChampionship,normalizeChampionship} from './championship.js';
import {normalizeSetup,defaultSetup,validSetup,setupKey} from './setup.js';
import {partReason,normalizeBuild} from './tuning.js';
import {START_MONEY} from './balance.js';
import {normalizeTelemetry} from './telemetry.js';
import {emptyTeam,normalizeTeam,normalizeCommandRecord} from './team.js';
import {DRIFT_CARDS} from './drift-data.js';
import {ALL_DRAG_CARDS as DRAG_CARDS} from './drag-data.js';
import {CARS, PILOTS, PARTS, CARDS, EVENTS, getEvent, eventLength} from './data.js';
import {configuration,availableCards} from './engine.js';
import {recordKey} from './progress.js';

// Keep the storage key: v0.1 players migrate in place without losing purchases.
export const SAVE_KEY = 'tokyo-streets-v1';
export function newCareer() {
  return {player:emptyPlayer(),rivals:emptyRivals(),journey:emptyJourney(),version: 2, money: START_MONEY, car: 'ae86', rivalLevel:'equal', pilot: 'ren', ownedCars: ['ae86'],
    builds: Object.fromEntries(CARS.map(c=>[c.id,[]])), purchased: Object.fromEntries(CARS.map(c=>[c.id,[]])),
    condition: Object.fromEntries(CARS.map(c=>[c.id,100])), races: 0, wins: 0,
    street: 0, official: 0, best: null, weather: 'mixed', eventId: 'haruna',
    engines:emptyEngines(),wear:emptyWear(),organizer:{series:[]},operations:emptyOperations(),championships:emptyChampionship(),presets:emptyPresets(),setups:Object.fromEntries(CARS.map(c=>[c.id,defaultSetup()])),eventCompletions:{},repairDebt:0,control:'personal',team:emptyTeam(),helpSeen: false,awardedRuns:[], records: [], bests: [], ghostEnabled: true};
}
const validCar = id => CARS.some(car => car.id === id);
const validPart = id => PARTS.some(part => part.id === id);
const validPilot = id => PILOTS.some(pilot => pilot.id === id);
const validWeather = value => ['dry', 'mixed', 'rain'].includes(value);
const validEvent = id => EVENTS.some(event => event.id === id);
const finite = value => Number.isFinite(value);
const list = value => Array.isArray(value) ? value : [];
const unique = values => [...new Set(values)];
function validateRecord(record) {
  if (!record || record.dnf || !validEvent(record.eventId) || !validCar(record.carId)
      || !validPilot(record.pilotId) || !validWeather(record.weather)) return null;
  const count = getEvent(record.eventId).sectors.length;
  if (!Array.isArray(record.sectorTimes) || record.sectorTimes.length !== count
      || record.sectorTimes.some((time,i) => !finite(time) || time < 0 || (time===0&&getEvent(record.eventId).sectors[i].phase!=='prep') || time > 1000)) return null;
  if (!Array.isArray(record.actions) || record.actions.length !== count
      || record.actions.some(id => ![...CARDS,...DRAG_CARDS,...DRIFT_CARDS,...SKILL_CARDS].some(card => card.id === id))) return null;
  const total = record.sectorTimes.reduce((sum, time) => sum + time, 0);
  if (!finite(record.time) || Math.abs(total - record.time) > .001) return null;
  if(record.engineId!==undefined&&!getEngine(record.engineId))return null;
  const parts = unique(list(record.parts).filter(validPart));
  if(parts.some(id=>partReason(record.carId,id,record.engineId))||normalizeBuild(record.carId,parts,record.engineId).length!==parts.length)return null;
  if(record.setup!==undefined&&!validSetup(parts,record.setup))return null;
  let config = configuration(record.carId, record.pilotId, parts, finite(record.condition) ? record.condition : 100,record.setup,record.engineId,record.wear);
  if(record.training!==undefined){if(!validTraining(record.training))return null;config=withTraining(config,record.training);}
  if(record.slips!==undefined&&(!Array.isArray(record.slips)||record.slips.length!==count||record.slips.some(n=>!finite(n)||n<0||n>50)))return null;
  if(['easy','equal','hard'].includes(record.rivalLevel))config.rivalLevel=record.rivalLevel;
  if(record.challengeId!==undefined){if(!getChallenge(record.challengeId))return null;config.challengeId=record.challengeId;}
  const event=getEvent(record.eventId);
  const cards=availableCards(config,event.mode,event.id);
  if(record.actions.some((id,i)=>!cards.some(card=>card.id===id&&(!card.phase||card.phase==='any'||card.phase===event.sectors[i].phase))))return null;
  if(event.mode==='drag'&&(!record.drag||record.drag.falseStart||!['reaction','sixty','et','trap'].every(key=>finite(record.drag[key])&&record.drag[key]>=0)))return null;
  if(event.longDrag&&!validLongDrag(record,event))return null;
  if(event.mode==='drift'&&!validDriftRecord(record.drift,event))return null;
  if(record.lines!==undefined&&(!roadMode(event.mode)||!Array.isArray(record.lines)||record.lines.length!==count||record.lines.some((id,i)=>!RACING_LINES.some(line=>line.id===id)||(event.sectors[i].type!=='corner'&&id!=='neutral'))))return null;
  const currentKey=recordKey(config,record.eventId,record.weather);
  const suffix=currentKey.slice(currentKey.indexOf('|'));
  const legacyPrefixes=['2','3','4','5','drag-1','drift-1'];
  const key=legacyPrefixes.some(prefix=>record.key===prefix+suffix)?record.key:currentKey;
  const telemetry=normalizeTelemetry(record.telemetry,count);
  const manager=normalizeCommandRecord(record.manager,record.actions,record.pilotId);
  return {key,...(record.training?{training:{...config.training}}:{}),...(record.slips?{slips:[...record.slips]}:{}),...(config.challengeId?{challengeId:config.challengeId}:{}),...(record.lines?{lines:[...record.lines]}:{}),...(config.rivalLevel?{rivalLevel:config.rivalLevel}:{}),...(record.engineId?{engineId:record.engineId}:{}),...(record.wear?{wear:config.wear}:{}),...(setupKey(config.setup)?{setup:{...config.setup}}:{}), ...(Number.isInteger(record.seed)&&record.seed>=0&&record.seed<=4294967295&&record.executionVersion===1?{seed:record.seed,executionVersion:1}:{}), ...(manager?{manager}:{}),...(telemetry?{telemetry}:{}), eventId: record.eventId,
    weather: record.weather, carId: record.carId, pilotId: record.pilotId, parts,
    condition: config.condition, time: record.time, sectorTimes: [...record.sectorTimes], actions: [...record.actions],...(event.mode==='drag'?{drag:{...record.drag}}:event.mode==='drift'?{drift:structuredClone(record.drift)}:{})};
}
function validLongDrag(record,event){
  const d=record.drag,total=eventLength(event);
  if(d.longFormat!==true||!Number.isFinite(d.gearing)||d.gearing<.75||d.gearing>1.25||typeof d.forceTop!=='boolean')return false;
  if(!Number.isFinite(d.distance)||Math.abs(d.distance-total)>.001||Math.abs(d.et+Math.max(0,d.reaction)-record.time)>.001)return false;
  const marks=[402.336,804.672,1609.344].filter(mark=>mark<=total+1e-8);
  if(!Array.isArray(d.splits)||d.splits.length!==marks.length)return false;
  let previous=0;
  for(const [index,split] of d.splits.entries()){
    if(!split||!Number.isFinite(split.distance)||Math.abs(split.distance-marks[index])>1e-6||!Number.isFinite(split.et)||split.et<=previous||split.et>d.et+.001||!Number.isFinite(split.speed)||split.speed<=0||split.speed>600)return false;
    previous=split.et;
  }
  return true;
}
function validDriftRecord(drift,event){
  if(!drift||!Array.isArray(drift.clips)||drift.clips.length!==event.sectors.length)return false;
  if(!finite(drift.score)||drift.score<0||drift.score>event.sectors.length*100)return false;
  for(const key of ['angle','direction','combo','peakCombo','completedChains','breaks','spins','temperature'])if(!finite(drift[key]))return false;
  const count=event.sectors.length;
  if(drift.temperature<25||drift.temperature>160||drift.angle<0||drift.angle>86||![-1,0,1].includes(drift.direction)||typeof drift.active!=='boolean')return false;
  for(const [key,max] of [['combo',4],['peakCombo',4],['completedChains',count/4],['breaks',count],['spins',count]])if(!Number.isInteger(drift[key])||drift[key]<0||drift[key]>max)return false;
  if(drift.combo>drift.peakCombo||drift.spins>drift.breaks)return false;
  for(const [index,clip] of drift.clips.entries()){
    if(!clip||clip.phase!==event.sectors[index].phase||clip.direction!==event.sectors[index].direction)return false;
    for(const key of ['points','line','angle','speed','continuity','penalty'])if(!finite(clip[key])||clip[key]<0||clip[key]>100)return false;
    if(!finite(clip.angleDegrees)||clip.angleDegrees<0||clip.angleDegrees>86||!finite(clip.velocity)||clip.velocity<=0)return false;
    if(typeof clip.spin!=='boolean'||typeof clip.valid!=='boolean'||typeof clip.linked!=='boolean')return false;
    if(clip.spin&&clip.valid||!clip.valid&&clip.points!==0||clip.linked&&!clip.valid)return false;
    const weighted=clip.line*.35+clip.angle*.25+clip.speed*.2+clip.continuity*.2;
    if(Math.abs(weighted-clip.penalty-clip.points)>.001)return false;
  }
  return Math.abs(drift.clips.reduce((sum,clip)=>sum+clip.points,0)-drift.score)<.001;
}
export function validateSave(raw) {
  if (!raw || ![1, 2].includes(raw.version)) throw new Error('Неподдерживаемое сохранение');
  const out = newCareer();
  out.money = finite(raw.money) ? Math.max(0, Math.min(1e9, raw.money)) : START_MONEY;
  out.ownedCars=unique(list(raw.ownedCars).filter(validCar));if(!out.ownedCars.length)out.ownedCars=['ae86'];
  out.car=out.ownedCars.includes(raw.car)?raw.car:out.ownedCars[0];
  out.rivalLevel=['easy','equal','hard'].includes(raw.rivalLevel)?raw.rivalLevel:'equal';
  out.pilot = validPilot(raw.pilot) ? raw.pilot : 'ren';
  out.rivals=normalizeRivals(raw.rivals);
  out.team=normalizeTeam(raw.team);
  out.operations=normalizeOperations(raw.operations);
  if(!out.team.founded)out.operations=emptyOperations();
  out.engines=normalizeEngines(raw.engines);out.wear=normalizeWear(raw.wear);
  out.organizer=normalizeOrganizer(raw.organizer);
  out.championships=normalizeChampionship(raw.championships);
  if(out.championships.active&&!out.ownedCars.includes(out.championships.active.carId))out.championships.active=null;
  out.control=raw.control==='manager'&&out.team.founded&&out.team.contracts.some(contract=>contract.pilotId===out.pilot)?'manager':'personal';
  for (const car of CARS) {
    out.purchased[car.id] = unique(list(raw.purchased?.[car.id]).filter(id=>validPart(id)&&!partReason(car.id,id,installedEngineId(out,car.id))));
    out.builds[car.id] = normalizeBuild(car.id,list(raw.builds?.[car.id]).filter(id => out.purchased[car.id].includes(id)),installedEngineId(out,car.id));
    out.presets[car.id]=normalizePresets(car.id,raw.presets?.[car.id],out.purchased[car.id]);
    out.setups[car.id]=normalizeSetup(out.builds[car.id],raw.setups?.[car.id]);
    out.condition[car.id] = finite(raw.condition?.[car.id])
      ? Math.max(35, Math.min(100, raw.condition[car.id])) : 100;
  }
  for (const key of ['races', 'wins', 'street', 'official']) {
    out[key] = finite(raw[key]) ? Math.max(0, Math.floor(raw[key])) : 0;
  }
  out.repairDebt=finite(raw.repairDebt)?Math.max(0,Math.min(1e7,raw.repairDebt)):0;
  out.eventCompletions=Object.fromEntries(EVENTS.filter(e=>finite(raw.eventCompletions?.[e.id])&&raw.eventCompletions[e.id]>0).map(e=>[e.id,Math.min(100000,Math.floor(raw.eventCompletions[e.id]))]));
  out.best = finite(raw.best) && raw.best > 0 ? raw.best : null;
  out.weather = validWeather(raw.weather) ? raw.weather : 'mixed';
  out.eventId = validEvent(raw.eventId) ? raw.eventId : 'haruna';
  out.helpSeen = raw.helpSeen === true;
  out.ghostEnabled = raw.ghostEnabled !== false;
  out.awardedRuns=unique(list(raw.awardedRuns).filter(id=>typeof id==='string'&&id.length>0&&id.length<=80)).slice(-256);
  out.records = list(raw.records).slice(0, 30)
    .filter(record => record && finite(record.time) && record.time > 0 && typeof record.won === 'boolean')
    .map(record => ({car: CARS.find(car => car.name === record.car)?.name || CARS[0].name,
      time: record.time, won: record.won, eventId: validEvent(record.eventId) ? record.eventId : 'haruna',
      weather: validWeather(record.weather) ? record.weather : 'mixed',
      medal: ['gold', 'silver', 'bronze'].includes(record.medal) ? record.medal : null,...(record.dnf===true?{dnf:true}:{}),
      ...(getEvent(record.eventId).mode==='drag'?{falseStart:record.falseStart===true}:getEvent(record.eventId).mode==='drift'?{score:finite(record.score)?Math.max(0,Math.min(800,record.score)):0}:{})}));
  // v1 records have no trace. Keep their history, but do not invent ghosts.
  const valid = list(raw.bests).slice(0, 120).map(validateRecord).filter(Boolean);
  const bestByKey = new Map();
  for (const record of valid) {
    if (!bestByKey.has(record.key) || (record.drift?record.drift.score>bestByKey.get(record.key).drift.score||record.drift.score===bestByKey.get(record.key).drift.score&&record.time<bestByKey.get(record.key).time:bestByKey.get(record.key).time > record.time)) bestByKey.set(record.key, record);
  }
  out.bests = [...bestByKey.values()];
  out.player=normalizePlayer(raw.player,out);
  out.journey=normalizeJourney(raw.journey,out);
  return out;
}
export function loadCareer(storage) {
  try { const data = storage.getItem(SAVE_KEY); return data ? validateSave(JSON.parse(data)) : newCareer(); }
  catch { return newCareer(); }
}
export function storeCareer(storage, career) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(career)); return true; }
  catch { return false; }
}
