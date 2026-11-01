import {EVENTS,getEvent,eventLength} from './data.js';
export const XP_LEVELS=[0,80,200,360,560,800,1080,1400,1760,2160];
export const MAX_ACTIVE_SKILLS=2;
export const SPECIALIZATIONS=[
 {id:'precision',name:'Точность',description:'Разброс исполнения в поворотах уже на 8% за ранг. Не меняет бросок и не отменяет риск вылета.',unlock:'Поздний выпуск'},
 {id:'control',name:'Контроль машины',description:'Нагрузка в мокром или агрессивном повороте ниже на 0,018 за ранг. В дрифте точность +0,008 за ранг.',unlock:'Баланс на грани'},
 {id:'endurance',name:'Выносливость',description:'Положительный расход концентрации ниже на 5% за ранг. Восстановление и штраф повторов сохраняются.',unlock:'Ритм дыхания'},
 {id:'racecraft',name:'Гоночная борьба',description:'Позиционные приёмы требуют на 8% меньше фокуса за ранг; слипстрим эффективнее на 0,4 п.п. за ранг.',unlock:'Обманный вход'}
];
export const SKILL_CARDS=[
 {id:'skill-release',skill:'precision',name:'Поздний выпуск',en:'LATE RELEASE',icon:'◇',category:'Специализация',desc:'Потратить время на точный выход: +8% скорости входа в следующий участок.',gain:-.012,focus:9,heat:3,wear:1,risk:.06,only:'corner'},
 {id:'skill-balance',skill:'control',name:'Баланс на грани',en:'GRIP BALANCE',icon:'⌁',category:'Специализация',desc:'Работа со сцеплением на мокром повороте. Умеренный темп и нагрузка.',gain:.035,focus:7,heat:2,wear:1.2,risk:-.12,only:'wet',cornerOnly:true},
 {id:'skill-rhythm',skill:'endurance',name:'Ритм дыхания',en:'BREATHING RHYTHM',icon:'◌',category:'Специализация',desc:'Восстановить 14 фокуса с меньшей потерей темпа, чем у полного восстановления.',gain:-.02,focus:-14,heat:-4,wear:.8,risk:-.08},
 {id:'skill-feint',skill:'racecraft',name:'Обманный вход',en:'FEINT ENTRY',icon:'↯',category:'Дуэль',desc:'Атака в повороте при разрыве не больше 2,5 с. Требует фокуса и сцепления.',gain:.055,focus:14,heat:10,wear:1.6,risk:.13,only:'corner',gap:'close'}
];
export const emptyPlayer=()=>({xp:0,learned:{},active:[],seenEvents:[]});
export function playerLevel(xp){return XP_LEVELS.filter(n=>n<=Math.max(0,Number.isFinite(xp)?xp:0)).length;}
export function normalizePlayer(raw,career={}){
 const out=emptyPlayer();out.xp=Math.min(XP_LEVELS.at(-1),Math.max(0,Math.floor(Number.isFinite(raw?.xp)?raw.xp:(Number.isFinite(career.races)?career.races:0)*30)));
 let remaining=playerLevel(out.xp)-1;
 for(const spec of SPECIALIZATIONS){const rank=raw?.learned?.[spec.id];if(Number.isInteger(rank)&&rank>=1&&rank<=3&&rank<=remaining){out.learned[spec.id]=rank;remaining-=rank;}}
 out.active=SPECIALIZATIONS.filter(s=>Array.isArray(raw?.active)&&raw.active.includes(s.id)&&out.learned[s.id]).map(s=>s.id).slice(0,MAX_ACTIVE_SKILLS);
 out.seenEvents=EVENTS.filter(e=>raw?Array.isArray(raw.seenEvents)&&raw.seenEvents.includes(e.id):career.eventCompletions?.[e.id]>0).map(e=>e.id);
 return out;
}
export function playerPoints(player){return playerLevel(player.xp)-1-Object.values(player.learned).reduce((sum,n)=>sum+n,0);}
export function trainingSnapshot(player){const p=normalizePlayer(player);return Object.fromEntries(p.active.map(id=>[id,p.learned[id]]));}
export function validTraining(raw){return !!raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).length<=MAX_ACTIVE_SKILLS&&Object.entries(raw).every(([id,n])=>SPECIALIZATIONS.some(s=>s.id===id)&&Number.isInteger(n)&&n>=1&&n<=3);}
export function withTraining(config,training={}){
 if(!validTraining(training))throw new Error('Некорректные специализации');
 return {...config,training:{...training}};
}
export const playerConfiguration=(config,player)=>withTraining(config,trainingSnapshot(player));
export function trainingKey(config){return SPECIALIZATIONS.filter(s=>config.training?.[s.id]).map(s=>s.id+':'+config.training[s.id]).join(',');}
export function unlockedSkillCards(config){return SKILL_CARDS.filter(c=>config.training?.[c.skill]===3);}
function editable(career,locked){if(locked)throw new Error('Сначала заверши текущий заезд');const next=structuredClone(career);next.player=normalizePlayer(next.player,next);return next;}
export function trainPlayer(career,id,locked=false){
 const next=editable(career,locked);if(!SPECIALIZATIONS.some(s=>s.id===id))throw new Error('Специализация не найдена');
 const rank=next.player.learned[id]||0;if(rank>=3)throw new Error('Максимальный ранг');if(playerPoints(next.player)<1)throw new Error('Нужно очко развития');
 next.player.learned[id]=rank+1;if(!next.player.active.includes(id)&&next.player.active.length<MAX_ACTIVE_SKILLS)next.player.active.push(id);next.player=normalizePlayer(next.player,next);return next;
}
export function togglePlayerSkill(career,id,locked=false){
 const next=editable(career,locked);if(!next.player.learned[id])throw new Error('Сначала изучи специализацию');
 if(next.player.active.includes(id))next.player.active=next.player.active.filter(s=>s!==id);
 else {if(next.player.active.length>=MAX_ACTIVE_SKILLS)throw new Error('Одновременно доступны две специализации');next.player.active.push(id);}next.player=normalizePlayer(next.player,next);return next;
}
export function resetPlayer(career,locked=false){const next=editable(career,locked);next.player.learned={};next.player.active=[];return next;}
export function settlePlayer(career,race,outcome){
 const next=structuredClone(career);next.player=normalizePlayer(next.player,next);const before=next.player.xp,level=playerLevel(before);
 const eligible=race.finished&&!race.manager&&!race.player.dnf&&!race.player.drag?.falseStart;
 const event=getEvent(race.eventId,race.routeVersion),complete=race.history.length===event.sectors.length;
 let earned=0;
 if(eligible){earned=Math.round(Math.min(60,20+eventLength(event)/1000*5)*race.history.length/event.sectors.length)+(outcome.won||outcome.medal?10:0);
  if(complete&&!next.player.seenEvents.includes(event.id)){earned+=20;next.player.seenEvents.push(event.id);}
  next.player.xp=Math.min(XP_LEVELS.at(-1),before+earned);
 }
 next.player=normalizePlayer(next.player,next);
 return {career:next,report:{earned:next.player.xp-before,xp:next.player.xp,level:playerLevel(next.player.xp),levelsGained:playerLevel(next.player.xp)-level,points:playerPoints(next.player)}};
}
export function trainedExecution(config,sector,execution){
 if(!execution||sector.type!=='corner'||!config.training?.precision)return execution;
 const factor=1-config.training.precision*.08;return {...execution,range:execution.range*factor,error:execution.error*factor};
}
