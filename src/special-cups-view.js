import {SPECIAL_CUPS,buildValue} from './special-cups.js';
import {cupUnlockReason,regulationReason} from './championship.js';
import {getEvent} from './data.js';
export function specialCupsHTML(career,config,locked=false){
 return `<section class="special-cups"><h2>Особые регламенты</h2><p class="notice">Дополнительные серии для разных сборок. Они не заменяют пять основных чемпионатов. Регламент проверяется при регистрации и перед каждым этапом. Первое прохождение даёт полный итоговый приз, повторное — 40%. Стоимость текущей сборки: ¥${buildValue(config).toLocaleString('ru-RU')}.</p><div class="special-cup-grid">${SPECIAL_CUPS.map(c=>{
 const reason=cupUnlockReason(career,c)||regulationReason(config,c),active=career.championships.active,poor=career.money<c.fee;
 return `<article class="panel"><div class="eyebrow">${career.championships.completed.includes(c.id)?'✓ ПОДИУМ ПОЛУЧЕН':'ОСОБАЯ СЕРИЯ'}</div><h2>${c.name}</h2><p>${c.ruleText}</p><ol>${c.stages.map(([id,w])=>'<li>'+getEvent(id).title+' · '+({dry:'Сухо',mixed:'Переменная влажность',rain:'Дождь'})[w]+'</li>').join('')}</ol><p>Взнос ¥${c.fee.toLocaleString('ru-RU')} · первое место ¥${c.prizes[0].toLocaleString('ru-RU')}</p>${reason?'<p class="negative">'+reason+'</p>':''}<button class="primary" data-special-enter="${c.id}" ${locked||active||reason||poor?'disabled':''}>${active?'Уже идёт кубок':poor?'Недостаточно денег':'Заявиться на выбранной машине'}</button></article>`;
 }).join('')}</div></section>`;
}
