import {CREWS,CHALLENGES,challengeReason,challengeTarget,rivalConfig} from './rivals.js';
import {CARS,PARTS,getEvent} from './data.js';
import {escapeHTML} from './career-view.js';
export function rivalsHTML(career,locked=false){
 return `<section class="rivals-panel"><div class="section-title"><div><div class="eyebrow">LOCAL CREWS / 地元</div><h2>Местные команды</h2></div><span>Побеждено ${career.rivals?.completed.length||0} / ${CHALLENGES.length}</span></div><p class="notice">У каждого соперника постоянная сборка и стиль. Вызовы внутри команды идут по порядку; трассу нужно открыть в карьере. Бонус за первую победу выдаётся один раз. Повторные встречи приносят только обычные призовые.</p><div class="crew-grid">${CREWS.map(crew=>{
 const stages=CHALLENGES.filter(c=>c.crew===crew.id),complete=stages.every(c=>career.rivals?.completed.includes(c.id));
 return `<article class="panel crew"><div class="eyebrow">${crew.territory}</div><h2>${crew.name}</h2><p>${crew.description}</p>${complete?'<p class="positive">◆ '+crew.badge+'</p>':''}${stages.map(c=>{
 const config=rivalConfig(c),done=career.rivals?.completed.includes(c.id),reason=challengeReason(career,c.id),target=challengeTarget(c);
 return `<section class="crew-challenge"><span class="micro">${done?'✓ ПОБЕЖДЁН':'ВЫЗОВ'} · ${getEvent(c.eventId).title} · ${c.weather==='rain'?'Дождь':c.weather==='dry'?'Сухо':'Переменная влажность'}</span><h3>${c.name} · ${c.title}</h3><p>${CARS.find(car=>car.id===c.carId).name} · ${config.car.power} л.с.<br>${c.parts.map(id=>PARTS.find(p=>p.id===id).name).join(', ')||'Заводская сборка'}<br>${c.tell}</p><span class="micro">${target!==null?'ЦЕЛЬ: '+target+' БАЛЛОВ ИЛИ ВЫШЕ':'ЦЕЛЬ: ПОБЕДА В ДУЭЛИ'} · ${done?'БОНУС ПОЛУЧЕН':'ПЕРВАЯ ПОБЕДА: ¥'+c.reward.toLocaleString('ru-RU')}</span><button class="${reason?'secondary':'primary'} wide" data-challenge="${c.id}" ${locked||reason?'disabled':''}>${reason|| (done?'Повторить встречу':'Принять вызов ↗')}</button></section>`;
 }).join('')}</article>`;
 }).join('')}</div></section>`;
}
export function challengeReportHTML(report){
 if(!report)return '';
 return `<section class="panel challenge-report"><h2>${escapeHTML(report.name)} · ${report.succeeded?'вызов пройден':'вызов не пройден'}</h2><p>${report.first?'Первая победа: +¥'+report.reward.toLocaleString('ru-RU')+(report.debtPaid?' · удержано за ремонт ¥'+report.debtPaid:''):report.succeeded?'Разовая награда уже получена.':'Повтори встречу после подготовки машины.'}${report.badge?'<br>◆ '+escapeHTML(report.badge):''}</p><button id="return-rivals" class="secondary">К местным командам →</button></section>`;
}
