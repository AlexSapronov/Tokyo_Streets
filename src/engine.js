import {lineGeometry,lineReason,lineCard,lineName,RACING_LINES,roadMode} from './racing-lines.js';
import {engineCar,stockEngineId,getEngine} from './engine-data.js';
import {normalizeComponentWear,wornCar,tireKey} from './wear.js';
import {orderPolicy} from './ai-policy.js';
import {normalizeSetup} from './setup.js';
import {tunedCar,normalizeBuild,tireFactor,aeroGrip} from './tuning.js';
import {raceClass,incidentPrice,rewardFactor} from './balance.js';
import {executionRoll,newSeed,hashSeed,applyRunOff,runOffChance} from './execution.js';
import {attachTelemetry,readTelemetry,transmission} from './telemetry.js';
import {freshDriftState,driftReason,simulateDrift,driftCards} from './drift.js';
import {repetitionEffect,rememberAction,focusCost,strainAfter,strainEffect} from './tactics.js';
import {freshDragState,dragReason,simulateDrag,dragCards} from './drag.js';
import {CARS,PILOTS,CARDS,sectorAt,getEvent} from './data.js';
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function configuration(carId,pilotId,parts=[],condition=100,rawSetup={},engineId=null,rawWear={}){
 const car=CARS.find(c=>c.id===carId)||CARS[0],pilot=PILOTS.find(p=>p.id===pilotId)||PILOTS[0];
 const motor=getEngine(engineId)?engineId:stockEngineId(car.id),wear=normalizeComponentWear(rawWear),installed=normalizeBuild(car.id,Array.isArray(parts)?parts:[],motor);
 const setup=normalizeSetup(installed,rawSetup);
 return {car:tunedCar(wornCar(engineCar(car,motor),wear),installed,setup,wear),engineId:motor,wear,tireCondition:wear[tireKey(installed)],setup,pilot,parts:installed,condition:clamp(Number.isFinite(condition)?condition:100,35,100)};
}
// Ratings use the healthy installed build, so deliberate wear cannot buy easier opposition.
export function nominalConfiguration(config){return configuration(config.car.id,'ren',config.parts,100,config.setup,config.engineId);}
export function performanceProfile(config,eventId='haruna',weather='dry'){
 const event=getEvent(eventId),mass=config.car.mass-(config.parts.includes('weight')?65:0)+(config.parts.includes('suspension')?8:0);
 let grip=0,length=0;
 for(let i=0;i<event.sectors.length;i++){
  const sector=sectorAt(i,weather,eventId),wet=sector.wet;
  const effective=config.car.grip*tireFactor(config,wet,true,event.mode==='drag'?'drag':'road')*(config.parts.includes('suspension')?1.05:1)*aeroGrip(config,sector.type==='corner'?30:55);
  grip+=effective*sector.length;length+=sector.length;
 }
 grip/=length;
 const powerWeight=config.car.power/mass;
 return {mass,power:config.car.power,grip,powerWeight,kgPerHp:mass/config.car.power,rating:100*(powerWeight/(130/940))**(event.mode==='drag'?.9:.65)*(grip/1.02)**(event.mode==='drag'?.1:.35)};
}
export const RIVAL_LEVELS=[{id:'easy',name:'Слабее',factor:.8,reward:.7},{id:'equal',name:'На равных',factor:1,reward:1},{id:'hard',name:'Сильнее',factor:1.2,reward:1.35}];
const rivalsCache=new Map();
export function freeRivalOptions(config,eventId,weather='dry'){
 const player=nominalConfiguration(config),profile=performanceProfile(player,eventId,weather),event=getEvent(eventId);
 const key=JSON.stringify([player.car,player.parts,player.setup,eventId,weather]);
 if(rivalsCache.has(key))return structuredClone(rivalsCache.get(key));
 const candidates=CARS.flatMap(car=>[[],['streetTires','lsd'],['ecu','exhaust','cooling','tires','lsd','brakes'],['ecu','turbo','cams','exhaust','intercooler','suspension','slicks','brakes']].map(parts=>configuration(car.id,event.rivalPilot,parts)));
 const options=RIVAL_LEVELS.map(level=>{
  const target=profile.rating*level.factor;
  const fits=candidates.map(rival=>({rival,profile:performanceProfile(rival,eventId,weather)})).filter(c=>level.id==='easy'?c.profile.rating<profile.rating*.9:level.id==='hard'?c.profile.rating>profile.rating*1.1:Math.abs(c.profile.rating/profile.rating-1)<.08);
  const closest=fits.sort((a,b)=>Math.abs(a.profile.rating-target)-Math.abs(b.profile.rating-target))[0];
  let rival,prepared=false;
  if(closest)rival=closest.rival;
  else{
   // At the extremes of the catalogue, show a prepared variant with explicit power.
   rival=configuration(player.car.id,event.rivalPilot,player.parts,100,player.setup,player.engineId);
   const current=performanceProfile(rival,eventId,weather).rating;
   rival.car.power=Math.max(1,Math.round(rival.car.power*(target/current)**(1/(event.mode==='drag'?.9:.65))));prepared=true;
  }
  return {...level,rival,prepared,profile:performanceProfile(rival,eventId,weather),playerRating:profile.rating};
 });
 if(rivalsCache.size>=128)rivalsCache.clear();rivalsCache.set(key,options);return structuredClone(options);
}
export function freshState(config){return {time:0,tires:config.tireCondition??100,heat:55,focus:config.pilot.focus,study:false,velocity:16,cooldowns:{},recentActions:[]};}
export function availableCards(config,mode='duel',context=null){if(mode==='drag')return dragCards(typeof context==='string'?getEvent(context).longDrag:context?.longDrag);if(mode==='drift')return driftCards();return CARDS.filter(c=>(!c.pilot||c.pilot===config.pilot.id)&&(!c.part||config.parts.includes(c.part)));}
export function disabledReason(card,sector,state,config,gap=0){
 if(sector.mode==='drift')return driftReason(card,sector,state,config);
 if(sector.mode==='drag')return dragReason(card,sector,state,config);
 if(card.phase)return 'Карта только для дрэга';
 if(sector.mode==='timeattack'&&(card.category==='Дуэль'||card.gap))return 'В одиночной сессии нет соперника';
 if(card.only==='corner'&&sector.type!=='corner')return 'Нужен поворот';
 if(card.only==='straight'&&sector.type!=='straight')return 'Нужна прямая';
 if(card.only==='wet'&&sector.wet<.35)return 'Нужно мокрое покрытие';
 if(card.gap==='behind'&&!(gap>0&&gap<2.5))return 'Нужно отставание от 0 до 2.5 с';
 if(card.gap==='ahead'&&!(gap<0&&gap> -2.5))return 'Нужно лидерство до 2.5 с';
 if(card.gap==='close'&&Math.abs(gap)>2.5)return 'Соперник дальше 2.5 с';
 if((state.cooldowns[card.id]||0)>0)return `Откат: ${state.cooldowns[card.id]} сектор`;
 const cost=focusCost(config,state,card);
 if(cost>state.focus)return `Нужно ${Math.ceil(cost)} концентрации с учётом повторов`;
 if(card.id==='late'&&state.heat>155)return 'Тормоза перегреты (>155°C)';
 return '';
}
function simulateRaw(config,state,sector,card,execution=null){
 if(sector.mode==='drift')return simulateDrift(config,state,sector,card,execution);
 if(sector.mode==='drag')return simulateDrag(config,state,sector,card,execution);
 const line=lineGeometry(card.lineId,sector,config.car);
 const repeat=repetitionEffect(state,card);
 const strain=strainEffect(state,card);
 const {car,pilot,parts}=config,has=id=>parts.includes(id),corner=sector.type==='corner';
 // SI units: metric hp -> watts, kg, m/s. A bounded sector approximation,
 // not a wheel-level simulator. Both drivers use exactly this function.
 const mass=car.mass-(has('weight')?65:0)+(has('suspension')?8:0);
 const grip=car.grip*(1-sector.wet*(car.drive==='AWD'?.28:.4))*tireFactor(config,sector.wet)*aeroGrip(config,state.velocity)*(has('suspension')?1+.05*car.partSuspensionHealth:1)*(.7+.3*state.tires/100)*(.88+.12*config.condition/100);
 const brakeFade=clamp(1-Math.max(0,state.heat-105)/280,.65,1);
 const brake=car.brakes*(has('brakes')?car.partBrakeFactor:1)*brakeFade;
 const rpm=transmission(config,state.velocity*3.6);
 const band=parts.some(id=>['shortFinal','longFinal','cams','flywheel'].includes(id))?clamp(1-((rpm.rpm/rpm.redline-.8)/.8)**2,.75,1)*(rpm.rpm/rpm.redline<.6?car.lowRpmFactor:1):1;
 const power=car.power*735.5*.78*(.9+.1*config.condition/100)*band;
 const terminal=Math.cbrt(power/car.airResistance);
 const traction=(car.drive==='AWD'?1.09:1)*(has('lsd')?1+.05*car.partLsdHealth:1)*(car.drive==='FF'?.93:car.drive==='MR'?1.035:1);
 const cornerSpeed=corner?Math.sqrt(grip*9.81*sector.radius*line.radius):terminal;
 const accel=Math.min(grip*9.81*traction,power/(mass*Math.max(state.velocity,18)))-9.81*sector.slope-(car.rollingFactor-1)*.12;
 const exit=corner?Math.min(terminal,cornerSpeed+accel*1.5):Math.min(terminal,Math.sqrt(state.velocity**2+2*accel*sector.length));
 const average=corner?cornerSpeed*.87+exit*.13:Math.max(18,(state.velocity+exit)*.5);
 const braking=corner?Math.max(0,state.velocity-cornerSpeed)/(grip*9.81*brake)*.45:0;
 const entryLoss=corner?Math.max(0,cornerSpeed-state.velocity)*.035:0;
 const baseTime=sector.length*line.length/average+braking+entryLoss;
 let gain=card.gain*pilot.aggression*(.7+.3*pilot.skill)+(state.study?.015:0);
 if(card.id==='late')gain*=has('brakes')?1.15:brakeFade;
 if(card.id==='weight')gain*=(has('suspension')?1.18:1)*clamp(1100/mass,.8,1.2);
 if(card.id==='apexEarly')gain*=sector.radius<50?1.25:-.5;
 if(card.id==='power')gain*=traction*(sector.wet>.35&&['FR','MR'].includes(car.drive)&&!has('lsd')?.45:1);
 if(card.id==='safe'&&sector.wet>.35)gain+=.015;
 const risk=clamp(card.risk+line.risk+strain.risk+car.setupRisk+sector.wet*.22+(1-pilot.skill)*.3+(car.drive==='MR'?.025:car.drive==='FF'&&card.id==='power'?.04:0)+Math.max(0,65-state.focus)/250+Math.max(0,60-state.tires)/160+Math.max(0,state.heat-110)/320-(has('lsd')&&card.id==='power'?.1:0),0,.85);
 // Baseline slip is predictable; execution adds bounded variation only when resolving.
 const slip=Math.max(0,risk-.28)*(corner?5:2.5);
 const unpenalized=baseTime*(1-clamp(gain,-.09,.08))+slip;
 const time=unpenalized*repeat.timeFactor*strain.timeFactor*(1+(execution?.error||0));
 const wear=(corner?2.1:1.05)*card.wear*(has('tires')?1.25:1)*(car.drive==='AWD'?1.12:car.drive==='FF'?1.1:1)*(mass/1100)*repeat.wearFactor*car.wearFactor*line.wear;
 const heat=(corner?12: -10)*(mass/1100)+card.heat;
 const repetitionHeat=card.heat>=0?repeat.heatExtra:0;
 const cooled=(heat>0?heat*car.heatFactor*(car.engineHeat||1)*(has('brakes')?car.partBrakeHeatFactor:1)*(car.brakeHeatFactor||1):heat*car.cooling*(has('cooling')?car.coolerFactor:1)*repeat.recoveryFactor)+repetitionHeat;
 const actionFocus=focusCost(config,state,card);
 const cooldowns=Object.fromEntries(Object.entries(state.cooldowns).map(([k,v])=>[k,Math.max(0,v-1)]));
 if(['attack','dive','study','thermal'].includes(card.id))cooldowns[card.id]=1;
 const next={time:state.time+time,tires:clamp(state.tires-wear,0,100),heat:clamp(state.heat+cooled,35,200),focus:clamp(state.focus-actionFocus,0,pilot.focus),study:card.id==='study',recentActions:rememberAction(state,card),velocity:Math.min(terminal,exit*line.exit)*(slip>0?.92:1)*(card.id==='late'?.94:card.id==='power'?1.025:card.id==='apexEarly'?.97:card.id==='defend'?.96:1),cooldowns};
 const reasons=[corner?`Радиус ${sector.radius} м: предел дуги ${Math.round(cornerSpeed*3.6)} км/ч`:`${car.power} л.с. / ${mass} кг: разгон до ${Math.round(exit*3.6)} км/ч`];
 if(card.lineId&&card.lineId!=='neutral')reasons.push('Траектория «'+lineName(card.lineId)+'»: изменены длина дуги и скорость следующего входа');
 if(strain.strain>2)reasons.push('Накопленная нагрузка от атак: смена приёма не снимает напряжение');
 if(['late','apexEarly','power','defend'].includes(card.id))reasons.push('Траектория изменила скорость входа в следующий сектор');
 if(repeat.repeats)reasons.push(`Повтор приёма ${repeat.repeats+1}: нагрузка растёт экспоненциально, потеря ${(time-unpenalized).toFixed(2)} с`);
 if(sector.wet>.35)reasons.push(`Мокрое покрытие ${Math.round(sector.wet*100)}%: сцепление снижено`);
 if(brakeFade<1)reasons.push(`Перегрев: эффективность тормозов ${Math.round(brakeFade*100)}%`);
 if(slip>.001)reasons.push(`Предел сцепления превышен: +${slip.toFixed(2)} с`);
 if(state.study)reasons.push('Изучение соперника: +1.5% реализации темпа');
 if(has('brakes')&&card.id==='late')reasons.push('Brembo: эффективнее поздний вход и меньше нагрев');
 if(has('lsd')&&card.id==='power')reasons.push('CUSCO LSD: лучше реализация тяги');
 return {time,next,risk,slip,speed:exit*3.6,gain:baseTime-time,reasons};
}
export function simulate(config,state,sector,card,execution=null){
  const blocked=lineReason(card.lineId||'neutral',sector);if(blocked)throw new Error(blocked);
  const result=simulateRaw(config,state,sector,card,execution);
  result.next.strain=strainAfter(state,card);
  result.risk=clamp(result.risk+(sector.mode==='drag'?strainEffect(state,card).risk:0),0,1);
  if(execution){
    result.execution={...execution};
    result.reasons.push(`Разброс исполнения при фокусе ${Math.round(execution.focus)}; ${Math.abs(execution.roll)<.25?'небольшое отклонение':Math.abs(execution.roll)<.7?'заметное отклонение':'край диапазона'}`);
  }
  return attachTelemetry(config,state,sector,card,applyRunOff(result,sector,card));
}
// Three-sector beam search: resource decisions can pay off in the next two sectors.
// Future positions are unknown, so future branches omit positional duel actions.
export function chooseAI(config, state, sector, gap = 0, upcoming = [], policy = null) {
  const cards = availableCards(config,sector.mode,sector);
  const candidates = cards.filter(card => !disabledReason(card, sector, state, config, gap));
  const resourcePrice = state => policy? (state.drag?.falseStart?1000:0)+policy.resourcePrice(state) : (state.drag?.falseStart ? 1000 : 0) + Math.max(0, 60 - state.focus) * .012
    + Math.max(0, state.heat - 115) * .009 + (100 - state.tires) * .008;
  const stepCost=(action,result,current,focus)=> (policy?policy.stepCost(action,result,current):current.mode==='drift'?-result.clip.points/12:result.time)+incidentPrice(runOffChance(focus,result.risk,current,action),config,1+upcoming.length);
  const scored = candidates.map(card => {
    const result = simulate(config, state, sector, card);
    let beam = [{state: result.next, cost: stepCost(card,result,sector,state.focus), plan: [card.name]}];
    for (const nextSector of upcoming.slice(0, 2)) {
      const expanded = [];
      for (const node of beam) {
        for (const action of cards) {
          if (action.gap || disabledReason(action, nextSector, node.state, config)) continue;
          const step = simulate(config, node.state, nextSector, action);
          expanded.push({state: step.next, cost: node.cost + stepCost(action,step,nextSector,node.state.focus), plan: [...node.plan, action.name]});
        }
      }
      beam = expanded.sort((a,b) => a.cost + resourcePrice(a.state) - b.cost - resourcePrice(b.state)).slice(0, 5);
    }
    const best = beam[0];
    return {card, result, score: best.cost + resourcePrice(best.state) - (card.id==='defend'?.35:0), plan: best.plan};
  });
  return scored.sort((a,b) => a.score - b.score)[0];
}
export function chooseRacingLine(config,state,sector,card,nextSector,style=null){
 const policy=orderPolicy(style);
 return RACING_LINES.filter(line=>!lineReason(line.id,sector)).map(line=>{
  const action=lineCard(card,line.id),result=simulate(config,state,sector,action);
  const next=nextSector?simulate(config,result.next,nextSector,CARDS[0]):null;
  const score=result.time+(next?.time||0)+incidentPrice(runOffChance(state.focus,result.risk,sector,action),config,2)+(policy?.resourcePrice(result.next)||0)+(100-result.next.tires)*.01;
  return {card:action,result,score};
 }).sort((a,b)=>a.score-b.score)[0];
}
export function futureSectors(race) {
  return getEvent(race.eventId).sectors.slice(race.index + 1, race.index + 3)
    .map((_, offset) => sectorAt(race.index + offset + 1, race.weather, race.eventId));
}
export function createRace(config, weather = 'mixed', eventId = 'haruna',runId=null,seed=null,rivalLevel=null) {
  const event = getEvent(eventId);
  const category=raceClass(config);
  const offer=rivalLevel&&['duel','drag'].includes(event.mode)?freeRivalOptions(config,eventId,weather).find(o=>o.id===rivalLevel):null;
  if(rivalLevel&&!RIVAL_LEVELS.some(o=>o.id===rivalLevel))throw new Error('Неизвестный уровень соперника');
  if(offer)config={...config,rivalLevel:offer.id};
  const rival=offer?.rival||configuration(event.rivalCar,event.rivalPilot,event.rivalParts,100);
  return {config, rival, category,...(offer?{rivalLevel:offer.id,difficultyReward:offer.reward,rivalName:offer.name+' · '+offer.rival.pilot.name}:{}),...(event.mode==='timeattack'?{targets:medalTargets(eventId,weather,config)}:{}),rewardScale:1, weather,runId, seed:Number.isInteger(seed)?seed>>>0:runId?hashSeed(runId):newSeed(), eventId: event.id, mode: event.mode, index: 0,
    player: event.mode==='drag'?freshDragState(config):event.mode==='drift'?freshDriftState(config):freshState(config), opponent: event.mode==='drag'?freshDragState(rival):freshState(rival), history: [], finished: false, awarded: false};
}
export function resolveSector(race, cardId, lineId='neutral') {
  if (race.finished) throw new Error('Заезд уже завершён');
  const event = getEvent(race.eventId);
  const sector = sectorAt(race.index, race.weather, race.eventId);
  const baseCard = availableCards(race.config,race.mode,race.eventId).find(card => card.id === cardId);
  const card=baseCard?lineCard(baseCard,lineId):null;
  if (!card) throw new Error('Карта недоступна');
  const gap = race.opponent.dnf?Infinity:race.player.time - race.opponent.time;
  const reason = disabledReason(card, sector, race.player, race.config, gap);
  if (reason) throw new Error(reason);
  const seed=race.seed??hashSeed(race.runId||'legacy');
  const player = simulate(race.config, race.player, sector, card,executionRoll(seed,race.index,'player',race.player.focus));
  const ai = ['duel','drag'].includes(race.mode)&&!race.opponent.dnf
    ? chooseAI(race.rival, race.opponent, sector, -gap, futureSectors(race),race.rivalStyle?orderPolicy(race.rivalStyle):null) : null;
  if(ai&&roadMode(race.mode)){
    const choice=chooseRacingLine(race.rival,race.opponent,sector,ai.card,futureSectors(race)[0],race.rivalStyle);
    ai.card=choice.card;ai.plan[0]+=' / '+lineName(ai.card.lineId);
  }
  if(ai)ai.result=simulate(race.rival,race.opponent,sector,ai.card,executionRoll(seed,race.index,'opponent',race.opponent.focus));
  if (card.id === 'defend' && ai) { ai.result.time += .35; ai.result.next.time += .35; }
  if (ai?.card.id === 'defend') {
    player.time += .35; player.next.time += .35;
    player.reasons.push('Соперник закрыл траекторию: +0.35 с');
  }
  const row = {index: race.index, sector: sector.name, cardId, card: card.name,
    ...(roadMode(race.mode)?{lineId,aiLineId:ai?.card.lineId||'neutral'}:{}),
    aiSlip:ai?.result.slip||0,aiCard: ai?.card.name || (race.opponent.dnf?'Сход соперника':'—'), aiPlan: ai?.plan || [],
    playerTime: player.time, aiTime: ai?.result.time ?? null,
    gap: ai&&!player.next.dnf&&!ai.result.next.dnf ? player.next.time - ai.result.next.time : null,
    execution:player.execution,aiExecution:ai?.result.execution||null,aiReasons:ai?.result.reasons||[],
    risk: player.risk, speed: player.speed, slip: player.slip, reasons: player.reasons,
    tires: player.next.tires, heat: player.next.heat, focus: player.next.focus,telemetry:readTelemetry(race.config,player.next,race.mode),
    ...(player.clip?{drift:player.clip}:{})};
  return {...race, index: race.index + 1, player: player.next,
    opponent: ai?.result.next || race.opponent, history: [...race.history, row],
    finished: isRaceFinished(player.next,ai?.result.next||race.opponent,race.index+1,event.sectors.length)};
}

// A duel ends as soon as either car is out. No more player cards are required.
export function isRaceFinished(player,opponent,index,sectorCount){
 return !!player?.dnf || !!opponent?.dnf || index >= sectorCount;
}

// A neutral Ren drives the exact healthy build through the shared physical model.
// This continuously accounts for mass/power, wet grip, brakes, gearing and aero.
const targetCache=new Map();
export function medalTargets(eventId,weather,build='expert'){
 const config=typeof build==='string'?configuration(build==='club'?'ae86':build==='sport'?'chaser':'evo','ren'):nominalConfiguration(build);
 const key=JSON.stringify([eventId,weather,config.car,config.parts,config.setup]);
 if(targetCache.has(key))return {...targetCache.get(key)};
 let state=freshState(config);
 for(let i=0;i<getEvent(eventId).sectors.length;i++)state=simulate(config,state,sectorAt(i,weather,eventId),CARDS[0]).next;
 const reference=state.time,gold=reference*.955,silver=Math.max(gold+1,reference*.99),bronze=Math.max(silver+1,reference*1.04);
 const targets={gold,silver,bronze};if(targetCache.size>=256)targetCache.clear();targetCache.set(key,targets);return {...targets};
}
function baseOutcome(race) {
  const event = getEvent(race.eventId);
  if(race.player.dnf)return {won:false,medal:null,label:'Сход · вылет с трассы',reward:0,street:0,official:0};
  if (race.mode === 'duel' || race.mode === 'drag') {
    const won = !race.player.drag?.falseStart && (!!race.opponent.dnf || race.opponent.drag?.falseStart || race.player.time < race.opponent.time);
    return {won, medal: null, label: race.player.drag?.falseStart ? 'Фальстарт' : won ? race.opponent.dnf?'Победа · сход соперника':'Победа' : 'Без победы',
      reward: race.player.drag?.falseStart ? 0 : won ? event.prize : event.participation, street: race.mode==='drag'?0:won?12:4, official: race.mode==='drag'?(won?10:race.player.drag.falseStart?0:3):0};
  }
  if(race.mode==='drift'){
    const medal=['gold','silver','bronze'].find(level=>race.player.drift.score>=event.medals[level])||null;
    return {won:false,medal,label:{gold:'Золото',silver:'Серебро',bronze:'Бронза'}[medal]||'Сессия завершена',
      reward:{gold:22000,silver:14000,bronze:8500}[medal]||event.participation,street:0,official:{gold:12,silver:7,bronze:3}[medal]||1};
  }
  const targets = race.targets||medalTargets(event.id,race.weather,race.config);
  const medal = ['gold', 'silver', 'bronze'].find(level => race.player.time <= targets[level]) || null;
  return {won: false, medal,
    label: {gold: 'Золото', silver: 'Серебро', bronze: 'Бронза'}[medal] || 'Сессия завершена',
    reward: {gold: 16000, silver: 10000, bronze: 6500}[medal] || event.participation,
    street: 0, official: {gold: 12, silver: 7, bronze: 3}[medal] || 1};
}

export function raceOutcome(race){
 const outcome=baseOutcome(race);
 return {...outcome,reward:Math.round(outcome.reward*rewardFactor(race.config,race.mode)*(race.rewardScale??1)*(race.season?1:race.difficultyReward??1))};
}
