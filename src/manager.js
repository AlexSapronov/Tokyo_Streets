import {installedEngineId} from './engine-data.js';
import {bookSupport} from './operations.js';
import {orderPolicy} from './ai-policy.js';
export {orderPolicy} from './ai-policy.js';
import {admissionReason,payoutScale} from './balance.js';
import {getEvent,sectorAt} from './data.js';
import {configuration,createRace,chooseAI,futureSectors,resolveSector} from './engine.js';
import {CREW,contractFor,validOrder,normalizePlan} from './team.js';

export function beginManagedRace(career,eventId,weather,runId,rivalLevel=null,season=false){
  const event=getEvent(eventId),contract=contractFor(career);
  if(!career.team.founded||!contract)throw new Error('Для менеджерского режима нужен контракт с выбранным пилотом');
  if(!season&&(career.street<event.unlockStreet||career.races<event.unlockRaces))throw new Error('Событие пока закрыто');
  if(typeof runId!=='string'||!runId||career.awardedRuns.includes(runId))throw new Error('Нужен новый идентификатор заезда');
  const reason=admissionReason(career,eventId);if(reason)throw new Error(reason);
  const fee=CREW[career.pilot].salary;
  if(career.money<fee)throw new Error('Недостаточно денег на оплату пилота');
  const support=bookSupport(career,eventId,runId),next=support.career;
  if(next.money<fee)throw new Error('Недостаточно денег на пилота и персонал');next.money-=fee;
  const config=configuration(career.car,career.pilot,career.builds[career.car],career.condition[career.car],career.setups?.[career.car],installedEngineId(career),career.wear?.[career.car]);
  const experience=Math.min(30,contract.experience),level=Math.floor(experience/5);
  config.pilot={...config.pilot,skill:Math.min(.995,config.pilot.skill+level*.0025),focus:config.pilot.focus+level};
  const race=createRace(config,weather,eventId,runId,null,rivalLevel);race.rewardScale=payoutScale(career,eventId);race.supportFee=support.fee;
  race.manager={pilotId:career.pilot,trust:contract.trust,fee,order:career.team.plan.order,
    level,experience:contract.experience,plan:normalizePlan(career.team.plan),log:[]};
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
  if(rules.focus&&state.focus<30){requested='conserve';trigger='focus';reason='План: фокус ниже 30';}
  else if(rules.heat&&state.heat>130){requested='conserve';trigger='heat';reason='План: температура выше 130°C';}
  else if(rules.wet&&sector.wet>=.55){requested='safe';trigger='wet';reason='План: мокрый участок';}
  else if(rules.chase&&!race.opponent.dnf&&['duel','drag'].includes(race.mode)&&state.time-race.opponent.time>=2){requested='attack';trigger='chase';reason='План: нужно сокращать отставание';}
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
export function decideManagedAction(race){
  const command=interpretOrder(race),sector=sectorAt(race.index,race.weather,race.eventId);
  const decision=chooseAI(race.config,race.player,sector,race.opponent.dnf?Infinity:race.player.time-race.opponent.time,
    futureSectors(race).slice(0,race.manager.trust>=85?2:race.manager.trust>=60?1:0),orderPolicy(command.effective));
  if(!decision)throw new Error('Нет допустимых действий пилота');
  return {...command,cardId:decision.card.id,decision};
}
export function resolveManagedSector(race){
  const {decision,...command}=decideManagedAction(race);
  const next=resolveSector(race,decision.card.id),last=next.history.at(-1);
  return {...next,history:[...next.history.slice(0,-1),{...last,command}],
    manager:{...race.manager,log:[...race.manager.log,command]}};
}
