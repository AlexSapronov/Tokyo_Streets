import {EVENTS,getEvent} from './data.js';

// Permanent achievements are independent of car, weather and the rotating replay list.
export const STAMP_REWARDS=[1500,2500,4000];
export const STAMP_NAMES=['Финиш','Результат','Мастер'];
export function emptyJourney(){return {routes:{},claimed:[]};}
const validFinish=r=>!r.dnf&&!r.falseStart;
export function routeLevel(event,result){
 if(!validFinish(result))return 0;
 if(['duel','drag'].includes(event.mode))return result.won?((event.mode==='duel'?result.weather==='rain':Number.isFinite(result.reaction)&&result.reaction>=0&&result.reaction<=.25)?3:2):1;
 return result.medal==='gold'?3:result.medal?2:1;
}
export function routeTarget(event,level){
 return level===0?'Финиш без схода и фальстарта':level===1?(['duel','drag'].includes(event.mode)?'Победа':'Бронза или выше'):level===2?(event.mode==='duel'?'Победа в дождь':event.mode==='drag'?'Победа с реакцией не больше 0,25 с':'Золото'):'Все отметки получены';
}
const routes=c=>Object.keys(c.journey?.routes||{}).length;
const results=c=>Object.values(c.journey?.routes||{}).filter(n=>n>=2).length;
export const MILESTONES=[
 {id:'debut',title:'Первая ночь',detail:'Заверши любой заезд без схода и фальстарта.',target:1,value:c=>routes(c),reward:3000,view:'race'},
 {id:'result',title:'Заявить о себе',detail:'Победи в дуэли или дрэге либо получи медаль в Time Attack или дрифте.',target:1,value:results,reward:5000,view:'world'},
 {id:'explore',title:'Своё место в городе',detail:'Заверши заезды на трёх разных маршрутах. Дисциплины выбираешь сам.',target:3,value:routes,reward:7000,view:'world'},
 {id:'workshop',title:'Своя подготовка',detail:'Купи три детали для своих машин. Награда после следующего зачётного финиша.',target:3,value:c=>Object.values(c.purchased||{}).reduce((n,parts)=>n+parts.length,0),reward:6000,view:'tuning'},
 {id:'club',main:true,title:'Ночные смены',detail:'Займи подиум в Night Shift. Зарегистрируй лёгкую атмосферную машину до 220 л.с.',target:1,value:c=>Number(c.championships?.completed?.includes('club')||false),reward:8000,view:'seasons'},
 {id:'regional',main:true,title:'Имя в Канто',detail:'Займи подиум в региональной серии Kanto.',target:1,value:c=>Number(c.championships?.completed?.includes('regional')||false),reward:10000,view:'seasons'},
 {id:'masters',main:true,title:'Japan Masters',detail:'Займи подиум в Japan Masters.',target:1,value:c=>Number(c.championships?.completed?.includes('masters')||false),reward:15000,view:'seasons'},
 {id:'allstars',main:true,title:'Japan All Stars',detail:'Займи подиум в элитной серии. Регламент до 600 л.с.; соперники используют V8.',target:1,value:c=>Number(c.championships?.completed?.includes('allstars')||false),reward:18000,view:'seasons'},
 {id:'legends',main:true,title:'Tokyo Legends',detail:'Займи подиум в финальном чемпионате. Регламент до 900 л.с.; соперники подготовили V10.',target:1,value:c=>Number(c.championships?.completed?.includes('legends')||false),reward:24000,view:'seasons'}
];
export const MAIN_MILESTONES=MILESTONES.filter(m=>m.main);
export function nextMilestone(career){return MAIN_MILESTONES.find(m=>m.value(career)<m.target);}
export function normalizeJourney(raw,career){
 const out=emptyJourney();
 if(raw&&typeof raw==='object'){
  for(const e of EVENTS){const n=raw.routes?.[e.id];if(Number.isInteger(n)&&n>=1&&n<=3)out.routes[e.id]=n;}
  out.claimed=MILESTONES.filter(m=>Array.isArray(raw.claimed)&&(raw.claimed.includes(m.id)||m.id==='workshop'&&raw.claimed.includes('team'))).map(m=>m.id);
 }else{
  // Legacy saves retain provable progress, with no retroactive cash or repeat payouts.
  for(const e of EVENTS){
   const records=(career.records||[]).filter(r=>r.eventId===e.id&&validFinish(r));
   let level=career.eventCompletions?.[e.id]>0?1:0;
   for(const r of records)level=Math.max(level,routeLevel(e,r));
   if((career.bests||[]).some(r=>r.eventId===e.id))level=Math.max(1,level);
   if(level)out.routes[e.id]=level;
  }
  const migrated={...career,journey:out};
  out.claimed=MILESTONES.filter(m=>m.value(migrated)>=m.target).map(m=>m.id);
 }
 return out;
}
export function settleJourney(career,race,outcome){
 const next=structuredClone(career),report={stamps:[],milestones:[],bonus:0,debtPaid:0};
 next.journey??=normalizeJourney(null,career);
 const valid=!race.player.dnf&&!race.player.drag?.falseStart;
 const event=getEvent(race.eventId,race.routeVersion),before=next.journey.routes[event.id]||0;
 const level=valid?routeLevel(event,{...outcome,weather:race.weather,reaction:race.player.drag?.reaction}):0;
 for(let i=before;i<level;i++){report.stamps.push({level:i+1,name:STAMP_NAMES[i],reward:STAMP_REWARDS[i]});report.bonus+=STAMP_REWARDS[i];}
 if(valid)next.journey.routes[event.id]=Math.max(before,level);
 for(const m of MILESTONES)if((valid||m.main&&race.season)&&!next.journey.claimed.includes(m.id)&&m.value(next)>=m.target){
  next.journey.claimed.push(m.id);report.milestones.push({id:m.id,title:m.title,reward:m.reward});report.bonus+=m.reward;
 }
 next.journey.claimed=MILESTONES.filter(m=>next.journey.claimed.includes(m.id)).map(m=>m.id);
 report.debtPaid=Math.min(next.repairDebt||0,Math.floor(report.bonus*.5));
 next.repairDebt=(next.repairDebt||0)-report.debtPaid;next.money+=report.bonus-report.debtPaid;
 return {career:next,report};
}
