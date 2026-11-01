import {EVENTS,getEvent} from './data.js';
import {normalizeSetup} from './setup.js';
export const STAFF={
 mechanic:{name:'Механик',fees:[12000,18000],wages:[450,800],description:'Скидка на полный и аварийный ремонт: 15% / 25%. Не меняет физику машины.'},
 engineer:{name:'Инженер',fees:[15000,22000],wages:[600,1000],description:'Рекомендации настроек под событие и покрытие; второй уровень добавляет вариант с приоритетом темпа.'}
};
export const SPONSORS=[
 {id:'yokohama',name:'Yokohama · клубная программа',street:24,official:0,modes:['duel','timeattack'],goal:3,limit:5,maxFailures:2,pay:1200,bonus:9000,description:'Три действительных финиша с остатком шин от 70% и состоянием машины от 55%. До пяти подходящих стартов, не больше двух неудач.'},
 {id:'exedy',name:'EXEDY · чистый старт',street:0,official:12,modes:['drag'],goal:3,limit:5,maxFailures:1,pay:1000,bonus:7500,description:'Три финиша в дрэге без фальстарта и схода, состояние от 55%. До пяти стартов, не больше одной неудачи.'},
 {id:'hks',name:'HKS · тепловая дисциплина',street:36,official:20,modes:['duel','timeattack','drag','drift'],goal:2,limit:4,maxFailures:1,pay:1300,bonus:10000,description:'Два финиша: масло не выше 125°C и вода не выше 105°C на всех отсечках, состояние от 60%. До четырёх стартов, не больше одной неудачи.'}
];
export function emptyOperations(){return {staff:{mechanic:0,engineer:0},active:null,completed:[],history:[],availableAfter:{},pending:null};}
const finite=n=>Number.isFinite(n),validId=id=>SPONSORS.some(s=>s.id===id),token=t=>typeof t==='string'&&t.length>0&&t.length<=80;
export function normalizeOperations(raw){
 const out=emptyOperations();if(!raw||typeof raw!=='object')return out;
 for(const id of Object.keys(STAFF))out.staff[id]=Number.isInteger(raw.staff?.[id])?Math.max(0,Math.min(2,raw.staff[id])):0;
 out.completed=[...new Set((Array.isArray(raw.completed)?raw.completed:[]).filter(validId))];
 out.availableAfter=Object.fromEntries(SPONSORS.filter(s=>Number.isInteger(raw.availableAfter?.[s.id])&&raw.availableAfter[s.id]>=0).map(s=>[s.id,Math.min(1000000,raw.availableAfter[s.id])]));
 out.history=(Array.isArray(raw.history)?raw.history:[]).filter(h=>h&&validId(h.id)&&['done','failed','cancelled'].includes(h.status)&&token(h.token)&&Number.isInteger(h.attempts)&&h.attempts>=0&&h.attempts<=5&&Number.isInteger(h.successes)&&h.successes>=0&&h.successes<=h.attempts&&finite(h.earned)&&h.earned>=0&&h.earned<=50000).slice(0,20).map(h=>({id:h.id,status:h.status,token:h.token,attempts:h.attempts,successes:h.successes,earned:h.earned}));
 const a=raw.active,s=SPONSORS.find(s=>s.id===a?.id);
 if(s&&token(a.token)&&Number.isInteger(a.attempts)&&a.attempts>=0&&a.attempts<=s.limit&&Number.isInteger(a.successes)&&a.successes>=0&&a.successes<s.goal&&Number.isInteger(a.failures)&&a.failures>=0&&a.failures<=s.maxFailures&&a.successes+a.failures<=a.attempts&&a.attempts-a.successes-a.failures<=1&&finite(a.earned)&&a.earned>=0&&a.earned<=50000)out.active={id:a.id,token:a.token,attempts:a.attempts,successes:a.successes,failures:a.failures,earned:a.earned};
 const p=raw.pending;if(p&&token(p.runId)&&EVENTS.some(e=>e.id===p.eventId)&&(p.contractToken===null||token(p.contractToken)))out.pending={runId:p.runId,eventId:p.eventId,contractToken:p.contractToken};
 if(out.active&&out.active.attempts>out.active.successes+out.active.failures&&out.pending?.contractToken!==out.active.token)out.active=null;
 return out;
}
function editable(career,active){if(active)throw new Error('Сначала заверши текущий заезд');const next=structuredClone(career);next.operations??=emptyOperations();return next;}
export function supportCost(career){return Object.entries(STAFF).reduce((n,[id,s])=>n+(s.wages[(career.operations?.staff[id]||0)-1]||0),0);}
export function repairMultiplier(career){return [1,.85,.75][career.operations?.staff.mechanic||0];}
export function hireStaff(career,id,active=false){
 const next=editable(career,active),role=STAFF[id];if(!role)throw new Error('Специалист не найден');if(!next.team.founded)throw new Error('Сначала основать команду');
 const level=next.operations.staff[id];if(level>=2)throw new Error('Максимальный уровень специалиста');if(next.money<role.fees[level])throw new Error('Недостаточно денег на специалиста');
 next.money-=role.fees[level];next.operations.staff[id]++;return next;
}
export function dismissStaff(career,id,active=false){const next=editable(career,active);if(!STAFF[id]||!next.operations.staff[id])throw new Error('Специалист не нанят');next.operations.staff[id]=0;return next;}
export function sponsorReason(career,id){
 const s=SPONSORS.find(s=>s.id===id);if(!s)return 'Программа не найдена';if(!career.team.founded)return 'Нужно основать команду';
 if(career.street<s.street||career.official<s.official)return `Нужно ${s.street} Street Cred и ${s.official} Official Rep`;
 if(career.races<(career.operations?.availableAfter[id]||0))return `Программа вернётся после ${career.operations.availableAfter[id]-career.races} зачётных финишей`;
 return '';
}
export function acceptSponsor(career,id,contractToken,active=false){
 const next=editable(career,active),reason=sponsorReason(next,id);if(reason)throw new Error(reason);if(next.operations.active)throw new Error('Уже есть активный спонсорский контракт');if(!token(contractToken))throw new Error('Нужен идентификатор контракта');
 next.operations.active={id,token:contractToken,attempts:0,successes:0,failures:0,earned:0};return next;
}
function closeContract(next,status){
 const ops=next.operations,a=ops.active;if(!a)return;
 ops.history.unshift({id:a.id,status,token:a.token,attempts:a.attempts,successes:a.successes,earned:a.earned});ops.history=ops.history.slice(0,20);ops.availableAfter[a.id]=next.races+3;
 if(status==='done'&&!ops.completed.includes(a.id))ops.completed.push(a.id);ops.active=null;
}
export function cancelSponsor(career,active=false){const next=editable(career,active);if(!next.operations.active)throw new Error('Нет активного контракта');closeContract(next,'cancelled');return next;}
function exhausted(next){const a=next.operations.active;if(!a)return;const s=SPONSORS.find(s=>s.id===a.id);if(a.failures>s.maxFailures||a.attempts>=s.limit||a.successes+s.limit-a.attempts<s.goal)closeContract(next,'failed');}
export function bookSupport(career,eventId,runId){
 const next=editable(career,false);if(!token(runId)||next.awardedRuns.includes(runId)||next.operations.pending?.runId===runId)throw new Error('Нужен новый идентификатор старта');if(!EVENTS.some(e=>e.id===eventId))throw new Error('Событие не найдено');
 const fee=supportCost(next);if(next.money<fee)throw new Error('Недостаточно денег на персонал. Можно освободить специалистов в штабе команды.');
 const ops=next.operations;
 if(ops.pending?.contractToken&&ops.active?.token===ops.pending.contractToken){ops.active.failures++;exhausted(next);}
 const s=SPONSORS.find(s=>s.id===ops.active?.id);let contractToken=null;
 if(s&&s.modes.includes(getEvent(eventId).mode)){ops.active.attempts++;contractToken=ops.active.token;}
 ops.pending={runId,eventId,contractToken};next.money-=fee;return {career:next,fee};
}
function successReason(career,race,s){
 if(race.player.dnf||race.player.drag?.falseStart)return 'Сход или фальстарт';
 if(race.index!==getEvent(race.eventId,race.routeVersion).sectors.length)return 'Нет полного зачётного финиша';
 const condition=career.condition[race.config.car.id];
 if(condition<(s.id==='hks'?60:55))return 'Не сохранено требуемое состояние машины';
 if(s.id==='yokohama'&&race.player.tires<70)return 'Остаток шин ниже 70%';
 if(s.id==='hks'&&(race.history.length!==race.index||race.history.some(row=>!finite(row.telemetry?.oil)||!finite(row.telemetry?.coolant)||row.telemetry.oil>125||row.telemetry.coolant>105)))return 'Превышен тепловой предел или нет телеметрии';
 return '';
}
export function settleSupport(career,race){
 if(!race.finished)throw new Error('Заезд не завершён');
 const next=structuredClone(career);next.operations??=emptyOperations();const ops=next.operations,p=ops.pending;
 if(!p||p.runId!==race.runId||p.eventId!==race.eventId)return {career:next,report:null};
 ops.pending=null;const a=ops.active;if(!a||a.token!==p.contractToken)return {career:next,report:null};
 const s=SPONSORS.find(s=>s.id===a.id),reason=successReason(next,race,s),factor=ops.completed.includes(s.id)?.5:1;let earned=0;
 if(reason)a.failures++;else{a.successes++;earned=Math.round(s.pay*factor);}
 const done=a.successes>=s.goal;if(done)earned+=Math.round(s.bonus*factor);
 a.earned+=earned;const debtPaid=Math.min(next.repairDebt||0,Math.floor(earned*.5));next.repairDebt=(next.repairDebt||0)-debtPaid;next.money+=earned-debtPaid;
 const report={id:s.id,success:!reason,reason:reason||'Условия выполнены',earned,debtPaid,successes:a.successes,attempts:a.attempts,goal:s.goal,status:'active'};
 if(done){closeContract(next,'done');report.status='done';}else{exhausted(next);if(!ops.active)report.status='failed';}
 return {career:next,report};
}
export function engineerAdvice(career,profile='safe'){
 const level=career.operations?.staff.engineer||0;if(!level)throw new Error('Нужен инженер команды');if(!['safe','pace'].includes(profile)||profile==='pace'&&level<2)throw new Error('Профиль темпа требует инженера второго уровня');
 const event=getEvent(career.eventId),wet=career.weather==='rain'||career.weather==='mixed'&&event.sectors.reduce((n,s)=>n+s.wet,0)/event.sectors.length>.3;
 const drag=event.mode==='drag',drift=event.mode==='drift',long=event.id==='yokohama-mile',safe=profile==='safe';
 const values={pressure:wet?2.05:drag?(long?2.3:2.05):drift?2.1:2.2,finalDrive:drag?(long?.92:1.08):1.04,springRate:wet?90:safe?100:110,brakeBias:drift?58:safe?64:60,wing:drag?10:drift?35:wet?70:safe?60:50};
 return {setup:normalizeSetup(career.builds[career.car],values),eventId:event.id,profile,reasons:[wet?'Мокрое покрытие: мягче пружины и больше внимания сцеплению':'Сухой маршрут: баланс отклика и износа',drag?(long?'Миля: ниже обороты и сопротивление':'Короткий дрэг: приоритет старта'):drift?'Дрифт: облегчить вращение, контролировать целевой угол':'Дорожный заезд: баланс торможения и выхода',safe?'Приоритет стабильности':'Приоритет темпа'],note:'Стартовая рекомендация по условиям, не гарантированно оптимальная настройка. Закрытые регулировки не меняются.'};
}
