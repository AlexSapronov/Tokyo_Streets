import {SETUP_FIELDS,normalizeSetup} from './setup.js';
import {installedEngineId} from './engine-data.js';
import {WORKSHOP_PRESETS,presetQuote,tuningReputation} from './workshop.js';
export function workshopHTML(career,locked=false){
 return `<section class="panel workshop-panel"><h2>Платная настройка</h2>${workshopResultHTML(career)}<p>Мастерская сразу меняет доступные регулировки твоей машины с качеством 85–100% от целевого пресета. Каждая платная попытка получает новый разброс. Платишь деньгами и Street Cred за помощь со стороны. Детали не покупаются; ручные настройки и свои пресеты бесплатны.</p><p class="micro">Репутация для доступа к тюнингу: ${tuningReputation(career)} репутации. Уже открытые детали остаются доступны после траты Street Cred.</p><div class="operations-grid">${WORKSHOP_PRESETS.map(p=>{const q=presetQuote(career,p.id);return `<article><h3>${q.name}</h3><p>${q.description}</p><p><strong>¥${q.money.toLocaleString('ru-RU')} и −${q.street} Street Cred</strong></p><button data-workshop-preset="${q.id}" class="primary" ${locked||q.reason?'disabled':''}>${q.reason||'Оплатить и настроить'}</button></article>`;}).join('')}</div><p class="micro">Закрытые регулировки требуют соответствующего оборудования. Это стартовые настройки под режим: они не гарантируют лучшее время или оценку дрифта.</p></section>`;
}

export function workshopResultHTML(career){
 const job=career.lastWorkshop,profile=WORKSHOP_PRESETS.find(p=>p.id===job?.profile);
 if(!job||job.carId!==career.car||!profile)return '';
 const heading='<strong>Последняя работа: '+profile.name+' · '+Math.round(job.quality*100)+'% качества</strong>';
 const open='<button class="secondary" data-workshop-open-setup>Параметры машины →</button>';
 if(job.detailVersion!==1)return '<div class="notice workshop-result" role="status">'+heading+'<p>В старом сохранении нет подробностей этой работы. Процент относится к прошлому результату, а не к текущим параметрам машины.</p>'+open+'</div>';
 const parts=career.builds[career.car],setup=normalizeSetup(parts,career.setups[career.car]);
 const same=installedEngineId(career)===job.engineId&&[...parts].sort().join(',')===[...job.parts].sort().join(',')&&SETUP_FIELDS.every(f=>setup[f.key]===job.after[f.key]);
 const changed=SETUP_FIELDS.filter(f=>job.before[f.key]!==job.after[f.key]);
 return '<div class="notice workshop-result" role="status">'+heading+'<p>Списано: ¥'+job.paidMoney.toLocaleString('ru-RU')+' и '+job.paidStreet+' Street Cred.</p><p>'+(same?'Этот результат сейчас установлен на машине.':'После этой работы сборка или настройки изменены. Процент качества относится к прошлой работе.')+'</p>'+(changed.length?'<details><summary>Что изменилось после оплаты</summary><div class="table-wrap"><table><thead><tr><th>Параметр</th><th>Было</th><th>Получено</th></tr></thead><tbody>'+changed.map(f=>'<tr><td>'+f.label+'</td><td>'+job.before[f.key]+' '+f.unit+'</td><td>'+job.after[f.key]+' '+f.unit+'</td></tr>').join('')+'</tbody></table></div></details>':'<p>После округления параметры остались прежними. Попытка настройки оплачена.</p>')+open+'</div>';
}
