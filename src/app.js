import {CARS, PILOTS, PARTS, EVENTS, CARDS, getEvent, sectorAt, eventLength} from './data.js';
import {configuration, availableCards, disabledReason, simulate, createRace, resolveSector, medalTargets, raceOutcome} from './engine.js';
import {loadCareer, storeCareer, newCareer} from './storage.js';
import {awardRace, bestFor, unlocked, unlockText, cumulativeTimes, raceRecord} from './progress.js';
import {vehicleSVG} from './vehicles.js';
import {Scene} from './scene.js';

const $ = selector => document.querySelector(selector);
const app = $('#app');
let storage;
try { storage = window.localStorage; }
catch { storage = {getItem: () => null, setItem: () => {throw Error('Нет хранилища');}}; }
let career = loadCareer(storage);
if (!unlocked(getEvent(career.eventId),career)) career.eventId = 'haruna';
let view = 'race', race = null, selected = 'balanced', filter = 'Все';
let busy = false, scene = null, fast = false, paused = false, replayRecord = null;
let toastTimer;
const money = value => '¥ ' + Math.round(value).toLocaleString('ru-RU');
const time = value => `${Math.floor(value/60)}:${(value%60).toFixed(2).padStart(5,'0')}`;
const signed = value => (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(2);
const weatherName = value => ({dry:'Сухо',mixed:'Переменная влажность',rain:'Дождь'})[value];
const car = () => CARS.find(car => car.id === career.car);
const pilot = () => PILOTS.find(pilot => pilot.id === career.pilot);
function config() { return configuration(career.car,career.pilot,career.builds[career.car],career.condition[career.car]); }
function previewRace() {
  if (replayRecord) return createRace(configuration(replayRecord.carId,replayRecord.pilotId,replayRecord.parts,replayRecord.condition),replayRecord.weather,replayRecord.eventId);
  return race || createRace(config(),career.weather,career.eventId);
}
function ghostFor(r) { return race === r && !r.finished ? race.ghost : bestFor(career,r.config,r.eventId,r.weather); }
function updateWallet() { $('#wallet').textContent = money(career.money); }
function save() {
  if (!storeCareer(storage,career)) toast('Сохранение недоступно. Прогресс живёт до закрытия страницы.');
  updateWallet();
}
function toast(message) {
  $('#toast').textContent=message;$('#toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);
}
function metric(label,value,max,suffix,color='var(--green)') {
  return `<div class="metric"><div class="metric-line"><span>${label}</span><strong>${Math.round(value)}${suffix}</strong></div>
    <div class="bar"><i style="width:${Math.min(100,value/max*100)}%;background:${color}"></i></div></div>`;
}
function render() {
  scene?.destroy();scene=null;
  document.querySelectorAll('[data-view]').forEach(button=>{
    button.classList.toggle('active',button.dataset.view===view);button.disabled=busy;
  });
  if(view==='garage')renderGarage();else if(view==='world')renderWorld();else renderRace();
  updateWallet();
}
function sectorDescription(s) {
  return `${s.label} · ${s.length} м${s.radius?' · радиус '+s.radius+' м':''} · уклон ${Math.round(s.slope*100)}% · влажность ${Math.round(s.wet*100)}%`;
}
function medalHTML(eventId,weather) {
  const targets=medalTargets(eventId,weather);
  return `<div class="medal-targets"><span>● Золото <strong>${time(targets.gold)}</strong></span>
    <span>● Серебро <strong>${time(targets.silver)}</strong></span><span>● Бронза <strong>${time(targets.bronze)}</strong></span></div>`;
}
function renderRace() {
  const r=previewRace(),event=getEvent(r.eventId),count=event.sectors.length;
  const s=sectorAt(Math.min(r.index,count-1),r.weather,event.id),duel=r.mode==='duel';
  const gap=r.player.time-r.opponent.time,ghost=ghostFor(r),isReplay=!!replayRecord;
  app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">JAPAN / ${event.region}</div>
      <h1>${isReplay?'Твоя лучшая линия.':event.title}</h1></div><div class="event-controls">
      <label><span class="micro">СОБЫТИЕ</span><select id="event-select" ${race||isReplay?'disabled':''}>
      ${EVENTS.map(item=>`<option value="${item.id}" ${!unlocked(item,career)?'disabled':''}>${item.title}${!unlocked(item,career)?' · '+unlockText(item):''}</option>`).join('')}</select></label>
      <label><span class="micro">ПОКРЫТИЕ</span><select id="weather" ${race||isReplay?'disabled':''}><option value="mixed">☂ Переменная влажность</option><option value="dry">☾ Сухой асфальт</option><option value="rain">☂ Дождь</option></select></label></div></div>
    <div class="race-layout"><section><div class="scene-wrap"><canvas id="scene" aria-label="Изометрическая трасса ${event.title}"></canvas>
      <div class="scene-top"><div><div class="eyebrow">${event.japanese} · ${event.name.toUpperCase()}</div><h2>${event.title}</h2><span class="badge">${duel?'TOUGE / DUEL':'OFFICIAL / TIME ATTACK'}</span></div>
      <div class="route-stats">${(eventLength(event)/1000).toFixed(2)} KM<br>${count} СЕКТОРОВ<br>${event.theme==='circuit'?'18:20':'23:48'} / 12°C<br>ЗАКРЫТЫЙ МАРШРУТ</div></div>
      <div class="scene-caption"><div class="stamp" id="scene-status">${isReplay?'ПОВТОР РЕКОРДА':r.finished?'ФИНИШ':race?'СЕКТОР '+String(r.index+1).padStart(2,'0'):'ПЕРЕД СТАРТОМ'}</div>
      <h3 id="scene-sector">${r.finished?'До следующей встречи.':s.name}</h3>
      <p id="scene-description">${isReplay?'Сохранённые решения и время. Повтор не приносит наград.':race?sectorDescription(s):event.description}</p></div>
      <div class="scene-tools"><button id="pause" ${!isReplay?'disabled':''}>Ⅱ Пауза</button><button id="speed">${fast?'2×':'1×'} Скорость</button></div></div>
      <div class="sector-strip">${event.sectors.map((sector,i)=>`<div class="sector-node ${i<r.index?'done':i===r.index?'current':''}" title="${sector.name} · ${sector.length} м">${String(i+1).padStart(2,'0')} ${sector.type==='corner'?'⌁':'—'}</div>`).join('')}</div>
      <details class="route-brief"><summary>Разведка маршрута · ${count} секторов</summary><div class="route-list">${event.sectors.map((_,i)=>{const sector=sectorAt(i,r.weather,event.id);return `<div class="${i===r.index?'current':''}"><span class="micro">${String(i+1).padStart(2,'0')}</span><strong>${sector.name}</strong><span>${sectorDescription(sector)}</span></div>`;}).join('')}</div></details></section>
      <aside class="sidebar"><div class="panel"><div class="eyebrow">${isReplay?'МАШИНА В ПОВТОРЕ':'ТВОЯ МАШИНА'} <span style="float:right;color:var(--green)">${r.config.car.drive}</span></div>
      <div class="entry"><div class="car-swatch" style="--car:${r.config.car.color}"></div><div><strong>${r.config.car.name}</strong><span>${r.config.pilot.name} / ${r.config.pilot.trait}</span></div></div>
      ${isReplay?'<p class="micro">ПОВТОР СОХРАНЁННОЙ ЛИНИИ И РЕШЕНИЙ.<br>РЕСУРСЫ КАРЬЕРЫ НЕ РАСХОДУЮТСЯ.</p>':metric('Шины',r.player.tires,100,'%')+metric('Тормоза',r.player.heat,200,'°C',r.player.heat>110?'var(--red)':'var(--accent)')+metric('Концентрация',r.player.focus,r.config.pilot.focus,' / '+r.config.pilot.focus)}
      <div class="micro" style="margin-top:12px">СОСТОЯНИЕ ${r.config.condition.toFixed(0)}% · ${r.config.car.power} Л.С.</div></div>
      <div class="panel"><div class="eyebrow">${isReplay?'ХРОНОМЕТР':duel?'СОПЕРНИК / AI · ПЛАН НА 3 СЕКТОРА':'ОДИНОЧНАЯ СЕССИЯ'}</div>
      ${duel&&!isReplay?`<div class="entry"><div class="car-swatch" style="--car:${r.rival.car.color}"></div><div><strong>${r.rival.car.name}</strong><span>${r.rival.pilot.name} / ${r.rival.pilot.trait}</span></div></div>`:''}
      <div class="gap ${duel&&gap<=0?'positive':duel?'negative':''}" id="live-clock">${isReplay||!duel?time(r.player.time):signed(gap)}
      <small>${isReplay?'ПОВТОР БЕЗ НАГРАД':!duel?'ТВОЁ ВРЕМЯ':gap===0?'НА ОДНОЙ ЛИНИИ':gap<0?'ТЫ ВПЕРЕДИ / СЕК':'ТЫ ПОЗАДИ / СЕК'}</small></div>
      ${!duel?medalHTML(event.id,r.weather):''}
      ${isReplay?'<button id="stop-replay" class="secondary wide">Завершить просмотр</button>':!race?'<button id="start" class="primary wide">На старт ↗</button>':r.finished?'<button id="show-report" class="primary wide">Посмотреть результат ↓</button>':'<button id="abandon" class="secondary wide">Покинуть заезд</button>'}</div>
      ${!isReplay?`<div class="panel ghost-panel"><div class="eyebrow">ЛИЧНЫЙ РЕКОРД / ЭТА СБОРКА</div><div class="record-time">${ghost?time(ghost.time):'Первый ориентир — ты.'}</div>
      <p>${ghost?'Та же трасса, погода, машина, пилот и детали. Состояние в рекорде: '+ghost.condition.toFixed(0)+'%.':'Заверши заезд — появятся рекорд, призрак и повтор.'}</p>
      ${ghost?`<label class="ghost-toggle"><input id="ghost-toggle" type="checkbox" ${career.ghostEnabled?'checked':''}> Показывать призрак</label>${!race||race.finished?'<button id="replay-best" class="secondary wide">▶ Повтор рекорда</button>':''}`:''}</div>`:''}
      </aside></div>
    ${isReplay||r.finished?'':`<section class="cards-area"><div class="cards-header"><h2>Твои решения <span>ПОЛНЫЙ НАБОР · ${availableCards(r.config).length} КАРТ</span></h2><span class="micro">${race?'ВЫБЕРИ КАРТУ → ИСПОЛНИ СЕКТОР':'ПРОСМОТР ПЕРЕД СТАРТОМ'} · БЕЗ СЛУЧАЙНОЙ РАЗДАЧИ</span></div><div id="filters" class="filters"></div><div id="cards" class="cards-grid"></div><div id="forecast"></div></section>`}
    <div id="report"></div><div class="footer-line"><span>TOKYO STREETS / CLUB SEASON 0.2</span><span>КАРТЫ — НАМЕРЕНИЯ. РЕЗУЛЬТАТ — ФИЗИКА.</span></div>`;
  $('#weather').value=r.weather;$('#event-select').value=event.id;
  $('#weather').onchange=e=>{career.weather=e.target.value;save();render();};
  $('#event-select').onchange=e=>{if(!unlocked(getEvent(e.target.value),career))return;career.eventId=e.target.value;save();render();};
  scene=new Scene($('#scene'),r,ghost,career.ghostEnabled);scene.speed=fast?2:1;
  $('#speed').onclick=()=>{fast=!fast;scene.setSpeed(fast?2:1);$('#speed').textContent=(fast?'2×':'1×')+' Скорость';};
  $('#pause').onclick=()=>{paused=!paused;scene.setPaused(paused);$('#pause').textContent=paused?'▶ Продолжить':'Ⅱ Пауза';};
  if($('#ghost-toggle'))$('#ghost-toggle').onchange=e=>{career.ghostEnabled=e.target.checked;scene.showGhost=career.ghostEnabled;save();};
  if($('#start'))$('#start').onclick=startRace;
  if($('#abandon'))$('#abandon').onclick=confirmAbandon;
  if($('#replay-best'))$('#replay-best').onclick=()=>playReplay(ghost);
  if(isReplay){
    $('#stop-replay').onclick=stopReplay;
    scene.onTick=elapsed=>{
      $('#live-clock').innerHTML=time(elapsed)+'<small>ПОВТОР БЕЗ НАГРАД</small>';
      const ends=cumulativeTimes(replayRecord.sectorTimes);
      const match=ends.findIndex(value=>value>=elapsed-1e-8);
      const index=match<0?count-1:match;
      $('#scene-sector').textContent=event.sectors[index].name;
      const action=CARDS.find(card=>card.id===replayRecord.actions[index]);
      $('#scene-description').textContent=action.name+' · '+sectorDescription(sectorAt(index,r.weather,event.id));
      document.querySelectorAll('.sector-node').forEach((node,i)=>{node.classList.toggle('current',i===index);node.classList.toggle('done',i<index);});
    };
    scene.onComplete=()=>{stopReplay();toast('Повтор завершён. Время и награды карьеры не изменились.');};
    scene.replay(replayRecord,fast?6000:12000);
  }else{
    scene.onComplete=finishAnimation;
    if(r.finished){renderReport();$('#show-report').onclick=()=>$('#report').scrollIntoView({behavior:'smooth'});}
    else renderCards();
  }
}
function renderCards() {
  const r=previewRace(),sector=sectorAt(r.index,r.weather,r.eventId),gap=r.player.time-r.opponent.time;
  const cards=availableCards(r.config),categories=['Все',...new Set(cards.map(card=>card.category))];
  if(!categories.includes(filter))filter='Все';
  $('#filters').innerHTML=categories.map(category=>`<button class="filter ${filter===category?'active':''}" data-filter="${category}">${category}</button>`).join('');
  $('#filters').querySelectorAll('button').forEach(button=>button.onclick=()=>{if(busy)return;filter=button.dataset.filter;renderCards();});
  if(!cards.some(card=>card.id===selected&&!disabledReason(card,sector,r.player,r.config,gap)))selected='balanced';
  $('#cards').innerHTML=cards.filter(card=>filter==='Все'||filter===card.category).map(card=>{
    const reason=disabledReason(card,sector,r.player,r.config,gap);
    return `<button class="card ${selected===card.id?'selected':''}" data-card="${card.id}" ${reason||busy?'disabled':''} aria-pressed="${selected===card.id}">
      <div class="card-top"><span class="card-icon">${card.icon}</span><span class="card-type">${card.category}</span></div><strong>${card.name}</strong><span class="en">${card.en}</span><p>${card.desc}</p>
      <div class="card-cost"><span>${card.focus>0?'−'+card.focus:'+'+Math.abs(card.focus)} ФОКУС</span><span>${card.heat>0?'+':''}${card.heat}°C</span></div>${reason?`<span class="reason">${reason}</span>`:''}</button>`;
  }).join('');
  $('#cards').querySelectorAll('button').forEach(button=>button.onclick=()=>{if(busy)return;selected=button.dataset.card;renderCards();});
  const card=cards.find(card=>card.id===selected),prediction=simulate(r.config,r.player,sector,card);
  $('#forecast').innerHTML=`<div class="forecast"><div class="forecast-main"><strong>${card.name} <span class="subtle">/ ${sector.label}</span></strong><p>${prediction.reasons.join(' · ')}</p></div>
    <div class="forecast-values">${prediction.time.toFixed(2)} С <span class="${prediction.gain>=0?'positive':'negative'}">${prediction.gain>=0?'−':'+'}${Math.abs(prediction.gain).toFixed(2)} С К БАЗЕ</span><br>
    <span class="micro">НАГРУЗКА ${Math.round(prediction.risk*100)}% · ШИНЫ −${(r.player.tires-prediction.next.tires).toFixed(1)}%</span></div>
    <button id="execute" class="primary" ${!race||busy?'disabled':''}>Исполнить сектор ↗</button></div><p class="forecast-note">Прогноз твоего манёвра. В дуэли защита соперника может добавить 0.35 с. Нагрузка — индекс предела, а не вероятность ошибки.</p>
    ${r.history.length?`<div class="last-sector">${r.history.at(-1).card} · ${r.history.at(-1).playerTime.toFixed(2)} с${r.mode==='duel'?' / соперник: '+r.history.at(-1).aiCard+' · '+r.history.at(-1).aiTime.toFixed(2)+' с':''}. ${r.history.at(-1).reasons.join('. ')}</div>`:''}`;
  $('#execute').onclick=execute;
}
function setBusy(value) {
  busy=value;
  document.querySelectorAll('[data-view]').forEach(button=>button.disabled=value);
  if(value)document.querySelectorAll('.card,.filter,#execute,#abandon').forEach(button=>button.disabled=true);
}
function startRace() {
  if(!unlocked(getEvent(career.eventId),career))return;
  race=createRace(config(),career.weather,career.eventId);
  race.ghost=bestFor(career,race.config,race.eventId,race.weather);
  selected='balanced';filter='Все';render();toast('Старт! Все действия доступны с первого сектора.');
}
function execute() {
  if(!race||busy||race.finished)return;
  try {
    const next=resolveSector(race,selected);
    setBusy(true);paused=false;$('#pause').disabled=false;
    scene.animateSector(next,race.ghost,fast?900:1800);
    race=next;$('#execute').textContent='Исполнение…';
    $('#scene-status').textContent='ИСПОЛНЕНИЕ · '+String(race.index).padStart(2,'0');
  }catch(error){toast(error.message);}
}
function finishAnimation() {
  if(!busy)return;
  setBusy(false);paused=false;
  if(race.finished){
    const before=EVENTS.filter(event=>unlocked(event,career)).map(event=>event.id);
    const award=awardRace(career,race);career=award.career;race=award.race;save();
    const opened=EVENTS.filter(event=>unlocked(event,career)&&!before.includes(event.id));
    if(opened.length)toast('Открыто: '+opened.map(event=>event.title).join(', '));
  }
  render();
}
function confirmAbandon() {
  openModal('<h2>Покинуть заезд?</h2><p>Незавершённый заезд не принесёт наград. Текущий прогресс по секторам будет потерян.</p><div class="inline-actions"><button class="primary" id="confirm-abandon">Покинуть</button><button class="secondary" data-close>Продолжить гонку</button></div>',()=>{
    $('#confirm-abandon').onclick=()=>{$('#modal').close();race=null;render();};
  });
}
function playReplay(record) {
  if(busy||race&&!race.finished)return;
  replayRecord=record;view='race';paused=false;setBusy(true);render();
}
function stopReplay() { replayRecord=null;paused=false;setBusy(false);render(); }
function renderReport() {
  const event=getEvent(race.eventId),outcome=race.outcome||raceOutcome(race),ghost=race.ghost;
  const previous=ghost?cumulativeTimes(ghost.sectorTimes):null;
  let elapsed=0;
  $('#report').innerHTML=`<section class="report"><div class="report-hero"><div><div class="eyebrow">${event.name.toUpperCase()} / ${race.isBest?'НОВЫЙ ЛИЧНЫЙ РЕКОРД':'РЕЗУЛЬТАТ'}</div>
    <h2>${outcome.label} · ${time(race.player.time)}</h2><span class="micro">${weatherName(race.weather)} · ${race.config.car.name} · ${race.config.pilot.name}</span>
    <p>+${money(outcome.reward)} · ${outcome.street?'Street Cred +'+outcome.street:'Official Rep +'+outcome.official} · Состояние машины ${Math.round(career.condition[race.config.car.id])}%
    ${ghost?'<br>К предыдущему рекорду: '+signed(race.player.time-ghost.time)+' с · состояние на старте '+race.config.condition.toFixed(0)+'% / в рекорде '+ghost.condition.toFixed(0)+'%':''}</p></div>
    <div class="report-actions"><button id="retry" class="primary">Ещё один заезд ↗</button><button id="report-garage" class="secondary">В гараж</button><button id="replay-run" class="secondary">▶ Повтор заезда</button><button id="export" class="secondary">Отчёт JSON ↓</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>Сектор / причина</th><th>Твоё решение</th><th>${race.mode==='duel'?'Решение AI / план':'Медаль'}</th><th>Ты</th><th>Разрыв</th><th>К призраку</th><th>Ресурсы</th></tr></thead><tbody>
    ${race.history.map(row=>{elapsed+=row.playerTime;return `<tr><td>${row.index+1}. ${row.sector}<small>${row.reasons.join('. ')}</small></td><td>${row.card}</td>
      <td>${row.aiTime!==null?row.aiCard:outcome.label}${row.aiPlan.length?'<small>План: '+row.aiPlan.join(' → ')+'<br>Фактический следующий ход зависит от ситуации.</small>':''}</td>
      <td>${row.playerTime.toFixed(2)} с</td><td class="${row.gap<=0?'positive':'negative'}">${row.gap===null?'—':signed(row.gap)+' с'}</td>
      <td class="${previous&&elapsed<=previous[row.index]?'positive':'negative'}">${previous?signed(elapsed-previous[row.index])+' с':'—'}</td>
      <td class="micro">${Math.round(row.tires)}% Ш<br>${Math.round(row.heat)}°C<br>${Math.round(row.focus)} Ф</td></tr>`;}).join('')}
    </tbody></table></div></section>`;
  $('#retry').onclick=()=>{race=null;render();};
  $('#report-garage').onclick=()=>{race=null;view='garage';render();};
  $('#replay-run').onclick=()=>playReplay(raceRecord(race));
  $('#export').onclick=downloadReport;
}
function downloadReport() {
  const report={version:2,eventId:race.eventId,route:getEvent(race.eventId).title,mode:race.mode,weather:race.weather,
    car:race.config.car.name,pilot:race.config.pilot.name,parts:race.config.parts,condition:race.config.condition,
    outcome:race.outcome,player:race.player,opponent:race.mode==='duel'?race.opponent:null,sectors:race.history};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`tokyo-streets-${race.eventId}-report.json`;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderGarage(){
 const locked=!!race&&!race.finished;
 app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">THE GARAGE / 自分の車</div><h1>Сначала пойми машину.</h1></div><span class="micro">ДЕТАЛИ И СБОРКИ СОХРАНЯЮТСЯ ОТДЕЛЬНО ДЛЯ КАЖДОЙ МАШИНЫ</span></div>${locked?'<div class="notice">Идёт заезд. Сменить машину, пилота и детали можно после финиша или выхода из гонки.</div>':''}<div class="section-grid">${CARS.map(c=>`<article class="choice ${career.car===c.id?'selected':''}"><div class="eyebrow">${c.brand} / ${c.year}</div><div class="vehicle-art">${vehicleSVG(c)}</div><h2>${c.name}</h2><span class="badge">${c.tag}</span><div class="specs"><div>${c.power}<small>Л.С.</small></div><div>${c.mass}<small>КГ</small></div><div>${c.drive}<small>ПРИВОД</small></div></div><span class="micro">${c.engine}</span><p>${c.description}</p><button class="${career.car===c.id?'secondary':'primary'} wide" data-car="${c.id}" ${locked||career.car===c.id||(!career.ownedCars.includes(c.id)&&career.money<c.price)?'disabled':''}>${career.car===c.id?'Твоя машина':career.ownedCars.includes(c.id)?'Выбрать машину':'Купить · '+money(c.price)}</button></article>`).join('')}</div>
 <div class="section-title"><div><div class="eyebrow">НАСТРОЙКА / ${car().name}</div><h2>Не больше цифр. Больше возможностей.</h2></div><div><span class="micro">СОСТОЯНИЕ ${Math.round(career.condition[career.car])}%</span> <button id="repair" class="secondary" ${locked||career.condition[career.car]>=100||career.money<repairCost()?'disabled':''}>Сервис · ${money(repairCost())}</button></div></div><div class="parts-grid">${PARTS.map(p=>{const owned=career.purchased[career.car].includes(p.id),equipped=career.builds[career.car].includes(p.id);return `<article class="panel part"><div class="eyebrow">${p.type}</div><h3 style="margin-top:12px">${p.name}</h3><p>${p.desc}</p><span class="micro">${owned?'ДЕТАЛЬ В ГАРАЖЕ':money(p.price)}</span><button class="${equipped?'secondary':'primary'}" data-part="${p.id}" ${locked||!owned&&career.money<p.price?'disabled':''}>${equipped?'✓ Установлено · снять':owned?'Установить':'Купить и установить'}</button></article>`;}).join('')}</div>
 <div class="section-title"><div><div class="eyebrow">THE DRIVER</div><h2>За рулём всегда человек.</h2></div></div><div class="pilot-row">${PILOTS.map((p,i)=>`<button class="pilot ${career.pilot===p.id?'selected':''}" data-pilot="${p.id}" ${locked?'disabled':''}><div class="pilot-symbol" style="color:${p.color}">0${i+1} / ${p.trait}</div><h3>${p.name}</h3><span class="micro">${p.title.toUpperCase()} · ФОКУС ${p.focus}</span><p>${p.description}</p></button>`).join('')}</div>`;
 document.querySelectorAll('[data-car]').forEach(b=>b.onclick=()=>{const c=CARS.find(c=>c.id===b.dataset.car);if(!career.ownedCars.includes(c.id)){if(career.money<c.price)return;career.money-=c.price;career.ownedCars.push(c.id);}career.car=c.id;race=null;selected='balanced';save();render();});
 document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{const p=PARTS.find(p=>p.id===b.dataset.part),id=career.car;if(!career.purchased[id].includes(p.id)){if(career.money<p.price)return;career.money-=p.price;career.purchased[id].push(p.id);}career.builds[id]=career.builds[id].includes(p.id)?career.builds[id].filter(x=>x!==p.id):[...career.builds[id],p.id];race=null;save();render();});
 document.querySelectorAll('[data-pilot]').forEach(b=>b.onclick=()=>{career.pilot=b.dataset.pilot;race=null;selected='balanced';save();render();});
 $('#repair').onclick=()=>{const cost=repairCost();if(career.money<cost)return;career.money-=cost;career.condition[career.car]=100;race=null;save();render();toast('Машина обслужена. Состояние 100%.');};
}
function repairCost(){return Math.ceil((100-career.condition[career.car])*150);}
function routeMap(event) {
  const xs=event.anchors.map(p=>p[0]),ys=event.anchors.map(p=>p[1]);
  const minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX,height=Math.max(...ys)-minY;
  const points=event.anchors.map(([x,y])=>[35+(x-minX)/width*200,20+(y-minY)/height*110].join(',')).join(' ');
  return `<svg viewBox="0 0 270 150" aria-hidden="true"><polyline points="${points}" stroke="#657a6a" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points}" stroke="#ffab78" stroke-width="2" fill="none" stroke-dasharray="3 5"/></svg>`;
}
function renderWorld() {
  const currentBest=bestFor(career,config(),career.eventId,career.weather);
  app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">CLUB SEASON / 次の一歩</div><h1>Две сцены. Одно имя.</h1></div><span class="badge">${career.official?'КЛУБНЫЙ ПИЛОТ':'НЕЗАВИСИМЫЙ ПИЛОТ'}</span></div>
    <div class="career-stats"><div class="panel"><div class="eyebrow">Street Credibility</div><div class="big-number">${career.street}</div><span class="micro">НОЧНЫЕ ДУЭЛИ / ДОСТУП К АКАГИ</span></div>
    <div class="panel"><div class="eyebrow">Official Reputation</div><div class="big-number">${career.official}</div><span class="micro">КЛУБНАЯ СЕССИЯ В ЦУКУБЕ</span></div>
    <div class="panel"><div class="eyebrow">Победы в дуэлях / Заезды</div><div class="big-number">${career.wins}<span style="font-size:20px;color:var(--muted)"> / ${career.races}</span></div><span class="micro">ВСЕ ЗАВЕРШЁННЫЕ СЕССИИ</span></div>
    <div class="panel"><div class="eyebrow">Рекорд выбранной сборки</div><div class="big-number">${currentBest?time(currentBest.time):'—'}</div><span class="micro">${getEvent(career.eventId).title} / ${weatherName(career.weather)}</span></div></div>
    <div class="event-grid">${EVENTS.map((event,index)=>{
      const open=unlocked(event,career);
      return `<article class="event-card ${open?'':'locked'}"><div class="event-card-head"><span class="eyebrow">${event.region} / ${event.mode==='duel'?'TOUGE DUEL':'OFFICIAL TIME ATTACK'}</span><span class="event-num">0${index+1}</span></div>
        <div class="route-art">${routeMap(event)}</div><h2>${event.title}</h2><p>${event.description}</p><div class="micro">${event.sectors.length} СЕКТОРОВ · ${(eventLength(event)/1000).toFixed(2)} КМ · БЕЗ ВЗНОСА<br>ДО ${money(event.prize)} / УЧАСТИЕ ${money(event.participation)}</div>
        ${event.mode==='duel'?'<div class="event-rival">Соперник: '+CARS.find(car=>car.id===event.rivalCar).name+'</div>':'<div class="event-rival">Медали: золото / серебро / бронза</div>'}
        <button class="${open?'primary':'secondary'} wide" data-event="${event.id}" ${!open||race&&!race.finished?'disabled':''}>${open?'Выбрать маршрут ↗':'Откроется: '+unlockText(event)}</button></article>`;
    }).join('')}</div>
    ${race&&!race.finished?'<div class="notice" style="margin-top:15px">Сначала заверши текущую сессию или выйди из неё на экране заезда.</div>':''}
    <div class="section-title"><div><div class="eyebrow">ТВОИ ОРИЕНТИРЫ</div><h2>Рекорды и сохранённые повторы</h2></div></div>
    <div class="notice">Рекорды разделены по трассе, погоде, машине, пилоту и деталям. Состояние машины указано отдельно: износ может изменить результат той же сборки. Старые заезды v0.1 остаются в истории, но без выдуманного повтора.</div>
    ${career.bests.length?`<div class="table-wrap"><table><thead><tr><th>Событие</th><th>Погода</th><th>Машина / пилот / детали</th><th>Стартовое состояние</th><th>Время</th><th>Повтор</th></tr></thead><tbody>${career.bests.map((best,index)=>`<tr><td>${getEvent(best.eventId).title}</td><td>${weatherName(best.weather)}</td><td>${CARS.find(car=>car.id===best.carId).name}<small>${PILOTS.find(pilot=>pilot.id===best.pilotId).name} · ${best.parts.map(id=>PARTS.find(part=>part.id===id).name).join(', ')||'Сток'}</small></td><td>${Math.round(best.condition)}%</td><td class="positive">${time(best.time)}</td><td><button class="secondary" data-replay="${index}" ${race&&!race.finished?'disabled':''}>▶ Смотреть</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Первый финиш сохранит твой ориентир и повтор.</div>'}
    <h2 style="margin-top:30px">История заездов</h2>${career.records.length?`<div class="table-wrap"><table><thead><tr><th>Событие / условия</th><th>Машина</th><th>Время</th><th>Результат</th></tr></thead><tbody>${career.records.map(record=>`<tr><td>${getEvent(record.eventId).title}<small>${weatherName(record.weather)}</small></td><td>${record.car}</td><td>${time(record.time)}</td><td>${record.medal?{gold:'Золото',silver:'Серебро',bronze:'Бронза'}[record.medal]:getEvent(record.eventId).mode==='timeattack'?'Сессия завершена':record.won?'Победа':'Без победы'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Ночь ещё только начинается.</div>'}
    <div class="section-title"><span class="micro">АВТОСОХРАНЕНИЕ · V2 / ПРОГРЕСС V1 СОХРАНЁН</span><button id="reset" class="secondary">Новая карьера</button></div>`;
  document.querySelectorAll('[data-event]').forEach(button=>button.onclick=()=>{
    const event=getEvent(button.dataset.event);if(!unlocked(event,career)||race&&!race.finished)return;
    career.eventId=event.id;race=null;view='race';save();render();
  });
  document.querySelectorAll('[data-replay]').forEach(button=>button.onclick=()=>playReplay(career.bests[Number(button.dataset.replay)]));
  $('#reset').onclick=()=>openModal('<h2>Начать с чистого листа?</h2><p>Деньги, машины, детали, история и повторы будут удалены в этом браузере.</p><div class="inline-actions"><button id="confirm-reset" class="primary">Сбросить прогресс</button><button class="secondary" data-close>Отмена</button></div>',()=>{
    $('#confirm-reset').onclick=()=>{career=newCareer();career.helpSeen=true;race=null;view='race';save();$('#modal').close();render();};
  });
}
function openModal(html,setup) {
  $('#modal-content').innerHTML=html;
  $('#modal-content').querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$('#modal').close());
  setup?.();$('#modal').showModal();
}
function help() {
  openModal(`<div class="eyebrow">TOKYO STREETS / CLUB SEASON 0.2</div><h2>Найди свою линию.</h2><ol>
    <li><strong>Гараж.</strong> Выбери машину и пилота. Купи детали, которые подходят к маршруту; сборки у каждой машины свои.</li>
    <li><strong>Событие.</strong> Харуна доступна сразу. Для Акаги нужно 12 Street Cred. После двух завершённых сессий открывается клубный Time Attack в Цукубе.</li>
    <li><strong>Тактика.</strong> Все карты открыты. Серые объясняют ограничения. Читай разведку маршрута, прогноз, шины, тормоза и концентрацию.</li>
    <li><strong>Дуэль.</strong> Соперник планирует на три сектора по тем же правилам. Защита и слипстрим требуют реального окна.</li>
    <li><strong>Time Attack.</strong> Соперника нет; карты дуэли недоступны. Пороги медалей видны до старта. Завершённая сессия приносит Official Reputation.</li>
    <li><strong>Повтор.</strong> Лучший заезд сохраняет решения и время секторов. В следующем заезде с той же сборкой можно включить призрак или посмотреть полный повтор.</li>
    </ol><p class="micro">НАГРУЗКА — ИНДЕКС ПРЕДЕЛА, НЕ ВЕРОЯТНОСТЬ. КАРЬЕРА СОХРАНЯЕТСЯ В БРАУЗЕРЕ. НЕЗАВЕРШЁННЫЙ ЗАЕЗД ПРИ ПЕРЕЗАГРУЗКЕ СБРАСЫВАЕТСЯ. ПОВТОРЫ НЕ ПРИНОСЯТ НАГРАД.</p><button class="primary" data-close>На дорогу ↗</button>`);
  career.helpSeen=true;save();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
  if(busy)return;view=button.dataset.view;render();
});
$('#help').onclick=help;
$('.logo').onclick=event=>{event.preventDefault();if(!busy){view='race';render();}};
window.addEventListener('beforeunload',event=>{if(race&&!race.finished){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{
  if(event.code==='Space'&&busy&&!$('#modal').open&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){
    event.preventDefault();$('#pause')?.click();
  }
});
render();if(!career.helpSeen)help();
