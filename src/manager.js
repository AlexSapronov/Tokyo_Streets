import {getEvent,sectorAt} from './data.js';
import {configuration,createRace,chooseAI,futureSectors,resolveSector} from './engine.js';
import {CREW,contractFor,validOrder,normalizePlan} from './team.js';

export function beginManagedRace(career,eventId,weather,runId){
  const event=getEvent(eventId),contract=contractFor(career);
  if(!career.team.founded||!contract)throw new Error('Для менеджерского режима нужен контракт с выбранным пилотом');
  if(career.street<event.unlockStreet||career.races<event.unlockRaces)throw new Error('Событие пока закрыто');
  if(typeof runId!=='string'||!runId||career.awardedRuns.includes(runId))throw new Error('Нужен новый идентификатор заезда');
  const fee=CREW[career.pilot].salary;
  if(career.money<fee)throw new Error('Недостаточно денег на оплату пилота');
  const next=structuredClone(career);next.money-=fee;
  const config=configuration(career.car,career.pilot,career.builds[career.car],career.condition[career.car]);
  const race=createRace(config,weather,eventId,runId);
  race.manager={pilotId:career.pilot,trust:contract.trust,fee,order:career.team.plan.order,
    plan:normalizePlan(career.team.plan),log:[]};
  return {career:next,race};
}
export function setManagerOrder(race,order){
  if(!race.manager||race.finished)throw new Error('Менеджерский заезд не активен');
  if(!validOrder(order))throw new Error('Неизвестный приказ');
  return {...race,manager:{...race.manager,order}};
}
export function interpretOrder(race){
  if(!race.manager||race.finished)throw new Error('Менеджерский заезд не активен');
  const state=race.player,sector=sectorAt(race.index,race.weather,race.eventId);
  const pilot=race.config.pilot,manager=race.manager;
  let requested=manager.order,trigger='none',reason='Базовый приказ менеджера';
  const rules=manager.plan.rules;
  if(rules.focus&&state.focus<30){requested='conserve';trigger='focus';reason='План: концентрация ниже 30';}
  else if(rules.heat&&state.heat>130){requested='conserve';trigger='heat';reason='План: температура выше 130°C';}
  else if(rules.wet&&sector.wet>=.55){requested='safe';trigger='wet';reason='План: мокрый участок';}
  else if(rules.chase&&['duel','drag'].includes(race.mode)&&state.time-race.opponent.time>=2){requested='attack';trigger='chase';reason='План: нужно сокращать отставание';}
  let effective=requested,refused=false,caution=false;
  const discipline=CREW[pilot.id].discipline,trust=manager.trust;
  const reserveLimit=pilot.aggression>1?18:28;
  const hotLimit=pilot.aggression>1?160:140;
  const unsafe=state.focus<reserveLimit||state.heat>hotLimit||state.tires<40;
  if(requested==='attack'&&unsafe){
    effective='conserve';refused=true;caution=true;
    reason+='; пилот ограничил атаку: ресурс вышел за безопасный предел';
  }else if(requested==='attack'&&sector.wet>.65&&discipline*.5+trust/200<.72){
    effective='safe';refused=true;caution=true;
    reason+='; мокрая трасса и недостаточное доверие: пилот выбрал осторожную линию';
  }else if(['safe','conserve'].includes(requested)&&(1-discipline)*(1-trust/100)>.14
      &&pilot.aggression>1&&['duel','drag'].includes(race.mode)&&state.time>race.opponent.time
      &&state.time-race.opponent.time<2.5&&state.focus>40&&state.tires>55&&sector.wet<.65){
    effective='attack';refused=true;
    reason+='; агрессивный пилот с низким доверием увидел окно атаки и изменил приоритет';
  }else if(requested==='hold'&&!['duel','drag'].includes(race.mode)){
    effective='safe';reason+='; в одиночной сессии удерживать позицию не от кого';
  }else{
    reason+='; приказ принят с учётом характера и состояния машины';
  }
  return {requested,effective,trigger,reason,refused,caution};
}
export function orderPolicy(order){
  const weights={attack:{risk:.08,focus:.003,heat:.003,tires:.003},
    conserve:{risk:1.5,focus:.06,heat:.04,tires:.12},
    safe:{risk:7,focus:.025,heat:.018,tires:.03},
    hold:{risk:2,focus:.02,heat:.015,tires:.025}}[order];
  if(!weights)return null;
  return {resourcePrice:state=>Math.max(0,70-state.focus)*weights.focus
      +Math.max(0,state.heat-95)*weights.heat+(100-state.tires)*weights.tires,
    stepCost:(card,result,sector)=>(sector.mode==='drift'?-result.clip.points/12:result.time)
      +result.risk*weights.risk+result.slip*weights.risk
      -(order==='hold'&&card.id==='defend'?.3:0)};
}
export function decideManagedAction(race){
  const command=interpretOrder(race),sector=sectorAt(race.index,race.weather,race.eventId);
  const decision=chooseAI(race.config,race.player,sector,race.opponent.dnf?Infinity:race.player.time-race.opponent.time,
    futureSectors(race),orderPolicy(command.effective));
  if(!decision)throw new Error('Нет допустимых действий пилота');
  return {...command,cardId:decision.card.id,decision};
}
export function resolveManagedSector(race){
  const {decision,...command}=decideManagedAction(race);
  const next=resolveSector(race,decision.card.id),last=next.history.at(-1);
  return {...next,history:[...next.history.slice(0,-1),{...last,command}],
    manager:{...race.manager,log:[...race.manager.log,command]}};
}
