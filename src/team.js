import {PILOTS} from './data.js';
export const TEAM_PRICE=30000;
export const CREW={
  ren:{fee:14000,salary:1800,discipline:.95},
  aki:{fee:18000,salary:2200,discipline:.65},
  yui:{fee:20000,salary:2400,discipline:.9}
};
export const ORDERS=[
  {id:'balanced',name:'Работать в своём темпе',description:'Пилот ищет результат с учётом оставшихся ресурсов.'},
  {id:'attack',name:'Атаковать',description:'Приоритет результата сейчас. Характер и доверие определяют готовность рисковать.'},
  {id:'conserve',name:'Беречь ресурс',description:'Снизить нагрузку, восстанавливать концентрацию и следить за нагревом.'},
  {id:'safe',name:'Избегать риска',description:'Точная линия и низкая нагрузка важнее предельного темпа.'},
  {id:'hold',name:'Удерживать позицию',description:'Закрыть окно атаки, если соперник близко; иначе держать спокойный темп.'}
];
export const PLAN_RULES=[
  {id:'focus',name:'Концентрация ниже 30 → беречь ресурс'},
  {id:'heat',name:'Температура выше 130°C → беречь ресурс'},
  {id:'wet',name:'Влажность от 55% → избегать риска'},
  {id:'chase',name:'Отставание от 2 с → атаковать (только в дуэли)'}
];
export const orderName=id=>ORDERS.find(order=>order.id===id)?.name||'Неизвестный приказ';
export function validOrder(id){return ORDERS.some(order=>order.id===id);}
export function defaultPlan(){return {order:'balanced',rules:{focus:true,heat:true,wet:false,chase:false}};}
export function emptyTeam(){return {founded:false,name:'Night Shift Racing',contracts:[],plan:defaultPlan()};}
export function normalizePlan(raw){
  const plan=defaultPlan();if(validOrder(raw?.order))plan.order=raw.order;
  for(const rule of PLAN_RULES)if(typeof raw?.rules?.[rule.id]==='boolean')plan.rules[rule.id]=raw.rules[rule.id];
  return plan;
}
export function normalizeTeam(raw){
  const team=emptyTeam();if(!raw||raw.founded!==true)return team;
  team.founded=true;
  if(typeof raw.name==='string'&&raw.name.trim())team.name=raw.name.trim().slice(0,40);
  team.plan=normalizePlan(raw.plan);
  const known=new Set();
  for(const item of Array.isArray(raw.contracts)?raw.contracts:[]){
    if(!item||!PILOTS.some(pilot=>pilot.id===item.pilotId)||known.has(item.pilotId))continue;
    known.add(item.pilotId);team.contracts.push({pilotId:item.pilotId,
      trust:Number.isFinite(item.trust)?Math.max(40,Math.min(100,item.trust)):70,
      experience:Number.isFinite(item.experience)?Math.max(0,Math.min(100000,Math.floor(item.experience))):0});
  }
  return team;
}
export function canFoundTeam(career){return career.races>=4&&(career.street>=24||career.official>=12);}
function editable(career,active){
  if(active)throw new Error('Сначала заверши текущий заезд или выйди из него');
  return structuredClone(career);
}
function founded(career){if(!career.team.founded)throw new Error('Сначала основать команду');}
function pay(career,price){if(career.money<price)throw new Error('Недостаточно денег');career.money-=price;}
export function foundTeam(career,active=false){
  const next=editable(career,active);
  if(next.team.founded)throw new Error('Команда уже создана');
  if(!canFoundTeam(next))throw new Error('Нужны 4 финиша и 24 Street Cred или 12 Official Rep');
  pay(next,TEAM_PRICE);next.team.founded=true;return next;
}
export function hirePilot(career,id,active=false){
  const next=editable(career,active);founded(next);
  if(!PILOTS.some(pilot=>pilot.id===id))throw new Error('Неизвестный пилот');
  if(next.team.contracts.some(contract=>contract.pilotId===id))throw new Error('Пилот уже в команде');
  pay(next,CREW[id].fee);next.team.contracts.push({pilotId:id,trust:70,experience:0});return next;
}
export function assignPilot(career,id,active=false){
  const next=editable(career,active);founded(next);
  if(!next.team.contracts.some(contract=>contract.pilotId===id))throw new Error('Нет контракта с пилотом');
  next.pilot=id;return next;
}
export function renameTeam(career,name,active=false){
  const next=editable(career,active);founded(next);
  if(typeof name!=='string'||!name.trim()||name.trim().length>40)throw new Error('Название: от 1 до 40 символов');
  next.team.name=name.trim();return next;
}
export function setTeamPlan(career,plan,active=false){
  const next=editable(career,active);founded(next);
  if(!validOrder(plan?.order))throw new Error('Неизвестный приказ');
  next.team.plan=normalizePlan(plan);return next;
}
export function contractFor(career,pilotId=career.pilot){return career.team.contracts.find(contract=>contract.pilotId===pilotId)||null;}
export function teamAfterRace(team,race,outcome){
  if(!race.manager)return {team,feedback:null};
  const next=structuredClone(team),contract=next.contracts.find(contract=>contract.pilotId===race.config.pilot.id);
  if(!contract)throw new Error('Контракт пилота заезда отсутствует');
  const before=contract.trust;
  const caution=race.manager.log.filter(command=>command.caution).length;
  const rebellion=race.manager.log.filter(command=>command.refused&&!command.caution).length;
  const positive=race.player?.dnf?-3:outcome.won||outcome.medal?2:1;
  contract.trust=Math.max(40,Math.min(100,before+positive-caution*2-rebellion));
  contract.experience=Math.min(100000,contract.experience+1);
  return {team:next,feedback:{before,after:contract.trust,fee:race.manager.fee,caution,rebellion,
    reason:race.player?.dnf?'Вылет и повреждения снизили доверие':caution?'Опасные приказы снизили доверие':rebellion?'Разногласия с пилотом повлияли на доверие':'Завершённый заезд укрепил рабочие отношения'}};
}
export function normalizeCommandRecord(raw,actions,pilotId){
  if(!raw||raw.pilotId!==pilotId||!Number.isFinite(raw.trust)||raw.trust<40||raw.trust>100
      ||!Number.isFinite(raw.fee)||raw.fee<0||raw.fee>100000||!Array.isArray(raw.log)||raw.log.length!==actions.length)return null;
  const log=[];
  for(const [index,command] of raw.log.entries()){
    if(!command||!validOrder(command.requested)||!validOrder(command.effective)||command.cardId!==actions[index]
        ||typeof command.reason!=='string'||command.reason.length>300||typeof command.refused!=='boolean'
        ||typeof command.caution!=='boolean'||!['none',...PLAN_RULES.map(rule=>rule.id)].includes(command.trigger))return null;
    log.push({requested:command.requested,effective:command.effective,cardId:command.cardId,
      reason:command.reason,refused:command.refused,caution:command.caution,trigger:command.trigger});
  }
  return {pilotId,...(Number.isInteger(raw.level)&&raw.level>=0&&raw.level<=6?{level:raw.level}:{}),trust:raw.trust,fee:raw.fee,log};
}
