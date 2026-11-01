import {playerConfiguration} from './player.js';
import {EVENTS,CARDS,PARTS,sectorAt,getEvent} from './data.js';
import {ENGINES,installedEngineId} from './engine-data.js';
import {configuration,freshState,chooseAI,simulate,performanceProfile} from './engine.js';
import {freshDragState} from './drag.js';
import {freshDriftState} from './drift.js';
import {normalizeBuild} from './tuning.js';
import {normalizeSetup} from './setup.js';
import {buildValue} from './special-cups.js';

export function benchDraft(career){return {carId:career.car,engineId:installedEngineId(career),parts:[...career.builds[career.car]],setup:{...career.setups[career.car]},eventId:career.eventId,weather:career.weather};}
export function normalizeBenchDraft(career,raw){
 const draft=raw?.carId===career.car?raw:benchDraft(career);
 const engineId=ENGINES.some(e=>e.id===draft.engineId)?draft.engineId:installedEngineId(career),parts=normalizeBuild(career.car,Array.isArray(draft.parts)?draft.parts:career.builds[career.car],engineId);
 return {carId:career.car,engineId,parts,setup:normalizeSetup(parts,draft.setup),eventId:EVENTS.some(e=>e.id===draft.eventId)?draft.eventId:career.eventId,weather:['dry','mixed','rain'].includes(draft.weather)?draft.weather:career.weather};
}
export function benchmark(config,eventId,weather){
 const event=EVENTS.some(e=>e.id===eventId)?getEvent(eventId,config.routeVersion):null;if(!event||!['dry','mixed','rain'].includes(weather))throw new Error('Выбери трассу и покрытие');
 let state=event.mode==='drag'?freshDragState(config):event.mode==='drift'?freshDriftState(config):freshState(config);
 let peakHeat=state.heat,cornerTime=0,straightTime=0;const sectors=[];
 for(let i=0;i<event.sectors.length;i++){
  const sector=sectorAt(i,weather,eventId,config.routeVersion);
  // Identical neutral road pace; drag/drift use the same deterministic planner, with no execution RNG.
  const card=['duel','timeattack'].includes(event.mode)?CARDS[0]:chooseAI(config,state,sector,Infinity).card;
  const result=simulate(config,state,sector,card);state=result.next;
  peakHeat=Math.max(peakHeat,state.heat);if(sector.type==='corner')cornerTime+=result.time;else straightTime+=result.time;
  sectors.push({name:sector.name,time:result.time,cardId:card.id,speed:result.speed});
 }
 return {time:state.time,score:state.drift?.score??null,peakHeat,tireWear:100-state.tires,focus:state.focus,speed:state.velocity*3.6,cornerTime,straightTime,sectors,profile:performanceProfile(config,eventId,weather),value:buildValue(config)};
}
export function compareBench(career,raw){
 const draft=normalizeBenchDraft(career,raw);
 const baseline=playerConfiguration(configuration(career.car,'ren',career.builds[career.car],100,career.setups[career.car],installedEngineId(career)),career.player);
 const trial=playerConfiguration(configuration(career.car,'ren',draft.parts,100,draft.setup,draft.engineId),career.player);
 baseline.routeVersion=3;trial.routeVersion=3;
 const before=benchmark(baseline,draft.eventId,draft.weather),after=benchmark(trial,draft.eventId,draft.weather),notes=[];
 if(after.profile.power!==before.profile.power)notes.push(after.profile.power>before.profile.power?'Мощность выросла: больше потенциал разгона, но проверь сцепление и температуру.':'Мощность снизилась: меньше потенциал разгона.');
 if(after.profile.mass!==before.profile.mass)notes.push(after.profile.mass<before.profile.mass?'Меньше масса: легче разгон и смена направления.':'Масса выросла: разгон и торможение требуют больше ресурса.');
 if(Math.abs(after.profile.grip-before.profile.grip)>.001)notes.push(after.profile.grip>before.profile.grip?'Выше сцепление на выбранном покрытии.':'На выбранном покрытии сцепление стало ниже.');
 if(after.peakHeat>before.peakHeat+1)notes.push('Пиковый нагрев вырос. На длинной дистанции может потребоваться охлаждение.');
 if(after.tireWear>before.tireWear+.5)notes.push('Шины расходуются быстрее: учти обслуживание между этапами.');
 if(trial.car.airResistance>baseline.car.airResistance)notes.push('Сопротивление воздуху выросло: прижим может стоить времени на прямой.');
 if(!notes.length)notes.push('Основные показатели близки. Сравни время по участкам и ресурс.');
 return {draft,before,after,notes};
}
export function benchPart(career,raw,id,checked){
 if(!PARTS.some(p=>p.id===id))throw new Error('Деталь не найдена');
 const draft=normalizeBenchDraft(career,raw);
 draft.parts=normalizeBuild(career.car,[...draft.parts.filter(p=>p!==id),...(checked?[id]:[])],draft.engineId);draft.setup=normalizeSetup(draft.parts,draft.setup);return draft;
}
