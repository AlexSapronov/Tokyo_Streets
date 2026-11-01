import {raceClass} from './balance.js';
import {configuration,freshState,simulate,availableCards,disabledReason,chooseAI,chooseRacingLine} from './engine.js';
import {executionRoll,hashSeed,newSeed} from './execution.js';
import {getEvent,sectorAt,CARDS,PARTS} from './data.js';
import {lineCard,lineName} from './racing-lines.js';
import {orderPolicy} from './ai-policy.js';
import {readTelemetry} from './telemetry.js';
import {tireKey} from './wear.js';
export const GRID_EVENT='tsukuba-grid',GRID_REWARD='supraGT4',PIT_SECONDS=25;
export const GRID_ROSTER=[
 {id:'kei',name:'Кэй Накамура',carId:'evo',pilotId:'ren',parts:['ecu','exhaust','streetTires','brakes','lsd','cooling'],style:'balanced',pitLap:0},
 {id:'rika',name:'Рика Исикава',carId:'rx7',pilotId:'yui',parts:['ecu','exhaust','tires','brakes','lsd','cooling'],style:'safe',pitLap:2},
 {id:'daichi',name:'Дайти Сато',carId:'nsx',pilotId:'aki',parts:['ecu','exhaust','streetTires','brakes','lsd','cooling'],style:'attack',pitLap:0}
];
const all=r=>[{id:'player',name:'Ты',config:r.config,state:r.player,order:3,history:r.history},...r.grid.rivals];
export function gridStandings(race){
 return all(race).sort((a,b)=>!!a.state.dnf-!!b.state.dnf||(a.state.dnf&&b.state.dnf?(b.history.length-a.history.length):a.state.time-b.state.time)||a.order-b.order).map((e,i)=>({...e,position:i+1}));
}
function gaps(race){
 const active=gridStandings(race).filter(e=>!e.state.dnf);
 for(let i=0;i<active.length;i++){
  const e=active[i],ahead=active[i-1],behind=active[i+1];
  e.state.gridGaps={behind:ahead?e.state.time-ahead.state.time:Infinity,ahead:behind?e.state.time-behind.state.time:-Infinity,close:ahead?e.state.time-ahead.state.time:behind?e.state.time-behind.state.time:Infinity};
 }
 const target=active.filter(e=>e.id!=='player').sort((a,b)=>Math.abs(a.state.time-race.player.time)-Math.abs(b.state.time-race.player.time))[0]||race.grid.rivals[0];race.opponent={...target.state,dnf:undefined};race.rival=target.config;race.rivalName=target.name;return race;
}
export function createGridRace(config,runId=null,seed=null){
 const event=getEvent(GRID_EVENT,3);config={...config,routeVersion:3};
 const rivals=GRID_ROSTER.map((spec,i)=>{const build={...configuration(spec.carId,spec.pilotId,spec.parts),routeVersion:3};return {...spec,config:build,state:freshState(build),order:i,history:[],pits:[]};});
 return gaps({config,category:raceClass(config),rival:rivals[0].config,player:freshState(config),opponent:rivals[0].state,weather:'dry',eventId:GRID_EVENT,routeVersion:3,mode:'duel',index:0,history:[],finished:false,awarded:false,runId,seed:Number.isInteger(seed)?seed>>>0:runId?hashSeed(runId):newSeed(),rewardScale:1,grid:{version:1,laps:event.laps,rivals,pits:[],pitBill:0}});
}
export function pitQuote(config){const part=PARTS.find(p=>p.id===tireKey(config.parts));return Math.max(6000,Math.ceil((part?.price||6000)*.65));}
export function canPit(race){const event=getEvent(race.eventId,3);return !race.finished&&race.index>0&&race.index%event.lapSectors===0;}
export function pit(config,state){
 const next=structuredClone(state);next.time+=PIT_SECONDS;next.tires=100;next.focus=Math.min(config.pilot.focus,next.focus+15);next.heat=35+(next.heat-35)*Math.exp(-PIT_SECONDS*.03);next.velocity=8;
 if(next.telemetry){next.telemetry.tireTemp=60;next.telemetry.brakes=next.heat;next.telemetry.oil=75+(next.telemetry.oil-75)*.85;next.telemetry.coolant=70+(next.telemetry.coolant-70)*.9;}
 return next;
}
function preparedField(race,requestPit){
 const sector=sectorAt(race.index,'dry',race.eventId,3);
 const prepared=all(race).filter(e=>!e.state.dnf).map(e=>({e,scheduled:e.id==='player'?requestPit:canPit(race)&&e.pitLap===sector.lap})).map(x=>({...x,state:x.scheduled?pit(x.e.config,x.e.state):structuredClone(x.e.state)})).sort((a,b)=>a.state.time-b.state.time||a.e.order-b.e.order);
 for(let i=0;i<prepared.length;i++){const p=prepared[i],ahead=prepared[i-1],behind=prepared[i+1];p.state.gridGaps={behind:ahead?p.state.time-ahead.state.time:Infinity,ahead:behind?p.state.time-behind.state.time:-Infinity,close:ahead?p.state.time-ahead.state.time:behind?p.state.time-behind.state.time:Infinity};}
 return prepared;
}
export function gridPlanningState(race){return preparedField(race,!!race.grid.requestPit).find(p=>p.e.id==='player').state;}
export function resolveGridSector(original,cardId,lineId='neutral',requestPit=false){
 if(original.finished)throw Error('Заезд уже завершён');
 if(requestPit&&!canPit(original))throw Error('Замена шин доступна только между кругами');
 const race=structuredClone(original),event=getEvent(race.eventId,3),sector=sectorAt(race.index,'dry',race.eventId,3),upcoming=event.sectors.slice(race.index+1,race.index+3).map((_,i)=>sectorAt(race.index+1+i,'dry',race.eventId,3));
 const runners=all(race),results=new Map();
 const prepared=preparedField(race,requestPit);
 const before=prepared.map(p=>({...p.e,state:p.state}));
 for(const e of runners){
  if(e.state.dnf)continue;
  const {scheduled,state}=prepared.find(p=>p.e.id===e.id);
  let card;
  if(e.id==='player'){
   const base=availableCards(e.config,'duel',race.eventId).find(c=>c.id===cardId);if(!base)throw Error('Карта недоступна');card=lineCard(base,lineId);
   const reason=disabledReason(card,sector,state,e.config,state.gridGaps?.close??0);if(reason)throw Error(reason);
  }else{
   const choice=chooseAI(e.config,state,sector,state.gridGaps?.close??0,upcoming,orderPolicy(e.style));card=chooseRacingLine(e.config,state,sector,choice.card,upcoming[0],e.style).card;
  }
  const execution=executionRoll(race.seed,race.index,e.id,state.focus),result=simulate(e.config,state,sector,card,execution);
  const gridDelay=race.index===0?e.order*.3:0;result.time+=gridDelay+(scheduled?PIT_SECONDS:0);result.next.time+=gridDelay;
  if(gridDelay)result.reasons.push('Стартовый интервал: +'+gridDelay.toFixed(1)+' с');
  if(scheduled){result.reasons.push('Пит-стоп: замена шин, +25 с');if(e.id==='player'){race.grid.pits.push(race.index);race.grid.pitBill+=pitQuote(e.config);}else e.pits.push(race.index);}
  results.set(e.id,{e,card,result,state,pit:scheduled});
 }
 // Defense only delays the adjacent pursuer, never the entire field.
 const live=before.filter(e=>!e.state.dnf);
 for(let i=0;i<live.length-1;i++){
  const lead=results.get(live[i].id),follow=results.get(live[i+1].id);
  if(lead?.card.id==='defend'&&follow&&live[i+1].state.time-live[i].state.time<2.5){follow.result.time+=.35;follow.result.next.time+=.35;lead.result.rivalDelay=.35;follow.result.playerDelay=.35;follow.result.reasons.push('Машина впереди защищала позицию: +0.35 с');}
 }
 // A narrow corner needs a different line or a decisive advantage to pass.
 for(let i=0;i<live.length-1;i++){
  const lead=results.get(live[i].id),follow=results.get(live[i+1].id);if(!lead||!follow||lead.result.next.dnf||follow.result.next.dnf)continue;
  if(sector.type==='corner'&&sector.radius<70&&live[i+1].state.time-live[i].state.time<2.5&&follow.result.next.time<lead.result.next.time&&(follow.card.lineId===lead.card.lineId||lead.result.next.time-follow.result.next.time<.25)){
   const delay=lead.result.next.time+.1-follow.result.next.time;follow.result.next.time+=delay;follow.result.time+=delay;follow.result.reasons.push('В тесном повороте не хватило места для обгона');
  }
 }
 const target=live.find(e=>e.id!=='player'&&e.state.time<=race.player.time)||live.find(e=>e.id!=='player'),ai=target&&results.get(target.id),p=results.get('player'),clean=simulate(race.config,race.player,sector,lineCard(CARDS[0],'neutral'),executionRoll(race.seed,race.index,'player',race.player.focus));
 for(const {e,card,result} of results.values()){
  const row={index:race.index,sector:sector.name,cardId:card.id,card:card.name,lineId:card.lineId||'neutral',playerTime:result.time,slip:result.slip,execution:result.execution,reasons:result.reasons,telemetry:readTelemetry(e.config,result.next,'duel'),focus:result.next.focus,tires:result.next.tires,heat:result.next.heat,speed:result.speed,risk:result.risk};
  if(e.id==='player'){
   Object.assign(row,{aiTime:ai?.result.time??null,aiCardId:ai?.card.id||null,aiCard:ai?.card.name||'—',aiLineId:ai?.card.lineId||'neutral',aiSlip:ai?.result.slip||0,aiExecution:ai?.result.execution||null,aiPlan:[],aiReasons:ai?.result.reasons||[],gap:ai?result.next.time-ai.result.next.time:null,pit:p.pit,impact:{breakdown:{...result.breakdown,startGrid:race.index===0?.9:0,pit:p.pit?PIT_SECONDS:0,traffic:Math.max(0,result.time-(p.pit?PIT_SECONDS:0)-(race.index===0?.9:0)-(result.playerDelay||0)-Object.values(result.breakdown||{}).reduce((n,x)=>n+x,0))},cleanTime:clean.time,decisionGain:null,nextSpeedGain:(result.next.velocity-clean.next.velocity)*3.6,focusBefore:race.player.focus,playerDelay:result.playerDelay||0,rivalDelay:result.rivalDelay||0,gapChange:ai?result.time-ai.result.time:null}});
   race.history.push(row);race.player=result.next;
  }else{e.history.push(row);e.state=result.next;}
 }
 race.grid.requestPit=false;race.index++;race.finished=!!race.player.dnf||race.index>=event.sectors.length;return gaps(race);
}
export function gridOutcome(race){const rank=gridStandings(race).find(e=>e.id==='player').position,dnf=!!race.player.dnf;return {won:!dnf&&rank===1,position:rank,medal:dnf?null:['gold','silver','bronze'][rank-1]||null,label:dnf?'Сход · вылет с трассы':'Место '+rank+' / 4',reward:dnf?0:[55000,32000,20000,12000][rank-1],street:0,official:dnf?0:[18,12,8,4][rank-1]};}
export function gridClock(race){const active=all(race).filter(e=>!e.state.dnf);return active.length?(race.finished?Math.max:Math.min)(...active.map(e=>e.state.time)):race.player.time;}
export function gridReplay(race){return {version:1,pits:[...race.grid.pits],rank:gridStandings(race).find(e=>e.id==='player').position,rivals:race.grid.rivals.map(e=>({id:e.id,carId:e.config.car.id,pits:[...e.pits],sectorTimes:e.history.map(h=>h.playerTime),actions:e.history.map(h=>h.cardId),lines:e.history.map(h=>h.lineId),slips:e.history.map(h=>h.slip),...(e.state.dnf?{dnf:true}:{})}))};}
