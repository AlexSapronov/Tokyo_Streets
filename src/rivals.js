import {playerConfiguration} from './player.js';
import {getEvent,sectorAt} from './data.js';
import {configuration,createRace,chooseAI,simulate,freshState} from './engine.js';
import {freshDriftState} from './drift.js';
import {bookSupport} from './operations.js';
import {admissionReason} from './balance.js';
import {executionRoll,hashSeed} from './execution.js';

export const CREWS=[
 {id:'cedar',name:'Cedar Line',territory:'Горные дороги Гунмы',badge:'Хозяин горных связок',description:'Точные лёгкие машины. Сначала чистый темп, затем дождь и тесные шпильки.'},
 {id:'harbor',name:'Harbor Works',territory:'Йокогама',badge:'Огни гавани',description:'Мастера старта и длинного разгона. Сохрани сцепление, затем удержи мотор в рабочем диапазоне.'},
 {id:'sideways',name:'Sideways Union',territory:'Эбису · Харуна · Мэйхан',badge:'Своя линия',description:'Заднеприводные машины и непрерывные связки. Нужно превзойти записанный результат каждого участника.'}
];
export const CHALLENGES=[
 {id:'cedar-1',crew:'cedar',name:'Хару Кондо',title:'Первый перевал',eventId:'haruna',weather:'dry',carId:'mx5',pilotId:'ren',parts:[],style:'balanced',tell:'Берегёт фокус перед связкой; ищи выигрыш на выходе к тоннелю.',reward:4000},
 {id:'cedar-2',crew:'cedar',name:'Мэй Араи',title:'Кедровый хребет',eventId:'akagi',weather:'mixed',carId:'ek9',pilotId:'yui',parts:['streetTires','brakes'],style:'safe',tell:'Стабильна в поворотах, уступает мощным машинам на прямой.',reward:7000},
 {id:'cedar-3',crew:'cedar',name:'Рё Сэки',title:'Дождь над Ирохадзакой',eventId:'irohazaka',weather:'rain',carId:'evo',pilotId:'yui',parts:['wetTires','brakes','suspension','cooling'],style:'safe',tell:'Дождевые шины и полный привод. Сырые шпильки — его сильная сторона.',reward:12000},
 {id:'harbor-1',crew:'harbor',name:'Дзюн Окада',title:'Четверть мили',eventId:'yokohama',weather:'dry',carId:'s13',pilotId:'aki',parts:['clutch'],style:'attack',tell:'Сильная реакция; следи за своей пробуксовкой и временем 60 ft.',reward:4000},
 {id:'harbor-2',crew:'harbor',name:'Нао Мидзуно',title:'Длиннее стартовой прямой',eventId:'yokohama-half',weather:'dry',carId:'chaser',pilotId:'ren',parts:['lsd','clutch','cooling'],style:'balanced',tell:'Выигрывает реализацией тяги после старта. Нужна подходящая передача.',reward:7000},
 {id:'harbor-3',crew:'harbor',name:'Кэн Хаяси',title:'Миля до рассвета',eventId:'yokohama-mile',weather:'mixed',carId:'supra',pilotId:'ren',parts:['ecu','exhaust','cooling','intercooler','lsd'],style:'conserve',tell:'Не тратит весь ресурс на первых метрах. Финальная скорость решает.',reward:12000},
 {id:'sideways-1',crew:'sideways',name:'Сора Ито',title:'Линия Эбису',eventId:'ebisu',weather:'dry',carId:'ae86',pilotId:'ren',parts:['angle'],style:'balanced',tell:'Чистые связки важнее максимального угла в одном клипе.',reward:4000},
 {id:'sideways-2',crew:'sideways',name:'Ая Фудзита',title:'Ночная Харуна',eventId:'haruna-drift',weather:'dry',carId:'s13',pilotId:'ren',parts:['angle','lsd'],style:'balanced',tell:'Сохраняет направление и скорость от клипа к клипу.',reward:7000},
 {id:'sideways-3',crew:'sideways',name:'Такэ Сугимото',title:'Мэйхан без разрыва',eventId:'meihan',weather:'mixed',carId:'rx7',pilotId:'yui',parts:['angle','lsd','suspension','cooling'],style:'safe',tell:'Точный контроль на влажном покрытии. Потеря связки дорого стоит.',reward:12000}
];
export const getChallenge=id=>CHALLENGES.find(c=>c.id===id);
export const emptyRivals=()=>({completed:[]});
export function normalizeRivals(raw){return {completed:CHALLENGES.filter(c=>Array.isArray(raw?.completed)&&raw.completed.includes(c.id)).map(c=>c.id)};}
export function challengeReason(career,id){
 const challenge=getChallenge(id);if(!challenge)return 'Вызов не найден';
 const chain=CHALLENGES.filter(c=>c.crew===challenge.crew),index=chain.indexOf(challenge);
 if(index>0&&!career.rivals?.completed.includes(chain[index-1].id))return 'Сначала победи предыдущего участника команды';
 const event=getEvent(challenge.eventId);
 if(career.races<event.unlockRaces||career.street<event.unlockStreet)return 'Сначала открой трассу в карьере';
 return '';
}
export function rivalConfig(challenge){return configuration(challenge.carId,challenge.pilotId,challenge.parts);}
const targetCache=new Map();
export function challengeTarget(challenge){
 if(getEvent(challenge.eventId).mode!=='drift')return null;
 if(targetCache.has(challenge.id))return targetCache.get(challenge.id);
 const config=rivalConfig(challenge);let state=freshDriftState(config);
 const event=getEvent(challenge.eventId);
 for(let i=0;i<event.sectors.length;i++){
  const sector=sectorAt(i,challenge.weather,event.id),choice=chooseAI(config,state,sector);
  state=simulate(config,state,sector,choice.card,executionRoll(1701,i,'opponent',state.focus)).next;
  if(state.dnf)break;
 }
 // A fixed recorded benchmark, not a moving target based on the player's build.
 const target=Math.max(1,Math.floor(state.drift.score*.9));targetCache.set(challenge.id,target);return target;
}
export function previewChallenge(config,id){
 const c=getChallenge(id);if(!c)throw new Error('Вызов не найден');
 const race=createRace({...config,challengeId:id},c.weather,c.eventId);
 delete race.config.rivalLevel;
 race.rival=rivalConfig(c);race.rivalName=c.name+' · '+CREWS.find(crew=>crew.id===c.crew).name;race.rivalStyle=c.style;
 race.opponent=race.mode==='drag'?createRace(race.rival,c.weather,c.eventId).player:freshState(race.rival);
 race.challenge={id:c.id,target:challengeTarget(c)};
 return race;
}
export function bookChallenge(career,id,runId){
 const reason=challengeReason(career,id);if(reason)throw new Error(reason);
 const c=getChallenge(id),blocked=admissionReason(career,c.eventId);if(blocked)throw new Error(blocked);
 if(typeof runId!=='string'||!runId||runId.length>80||career.awardedRuns.includes(runId))throw new Error('Нужен идентификатор заезда');
 const config=configuration(career.car,'ren',career.builds[career.car],career.condition[career.car],career.setups[career.car],career.engines?.installed?.[career.car]?.engineId,career.wear[career.car]);
 const race=previewChallenge(playerConfiguration(config,career.player),id),support=bookSupport(career,c.eventId,runId);
 race.runId=runId;race.seed=hashSeed(runId);race.supportFee=support.fee;
 return {career:{...support.career,eventId:c.eventId,weather:c.weather},race};
}
export function settleChallenge(career,race,outcome){
 if(!race.challenge)return {career,report:null};
 const c=getChallenge(race.challenge.id);
 if(!race.finished||!c||race.config.challengeId!==c.id||race.eventId!==c.eventId||race.weather!==c.weather||challengeReason(career,c.id))throw new Error('Заезд не соответствует вызову');
 const next=structuredClone(career);next.rivals=normalizeRivals(next.rivals);
 const succeeded=!race.player.dnf&&!race.player.drag?.falseStart&&(race.mode==='drift'?race.history.length===getEvent(c.eventId).sectors.length&&race.player.drift.score>=challengeTarget(c):outcome.won);
 const first=succeeded&&!next.rivals.completed.includes(c.id);
 if(first)next.rivals.completed.push(c.id);
 const reward=first?c.reward:0,debtPaid=Math.min(next.repairDebt||0,Math.floor(reward*.5));
 next.money+=reward-debtPaid;next.repairDebt=(next.repairDebt||0)-debtPaid;
 const crew=CREWS.find(crew=>crew.id===c.crew),complete=CHALLENGES.filter(stage=>stage.crew===c.crew).every(stage=>next.rivals.completed.includes(stage.id));
 return {career:next,report:{id:c.id,name:c.name,succeeded,first,reward,debtPaid,badge:first&&complete?crew.badge:null}};
}
