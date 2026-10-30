import {freshDriftState,driftReason,simulateDrift,driftCards} from './drift.js';
import {repetitionEffect,rememberAction,focusCost} from './tactics.js';
import {freshDragState,dragReason,simulateDrag,dragCards} from './drag.js';
import {CARS,PILOTS,CARDS,sectorAt,getEvent} from './data.js';
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function configuration(carId,pilotId,parts=[],condition=100){
 const car=CARS.find(c=>c.id===carId)||CARS[0],pilot=PILOTS.find(p=>p.id===pilotId)||PILOTS[0];
 return {car,pilot,parts:[...new Set(Array.isArray(parts)?parts:[])],condition:clamp(Number.isFinite(condition)?condition:100,35,100)};
}
export function freshState(config){return {time:0,tires:100,heat:55,focus:config.pilot.focus,study:false,velocity:16,cooldowns:{},recentActions:[]};}
export function availableCards(config,mode='duel'){if(mode==='drag')return dragCards();if(mode==='drift')return driftCards();return CARDS.filter(c=>(!c.pilot||c.pilot===config.pilot.id)&&(!c.part||config.parts.includes(c.part)));}
export function disabledReason(card,sector,state,config,gap=0){
 if(sector.mode==='drift')return driftReason(card,sector,state,config);
 if(sector.mode==='drag')return dragReason(card,sector,state);
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
export function simulate(config,state,sector,card){
 if(sector.mode==='drift')return simulateDrift(config,state,sector,card);
 if(sector.mode==='drag')return simulateDrag(config,state,sector,card);
 const repeat=repetitionEffect(state,card);
 const {car,pilot,parts}=config,has=id=>parts.includes(id),corner=sector.type==='corner';
 // SI units: metric hp -> watts, kg, m/s. A bounded sector approximation,
 // not a wheel-level simulator. Both drivers use exactly this function.
 const mass=car.mass-(has('weight')?65:0)+(has('suspension')?8:0);
 const grip=car.grip*(1-sector.wet*(car.drive==='AWD'?.28:.4))*(has('tires')?(sector.wet>.35?.93:1.12):1)*(has('suspension')?1.05:1)*(.7+.3*state.tires/100)*(.88+.12*config.condition/100);
 const brakeFade=clamp(1-Math.max(0,state.heat-105)/280,.65,1);
 const brake=car.brakes*(has('brakes')?1.18:1)*brakeFade;
 const power=car.power*735.5*.78*(.9+.1*config.condition/100);
 const terminal=Math.cbrt(power/.43);
 const traction=(car.drive==='AWD'?1.09:1)*(has('lsd')?1.05:1);
 const cornerSpeed=corner?Math.sqrt(grip*9.81*sector.radius):terminal;
 const accel=Math.min(grip*9.81*traction,power/(mass*Math.max(state.velocity,18)))-9.81*sector.slope;
 const exit=corner?Math.min(terminal,cornerSpeed+accel*1.5):Math.min(terminal,Math.sqrt(state.velocity**2+2*accel*sector.length));
 const average=corner?cornerSpeed*.87+exit*.13:Math.max(18,(state.velocity+exit)*.5);
 const braking=corner?Math.max(0,state.velocity-cornerSpeed)/(grip*9.81*brake)*.45:0;
 const baseTime=sector.length/average+braking;
 let gain=card.gain*pilot.aggression*(.7+.3*pilot.skill)+(state.study?.015:0);
 if(card.id==='late')gain*=has('brakes')?1.15:brakeFade;
 if(card.id==='weight')gain*=has('suspension')?1.18:1;
 if(card.id==='apexEarly')gain*=sector.radius<50?1.25:-.5;
 if(card.id==='power')gain*=traction*(sector.wet>.35&&car.drive==='FR'&&!has('lsd')?.45:1);
 if(card.id==='safe'&&sector.wet>.35)gain+=.015;
 const risk=clamp(card.risk+sector.wet*.22+(1-pilot.skill)*.3+Math.max(0,65-state.focus)/250+Math.max(0,60-state.tires)/160+Math.max(0,state.heat-110)/320-(has('lsd')&&card.id==='power'?.1:0),0,.85);
 // No dice rolls. Above the safety margin, tire slip causes a visible time loss.
 const slip=Math.max(0,risk-.28)*(corner?5:2.5);
 const unpenalized=baseTime*(1-clamp(gain,-.09,.08))+slip;
 const time=unpenalized*repeat.timeFactor;
 const wear=(corner?2.1:1.05)*card.wear*(has('tires')?1.25:1)*(car.drive==='AWD'?1.12:1)*(mass/1100)*repeat.wearFactor;
 const heat=(corner?12: -10)*(mass/1100)+card.heat;
 const repetitionHeat=card.heat>=0?repeat.heatExtra:0;
 const cooled=(heat>0?heat*(has('brakes')?.7:1):heat*car.cooling*(has('cooling')?1.3:1)*repeat.recoveryFactor)+repetitionHeat;
 const actionFocus=focusCost(config,state,card);
 const cooldowns=Object.fromEntries(Object.entries(state.cooldowns).map(([k,v])=>[k,Math.max(0,v-1)]));
 if(['attack','dive','study','thermal'].includes(card.id))cooldowns[card.id]=1;
 const next={time:state.time+time,tires:clamp(state.tires-wear,0,100),heat:clamp(state.heat+cooled,35,200),focus:clamp(state.focus-actionFocus,0,pilot.focus),study:card.id==='study',recentActions:rememberAction(state,card),velocity:exit*(slip>0?.92:1),cooldowns};
 const reasons=[corner?`Радиус ${sector.radius} м: предел дуги ${Math.round(cornerSpeed*3.6)} км/ч`:`${car.power} л.с. / ${mass} кг: разгон до ${Math.round(exit*3.6)} км/ч`];
 if(repeat.repeats)reasons.push(`Повтор приёма ${repeat.repeats+1}: нагрузка растёт экспоненциально, потеря ${(time-unpenalized).toFixed(2)} с`);
 if(sector.wet>.35)reasons.push(`Мокрое покрытие ${Math.round(sector.wet*100)}%: сцепление снижено`);
 if(brakeFade<1)reasons.push(`Перегрев: эффективность тормозов ${Math.round(brakeFade*100)}%`);
 if(slip>.001)reasons.push(`Предел сцепления превышен: +${slip.toFixed(2)} с`);
 if(state.study)reasons.push('Изучение соперника: +1.5% реализации темпа');
 if(has('brakes')&&card.id==='late')reasons.push('Brembo: эффективнее поздний вход и меньше нагрев');
 if(has('lsd')&&card.id==='power')reasons.push('CUSCO LSD: лучше реализация тяги');
 return {time,next,risk,slip,speed:exit*3.6,gain:baseTime-time,reasons};
}
// Three-sector beam search: resource decisions can pay off in the next two sectors.
// Future positions are unknown, so future branches omit positional duel actions.
export function chooseAI(config, state, sector, gap = 0, upcoming = []) {
  const cards = availableCards(config,sector.mode);
  const candidates = cards.filter(card => !disabledReason(card, sector, state, config, gap));
  const resourcePrice = state => (state.drag?.falseStart ? 1000 : 0) + Math.max(0, 60 - state.focus) * .012
    + Math.max(0, state.heat - 115) * .009 + (100 - state.tires) * .008;
  const scored = candidates.map(card => {
    const result = simulate(config, state, sector, card);
    let beam = [{state: result.next, cost: sector.mode==='drift'?-result.clip.points/12:result.time, plan: [card.name]}];
    for (const nextSector of upcoming.slice(0, 2)) {
      const expanded = [];
      for (const node of beam) {
        for (const action of cards) {
          if (action.gap || disabledReason(action, nextSector, node.state, config)) continue;
          const step = simulate(config, node.state, nextSector, action);
          expanded.push({state: step.next, cost: node.cost + (sector.mode==='drift'?-step.clip.points/12:step.time), plan: [...node.plan, action.name]});
        }
      }
      beam = expanded.sort((a,b) => a.cost + resourcePrice(a.state) - b.cost - resourcePrice(b.state)).slice(0, 5);
    }
    const best = beam[0];
    return {card, result, score: best.cost + resourcePrice(best.state) - (card.id==='defend'?.35:0), plan: best.plan};
  });
  return scored.sort((a,b) => a.score - b.score)[0];
}
export function futureSectors(race) {
  return getEvent(race.eventId).sectors.slice(race.index + 1, race.index + 3)
    .map((_, offset) => sectorAt(race.index + offset + 1, race.weather, race.eventId));
}
export function createRace(config, weather = 'mixed', eventId = 'haruna',runId=null) {
  const event = getEvent(eventId);
  const rival = configuration(event.rivalCar, event.rivalPilot, event.rivalParts, 100);
  return {config, rival, weather,runId, eventId: event.id, mode: event.mode, index: 0,
    player: event.mode==='drag'?freshDragState(config):event.mode==='drift'?freshDriftState(config):freshState(config), opponent: event.mode==='drag'?freshDragState(rival):freshState(rival), history: [], finished: false, awarded: false};
}
export function resolveSector(race, cardId) {
  if (race.finished) throw new Error('Заезд уже завершён');
  const event = getEvent(race.eventId);
  const sector = sectorAt(race.index, race.weather, race.eventId);
  const card = availableCards(race.config,race.mode).find(card => card.id === cardId);
  if (!card) throw new Error('Карта недоступна');
  const gap = race.player.time - race.opponent.time;
  const reason = disabledReason(card, sector, race.player, race.config, gap);
  if (reason) throw new Error(reason);
  const player = simulate(race.config, race.player, sector, card);
  const ai = ['duel','drag'].includes(race.mode)
    ? chooseAI(race.rival, race.opponent, sector, -gap, futureSectors(race)) : null;
  if (card.id === 'defend' && ai) { ai.result.time += .35; ai.result.next.time += .35; }
  if (ai?.card.id === 'defend') {
    player.time += .35; player.next.time += .35;
    player.reasons.push('Соперник закрыл траекторию: +0.35 с');
  }
  const row = {index: race.index, sector: sector.name, cardId, card: card.name,
    aiCard: ai?.card.name || '—', aiPlan: ai?.plan || [],
    playerTime: player.time, aiTime: ai?.result.time ?? null,
    gap: ai ? player.next.time - ai.result.next.time : null,
    risk: player.risk, speed: player.speed, slip: player.slip, reasons: player.reasons,
    tires: player.next.tires, heat: player.next.heat, focus: player.next.focus,
    ...(player.clip?{drift:player.clip}:{})};
  return {...race, index: race.index + 1, player: player.next,
    opponent: ai?.result.next || race.opponent, history: [...race.history, row],
    finished: race.index === event.sectors.length - 1};
}

// Medal targets are independent of the player's build: fixed stock reference runs
// on the same route and weather. They are cached because weather is deterministic.
const targetCache = new Map();
export function medalTargets(eventId, weather) {
  const key = eventId + ':' + weather;
  if (targetCache.has(key)) return targetCache.get(key);
  const baseline = carId => {
    const config = configuration(carId, 'ren');
    let state = freshState(config);
    for (let i = 0; i < getEvent(eventId).sectors.length; i++) {
      state = simulate(config, state, sectorAt(i, weather, eventId), CARDS[0]).next;
    }
    return state.time;
  };
  const gold = baseline('evo') * 1.015;
  const silver = Math.max(gold + 1, baseline('chaser') * 1.015);
  const bronze = Math.max(silver + 1, baseline('ae86') * 1.04);
  const targets = {gold, silver, bronze};
  targetCache.set(key, targets);
  return targets;
}
export function raceOutcome(race) {
  const event = getEvent(race.eventId);
  if (race.mode === 'duel' || race.mode === 'drag') {
    const won = !race.player.drag?.falseStart && (race.opponent.drag?.falseStart || race.player.time < race.opponent.time);
    return {won, medal: null, label: race.player.drag?.falseStart ? 'Фальстарт' : won ? 'Победа' : 'Без победы',
      reward: won ? event.prize : event.participation, street: race.mode==='drag'?0:won?12:4, official: race.mode==='drag'?(won?10:race.player.drag.falseStart?0:3):0};
  }
  if(race.mode==='drift'){
    const medal=['gold','silver','bronze'].find(level=>race.player.drift.score>=event.medals[level])||null;
    return {won:false,medal,label:{gold:'Золото',silver:'Серебро',bronze:'Бронза'}[medal]||'Сессия завершена',
      reward:{gold:22000,silver:14000,bronze:8500}[medal]||event.participation,street:0,official:{gold:12,silver:7,bronze:3}[medal]||1};
  }
  const targets = medalTargets(event.id, race.weather);
  const medal = ['gold', 'silver', 'bronze'].find(level => race.player.time <= targets[level]) || null;
  return {won: false, medal,
    label: {gold: 'Золото', silver: 'Серебро', bronze: 'Бронза'}[medal] || 'Сессия завершена',
    reward: {gold: 16000, silver: 10000, bronze: 6500}[medal] || event.participation,
    street: 0, official: {gold: 12, silver: 7, bronze: 3}[medal] || 1};
}
