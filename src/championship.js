import {playerConfiguration} from './player.js';
import {SPECIAL_CUPS,specialRegulationReason} from './special-cups.js';
import {installedEngineId} from './engine-data.js';
import {seriesDefinition,organizerReason} from './organizer.js';
import {earnedStreet} from './workshop.js';
import {CARS,getEvent,sectorAt} from './data.js';
import {configuration,nominalConfiguration,createRace,chooseAI,chooseRacingLine,simulate} from './engine.js';
import {freshDragState} from './drag.js';
import {freshState} from './engine.js';
import {hashSeed,executionRoll} from './execution.js';
import {admissionReason,payoutScale,SERVICE_RATE} from './balance.js';
import {orderPolicy} from './ai-policy.js';
export const CUPS=[
 {id:'club',name:'Night Shift · клубный кубок',tier:1,previous:null,races:3,street:12,fee:3000,maxPower:220,drives:['FR','FF'],naOnly:true,prizes:[18000,11000,6000,2000],budget:18000,
  stages:[['haruna','dry'],['tsukuba','mixed'],['yokohama-half','dry'],['akagi','mixed']],
  roster:[['kei','Кэй Накамура','mx5','ren','balanced',['suspension']],['rika','Рика Исикава','ek9','yui','safe',['brakes']],['daichi','Дайти Сато','ae86','aki','attack',['lsd','cooling']]]},
 {id:'regional',name:'Kanto · региональная серия',tier:2,previous:'club',races:6,street:24,fee:5000,maxPower:330,drives:['FR','FF','AWD','MR'],naOnly:false,prizes:[32000,21000,12000,4000],budget:27000,
  stages:[['tsukuba','rain'],['ebisu','dry'],['yokohama-mile','dry'],['akagi','rain']],
  roster:[['kei','Кэй Накамура','s13','ren','balanced',['suspension','cooling','lsd']],['rika','Рика Исикава','evo','yui','safe',['brakes','cooling']],['daichi','Дайти Сато','chaser','aki','attack',['ecu','cooling','lsd']]]},
 {id:'masters',name:'Japan Masters · национальная серия',tier:3,previous:'regional',races:10,street:36,fee:10000,maxPower:420,drives:['FR','FF','AWD','MR'],naOnly:false,prizes:[55000,35000,20000,7000],budget:36000,
  stages:[['haruna','rain'],['ebisu','mixed'],['yokohama-mile','mixed'],['akagi','rain']],
  roster:[['kei','Кэй Накамура','nsx','ren','balanced',['cams','cooling','brakes','suspension']],['rika','Рика Исикава','r32','yui','safe',['ecu','turbo','cooling','brakes']],['daichi','Дайти Сато','rx7','aki','attack',['ecu','turbo','cooling','lsd']]]},
 {id:'allstars',name:'Japan All Stars · элитная серия',tier:4,previous:'masters',races:0,street:0,fee:16000,maxPower:600,drives:['FR','FF','AWD','MR'],naOnly:false,prizes:[75000,48000,28000,10000],budget:50000,
  stages:[['irohazaka','rain'],['nikko','dry'],['yokohama-mile','mixed'],['hakone','rain']],
  roster:[['kei','Кэй Накамура','nsx','ren','balanced',['ecu','exhaust','cooling','brakes','suspension'],'ls3'],['rika','Рика Исикава','r32','yui','safe',['ecu','cooling','brakes','tires'],'ls3'],['daichi','Дайти Сато','rx7','aki','attack',['ecu','exhaust','cooling','lsd'],'ls3']]},
 {id:'legends',name:'Tokyo Legends · вершина карьеры',tier:5,previous:'allstars',races:0,street:0,fee:24000,maxPower:900,drives:['FR','FF','AWD','MR'],naOnly:false,prizes:[110000,70000,42000,16000],budget:70000,
  stages:[['wangan','rain'],['meihan','mixed'],['yokohama-mile','rain'],['hakone','dry']],
  roster:[['kei','Кэй Накамура','nsx','ren','balanced',['ecu','exhaust','cooling','brakes','suspension'],'1lr'],['rika','Рика Исикава','r32','yui','safe',['ecu','exhaust','cooling','brakes','tires'],'1lr'],['daichi','Дайти Сато','supra','aki','attack',['ecu','exhaust','cooling','lsd'],'1lr']]}

];
export const POINTS=[10,6,4,2];
export function emptyChampionship(){return {active:null,completed:[],history:[]};}
export function getCup(id,career){const definition=career?.championships?.active?.definition;return CUPS.find(c=>c.id===id)||SPECIAL_CUPS.find(c=>c.id===id)||career?.organizer?.series?.find(c=>c.id===id)||(definition&&definition.id===id?definition:undefined);}
export function activeCup(state){return state?.definition||getCup(state?.cupId);}
export function cupUnlockReason(career,cup){
 if(cup.custom)return organizerReason(career,cup);
 if(cup.special){if(career.races<cup.races)return 'Нужно '+cup.races+' финиша';const closed=cup.stages.find(([id])=>{const e=getEvent(id);return career.races<e.unlockRaces||earnedStreet(career)<e.unlockStreet;});if(closed)return 'Сначала открой трассу: '+getEvent(closed[0]).title;}
 if(cup.previous&&!career.championships?.completed?.includes(cup.previous))return 'Нужен подиум в предыдущем кубке';
 if(!cup.previous&&(career.races<cup.races||earnedStreet(career)<cup.street))return `Нужно ${cup.races} финишей и ${cup.street} Street Cred`;
 return '';
}
export function regulationReason(config,cup){
 const special=specialRegulationReason(config,cup);if(special)return special;
 if(nominalConfiguration(config).car.power>cup.maxPower)return `Лимит ${cup.maxPower} л.с. исправной сборки с учётом тюнинга`;
 if(!cup.drives.includes(config.car.drive))return `Допуск: ${cup.drives.join(' / ')}`;
 if(cup.naOnly&&config.car.engine.includes('TURBO'))return 'Кубок только для атмосферных моторов';
 return '';
}
function editable(career,active){if(active)throw new Error('Сначала заверши текущий заезд');return structuredClone(career);}
export function enterCup(career,cupId,attempt,active=false){
 const next=editable(career,active),cup=getCup(cupId,next);if(!cup)throw new Error('Кубок не найден');
 if(next.championships?.active)throw new Error('Сначала заверши или покинь текущий кубок');
 const reason=cupUnlockReason(next,cup)||regulationReason(configuration(next.car,next.pilot,next.builds[next.car],100,next.setups[next.car],installedEngineId(next),next.wear?.[next.car]),cup);if(reason)throw new Error(reason);
 if(typeof attempt!=='string'||!attempt||attempt.length>80)throw new Error('Нужен идентификатор сезона');
 if(next.money<cup.fee)throw new Error('Недостаточно денег на взнос');next.money-=cup.fee;
 next.championships??=emptyChampionship();next.championships.active={...(cup.custom?{definition:structuredClone(cup)}:{}),cupId,attempt,carId:next.car,stage:0,results:[],npcs:cup.roster.map(([id])=>({id,condition:100,budget:cup.budget}))};return next;
}
export function withdrawCup(career,active=false){const next=editable(career,active);if(!next.championships?.active)throw new Error('Нет активного кубка');next.championships.active=null;return next;}
export function prepareStage(career,active=false){
 const next=editable(career,active),state=next.championships?.active,cup=activeCup(state);if(!cup)throw new Error('Нет активного кубка');
 const [eventId,weather]=cup.stages[state.stage];next.car=state.carId;next.eventId=eventId;next.weather=weather;return next;
}
function entrants(cup){return [{id:'player',name:'Ты'},...cup.roster.map(([id,name,carId,pilotId,style,parts,engineId])=>({id,name,carId,pilotId,style,parts,engineId}))];}
export function standings(state){
 const cup=activeCup(state);
 return entrants(cup).map((e,index)=>({...e,points:state.results.reduce((n,r)=>n+r.rows.find(row=>row.id===e.id).points,0),wins:state.results.filter(r=>r.rows.find(row=>row.id===e.id).points===10).length,
  places:state.results.map(r=>r.rows.find(row=>row.id===e.id).position).reverse(),index})).sort((a,b)=>b.points-a.points||b.wins-a.wins||a.places.reduce((n,p,i)=>n||p-b.places[i],0)||a.index-b.index);
}
function minimumCondition(eventId){return ['drag','drift','timeattack'].includes(getEvent(eventId).mode)?55:45;}
function repairedNpc(npc){
 const spend=Math.min(npc.budget,Math.max(0,85-npc.condition)*SERVICE_RATE);
 return {...npc,condition:npc.condition+spend/SERVICE_RATE,budget:npc.budget-spend};
}
export function previewCupOpponent(career){
 const state=career.championships?.active,cup=activeCup(state);if(!cup)return null;
 const featured=standings(state).find(e=>e.id!=='player'),npc=repairedNpc(state.npcs.find(n=>n.id===featured.id));
 return {id:featured.id,name:featured.name,style:featured.style,rival:configuration(featured.carId,featured.pilotId,featured.parts,npc.condition,{},featured.engineId),dns:npc.condition<minimumCondition(cup.stages[state.stage][0])};
}
export function bookCupRace(career,runId){
 const state=career.championships?.active,cup=activeCup(state);if(!cup)throw new Error('Нет активного кубка');
 if(career.car!==state.carId)throw new Error('Для кубка вернись на зарегистрированную машину');
 const [eventId,weather]=cup.stages[state.stage],config=configuration(career.car,career.pilot,career.builds[career.car],career.condition[career.car],career.setups[career.car],installedEngineId(career),career.wear?.[career.car]);
 const reason=regulationReason(config,cup)||admissionReason(career,eventId);if(reason)throw new Error(reason);
 if(typeof runId!=='string'||!runId||runId.length>80||career.awardedRuns.includes(runId))throw new Error('Нужен новый идентификатор заезда');
 let next={...career,eventId,weather},race;
 Object.assign(config,playerConfiguration(config,career.player));
 next=structuredClone(next);next.control='personal';race=createRace(config,weather,eventId,runId);race.supportFee=0;
 const seed=hashSeed(`${state.attempt}:${state.stage}`),opponent=previewCupOpponent(career);
 race.seed=seed;race.rewardScale=payoutScale(career,eventId);race.rival=opponent.rival;race.rivalStyle=opponent.style;race.rivalName=opponent.name;
 race.opponent=race.mode==='drag'?freshDragState(race.rival):freshState(race.rival);
 if(opponent.dns)race.opponent.dnf={reason:'Технический недопуск',damage:0,speed:0};
 race.season={cupId:cup.id,attempt:state.attempt,stage:state.stage,featuredId:opponent.id};
 return {career:next,race};
}
function finishNpc(config,state,eventId,weather,seed,side,index,style){
 const event=getEvent(eventId);
 for(let i=index;i<event.sectors.length&&!state.dnf;i++){
  const sector=sectorAt(i,weather,eventId),upcoming=event.sectors.slice(i+1,i+3).map((_,j)=>sectorAt(i+j+1,weather,eventId));
  const action=chooseAI(config,state,sector,Infinity,upcoming,orderPolicy(style));
  const card=['duel','timeattack'].includes(event.mode)?chooseRacingLine(config,state,sector,action.card,upcoming[0],style).card:action.card;
  const result=simulate(config,state,sector,card,executionRoll(seed,i,side,state.focus));
  state={...result.next,seasonSlip:(state.seasonSlip||0)+result.slip};
 }
 return state;
}
export function settleCup(career,race){
 if(!race.season)return {career,report:null};
 const state=career.championships?.active,cup=activeCup(state),tag=race.season;
 if(!state||!cup||tag.cupId!==cup.id||tag.attempt!==state.attempt||tag.stage!==state.stage||race.eventId!==cup.stages[state.stage][0]||race.weather!==cup.stages[state.stage][1]||race.config.car.id!==state.carId)throw new Error('Заезд не соответствует текущему этапу');
 if(!race.finished)throw new Error('Этап ещё не завершён');
 if(!cup.roster.some(r=>r[0]===tag.featuredId)||typeof race.runId!=='string'||!race.runId||race.runId.length>80)throw new Error('Неверная запись этапа');
 const next=structuredClone(career),season=next.championships.active;
 const summarize=(id,s)=>({id,time:s.time,score:s.drift?.score||0,dnf:!!s.dnf,falseStart:!!s.drag?.falseStart,position:0,points:0});
 const rows=[summarize('player',race.player)];
 for(const opponent of entrants(cup).slice(1)){
  const original=season.npcs.find(n=>n.id===opponent.id),npc=repairedNpc(original),config=configuration(opponent.carId,opponent.pilotId,opponent.parts,npc.condition,{},opponent.engineId);
  let result;
  if(npc.condition<minimumCondition(race.eventId))result={time:0,tires:100,dnf:{reason:'Технический недопуск',damage:0}};
  else if(opponent.id===tag.featuredId&&['duel','drag'].includes(race.mode))result=finishNpc(config,{...race.opponent,seasonSlip:race.history.reduce((n,row)=>n+(row.aiSlip||0),0)},race.eventId,race.weather,race.seed,'opponent',race.index,opponent.style);
  else{const initial=createRace(config,race.weather,race.eventId,null,race.seed).player;result=finishNpc(config,initial,race.eventId,race.weather,race.seed,'field-'+opponent.id,0,opponent.style);}
  // NPC condition is the existing aggregate maintenance budget, including tires;
  // unlike the player, NPCs have no second per-component repair invoice.
  npc.condition=Math.max(35,npc.condition-(result.dnf?.damage||0)-(100-result.tires)*.55-(result.seasonSlip||0)*.5);Object.assign(original,npc);rows.push(summarize(opponent.id,result));
 }
 rows.sort((a,b)=>Number(a.dnf||a.falseStart)-Number(b.dnf||b.falseStart)||(race.mode==='drift'?b.score-a.score:0)||a.time-b.time||a.id.localeCompare(b.id));
 rows.forEach((row,i)=>{row.position=i+1;row.points=row.dnf||row.falseStart?0:POINTS[i];});
 season.results.push({eventId:race.eventId,runId:race.runId,rows});season.stage++;
 const table=standings(season),position=rows.find(r=>r.id==='player').position;
 const report={...(cup.custom?{name:cup.name,custom:true}:{}),cupId:cup.id,stage:tag.stage,position,rows:structuredClone(rows),standings:table.map(({id,name,points})=>({id,name,points})),finished:season.stage===cup.stages.length};
 if(report.finished){
  const rank=table.findIndex(e=>e.id==='player')+1,points=table.find(e=>e.id==='player').points;
  const validFinishes=season.results.filter(r=>r.rows.find(e=>e.id==='player').points>0).length;
  const bonus=validFinishes?Math.round(cup.prizes[rank-1]*(!cup.custom&&next.championships.completed.includes(cup.id)?.4:1)):0,debtPaid=Math.min(next.repairDebt||0,Math.floor(bonus*.5));
  next.money+=bonus-debtPaid;next.repairDebt=(next.repairDebt||0)-debtPaid;
  const qualified=rank<=3&&validFinishes>0;
  if(!cup.custom&&qualified&&!next.championships.completed.includes(cup.id))next.championships.completed.push(cup.id);
  next.championships.history.unshift({...(cup.custom?{definition:structuredClone(cup)}:{}),cupId:cup.id,rank,points,bonus,attempt:season.attempt});next.championships.history=next.championships.history.slice(0,20);next.championships.active=null;
  Object.assign(report,{rank,points,bonus,debtPaid,qualified,validFinishes});
 }
 return {career:next,report};
}
function historyCup(value){
 const stock=getCup(value?.cupId);if(stock)return stock;
 try{if(value?.definition?.id===value?.cupId)return seriesDefinition(value.definition);}catch{}return null;
}
export function normalizeChampionship(raw){
 const out=emptyChampionship();if(!raw||typeof raw!=='object')return out;
 out.completed=[...new Set((Array.isArray(raw.completed)?raw.completed:[]).filter(id=>getCup(id)))];
 out.history=(Array.isArray(raw.history)?raw.history:[]).filter(h=>h&&historyCup(h)&&Number.isInteger(h.rank)&&h.rank>=1&&h.rank<=4&&Number.isFinite(h.points)&&h.points>=0&&h.points<=historyCup(h).stages.length*10&&Number.isFinite(h.bonus)&&h.bonus>=0&&h.bonus<=historyCup(h).prizes[0]&&typeof h.attempt==='string'&&h.attempt.length<=80).slice(0,20).map(h=>({... (historyCup(h).custom?{definition:historyCup(h)}:{}),cupId:h.cupId,rank:h.rank,points:h.points,bonus:h.bonus,attempt:h.attempt}));
 const a=raw.active,cup=historyCup(a);if(!cup)return out;
 if(typeof a.attempt!=='string'||!a.attempt||a.attempt.length>80||!CARS.some(c=>c.id===a.carId)||!Number.isInteger(a.stage)||a.stage<0||a.stage>=cup.stages.length||!Array.isArray(a.results)||a.results.length!==a.stage||!Array.isArray(a.npcs)||a.npcs.length!==3)return out;
 const ids=['player',...cup.roster.map(r=>r[0])],runs=new Set();
 for(const [i,r] of a.results.entries()){
  if(!r||r.eventId!==cup.stages[i][0]||typeof r.runId!=='string'||!r.runId||r.runId.length>80||runs.has(r.runId)||!Array.isArray(r.rows)||r.rows.length!==4)return out;runs.add(r.runId);
  if(new Set(r.rows.map(row=>row?.id)).size!==4||new Set(r.rows.map(row=>row?.position)).size!==4)return out;
  for(const row of r.rows)if(!row||!ids.includes(row.id)||!Number.isInteger(row.position)||row.position<1||row.position>4||row.points!==(row.dnf||row.falseStart?0:POINTS[row.position-1])||typeof row.dnf!=='boolean'||typeof row.falseStart!=='boolean'||!Number.isFinite(row.time)||row.time<0||row.time>10000||!Number.isFinite(row.score)||row.score<0||row.score>800)return out;
 }
 if(new Set(a.npcs.map(n=>n?.id)).size!==3||a.npcs.some(n=>!n||!ids.slice(1).includes(n.id)||!Number.isFinite(n.condition)||n.condition<35||n.condition>100||!Number.isFinite(n.budget)||n.budget<0||n.budget>cup.budget))return out;
 out.active={...(cup.custom?{definition:cup}:{}),cupId:a.cupId,attempt:a.attempt,carId:a.carId,stage:a.stage,results:a.results.map(r=>({eventId:r.eventId,runId:r.runId,rows:r.rows.map(e=>({id:e.id,time:e.time,score:e.score,dnf:e.dnf,falseStart:e.falseStart,position:e.position,points:e.points}))})),npcs:a.npcs.map(n=>({id:n.id,condition:n.condition,budget:n.budget}))};return out;
}
