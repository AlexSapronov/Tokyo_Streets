import {EVENTS,DISCIPLINES,getEvent} from './data.js';
import {MILESTONES,nextMilestone,routeTarget,STAMP_REWARDS,STAMP_NAMES} from './journey.js';
const money=n=>'¥'+n.toLocaleString('ru-RU');
export function routeMasteryHTML(career,event){
 const level=career.journey?.routes[event.id]||0;
 return `<div class="route-mastery"><strong>Освоение ${level}/3 · ${STAMP_NAMES.map((_,i)=>i<level?'◆':'◇').join(' ')}</strong><p>${routeTarget(event,level)}${level<3?' · разовая награда '+money(STAMP_REWARDS[level]):''}</p></div>`;
}
export function journeyFocusHTML(career,locked=false){
 const m=nextMilestone(career),done=career.journey?.claimed.length||0;
 const suggestion=m&&['debut','result','explore'].includes(m.id)?EVENTS.find(e=>career.street>=e.unlockStreet&&career.races>=e.unlockRaces&&(career.journey?.routes[e.id]||0)<(m.id==='result'?2:1)):null;
 return `<section class="journey-focus" aria-label="Следующая цель карьеры"><div><span class="eyebrow">ПУТЬ КОМАНДЫ · ${done}/${MILESTONES.length}</span><strong>${m?m.title:'Легенда Tokyo Streets'}</strong><span>${m?m.detail:'Главный путь пройден. Осваивай трассы, собирай машины и проводи свои серии.'}</span></div>${m?`<div>${suggestion?`<button class="secondary" data-journey-event="${suggestion.id}" ${locked?'disabled':''}>${suggestion.title} ↗</button>`:''}<b>${Math.min(m.target,m.value(career))}/${m.target} · +${money(m.reward)}</b><button class="secondary" data-journey-view="${m.view}" ${locked?'disabled':''}>${{race:'К заезду',world:'Выбрать маршрут',team:'К команде',seasons:'К чемпионатам'}[m.view]} ↗</button></div>`:''}</section>`;
}
export function journeyHTML(career){
 return `<section class="journey-panel"><h2>От первого заезда до Japan Masters</h2><p>Новые результаты дают разовые премии на развитие гаража. Повторы сохраняют обычные призовые; машина, погода и переустановка деталей не сбрасывают отметки. На старых сохранениях подтверждённые достижения зачтены без повторной выплаты.</p><div class="journey-steps">${MILESTONES.map(m=>{const done=career.journey.claimed.includes(m.id);return `<article class="panel"><span class="eyebrow">${done?'✓ ЗАЧТЕНО':Math.min(m.target,m.value(career))+'/'+m.target}</span><h3>${m.title}</h3><p>${m.detail}</p><strong>${money(m.reward)} ${done?'· получено / перенесено':'· разовая премия'}</strong></article>`;}).join('')}</div><h2>Твоя специализация</h2><div class="journey-disciplines">${DISCIPLINES.map(d=>{const events=EVENTS.filter(e=>e.mode===d.id),stamps=events.reduce((n,e)=>n+(career.journey.routes[e.id]||0),0);return `<article class="panel"><h3>${d.name}</h3><progress max="${events.length*3}" value="${stamps}" aria-label="Освоение: ${d.name}"></progress><p>${stamps}/${events.length*3} отметок · ${events.filter(e=>(career.journey.routes[e.id]||0)===3).length} трасс освоено</p></article>`;}).join('')}</div></section>`;
}
export function journeyReportHTML(report,eventId){
 if(!report)return '';
 return `<section class="panel journey-report"><h3>Прогресс карьеры · ${getEvent(eventId).title}</h3>${report.bonus?`<p class="positive">Разовые премии +${money(report.bonus)}${report.debtPaid?' · удержано за ремонт '+money(report.debtPaid):''}</p><p>${[...report.stamps.map(s=>s.name+' +'+money(s.reward)),...report.milestones.map(m=>m.title+' +'+money(m.reward))].join(' · ')}</p>`:'<p>Новых отметок нет. Следующую цель смотри в карьере; сход и фальстарт не дают прогресса.</p>'}</section>`;
}
