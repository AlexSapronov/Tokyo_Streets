import {dashboardHTML,bindDashboard} from './dashboard.js';
import {readTelemetry,interpolateTelemetry,sampleTelemetry} from './telemetry.js';
import {TEAM_PRICE,CREW,ORDERS,PLAN_RULES,orderName,canFoundTeam,foundTeam,hirePilot,assignPilot,renameTeam,setTeamPlan,contractFor} from './team.js';
import {beginManagedRace,setManagerOrder,interpretOrder,resolveManagedSector} from './manager.js';
import {DRIFT_CARDS} from './drift-data.js';
import {replayIndex,driftFrame} from './replay.js';
import {qualitativeForecast,focusCost} from './tactics.js';
import {ALL_DRAG_CARDS as DRAG_CARDS} from './drag-data.js';
import {selectCar,togglePart,selectPilot,serviceCar,serviceCost} from './garage.js';
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
let dashboardUpdate=null,autoRun=false,autoTimer;
let busy = false, scene = null, fast = false, paused = false, replayRecord = null;
let toastTimer;
const money = value => '¥ ' + Math.round(value).toLocaleString('ru-RU');
const time = value => `${Math.floor(value/60)}:${(value%60).toFixed(2).padStart(5,'0')}`;
const score=value=>(value||0).toFixed(1);
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
function render() {
  scene?.destroy();scene=null;dashboardUpdate=null;
  if(view!=='race'){autoRun=false;clearTimeout(autoTimer);}
  document.querySelectorAll('[data-view]').forEach(button=>{
    button.classList.toggle('active',button.dataset.view===view);button.disabled=busy;
  });
  if(view==='garage')renderGarage();else if(view==='world')renderWorld();else if(view==='team')renderTeam();else renderRace();
  updateWallet();
}
function sectorDescription(s) {
  return `${s.label}${s.mode==='drift'?' · '+s.clip+' · угол '+s.targetAngle+'° · '+s.targetSpeed+' км/ч':''} · ${s.length} м${s.radius?' · радиус '+s.radius+' м':''} · уклон ${Math.round(s.slope*100)}% · влажность ${Math.round(s.wet*100)}%`;
}
function medalHTML(eventId,weather) {
  const targets=medalTargets(eventId,weather);
  return `<div class="medal-targets"><span>● Золото <strong>${time(targets.gold)}</strong></span>
    <span>● Серебро <strong>${time(targets.silver)}</strong></span><span>● Бронза <strong>${time(targets.bronze)}</strong></span></div>`;
}
function renderRace() {
  const r=previewRace(),event=getEvent(r.eventId),count=event.sectors.length;
  const s=sectorAt(Math.min(r.index,count-1),r.weather,event.id),duel=['duel','drag'].includes(r.mode),isDrag=r.mode==='drag',isDrift=r.mode==='drift';
  const gap=r.opponent.dnf?Infinity:r.player.time-r.opponent.time,ghost=ghostFor(r),isReplay=!!replayRecord;
  app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">JAPAN / ${event.region}</div>
      <h1>${isReplay?'Твоя лучшая линия.':event.title}</h1></div><div class="event-controls">
      <label><span class="micro">УПРАВЛЕНИЕ</span><select id="control" ${race||isReplay?'disabled':''}><option value="personal">Лично · карты</option><option value="manager" ${!career.team.founded||!contractFor(career)?'disabled':''}>Менеджер · приказы</option></select></label><label><span class="micro">СОБЫТИЕ</span><select id="event-select" ${race||isReplay?'disabled':''}>
      ${EVENTS.map(item=>`<option value="${item.id}" ${!unlocked(item,career)?'disabled':''}>${item.title}${!unlocked(item,career)?' · '+unlockText(item):''}</option>`).join('')}</select></label>
      <label><span class="micro">ПОКРЫТИЕ</span><select id="weather" ${race||isReplay?'disabled':''}><option value="mixed">☂ Переменная влажность</option><option value="dry">☾ Сухой асфальт</option><option value="rain">☂ Дождь</option></select></label></div></div>
    <div class="race-layout"><section><div class="scene-wrap"><canvas id="scene" aria-label="Изометрическая трасса ${event.title}"></canvas>
      <div class="scene-top"><div><div class="eyebrow">${event.japanese} · ${event.name.toUpperCase()}</div><h2>${event.title}</h2><span class="badge">${isDrift?'DRIFT / JUDGED RUN':isDrag?'DRAG / QUARTER MILE':duel?'TOUGE / DUEL':'OFFICIAL / TIME ATTACK'}</span></div>
      <div class="route-stats">${(eventLength(event)/1000).toFixed(2)} KM<br>${count} ${isDrift?'КЛИПОВ':isDrag?(count===4?'ФАЗЫ':'ФАЗ'):'СЕКТОРОВ'}<br>${event.theme==='circuit'?'18:20':'23:48'} / 12°C<br>ЗАКРЫТЫЙ МАРШРУТ</div></div>
      <div class="scene-caption"><div class="stamp" id="scene-status">${isReplay?'ПОВТОР РЕКОРДА':isDrag&&!race?count+(count===4?' ФАЗЫ':' ФАЗ')+' / ET + РЕАКЦИЯ':r.finished?(r.player.dnf?'СХОД / DNF':'ФИНИШ'):race?'СЕКТОР '+String(r.index+1).padStart(2,'0'):'ПЕРЕД СТАРТОМ'}</div>
      <h3 id="scene-sector">${r.finished?'До следующей встречи.':s.name}</h3>
      <p id="scene-description">${isReplay?'Сохранённые решения и время. Повтор не приносит наград.':race?sectorDescription(s):event.description}</p></div>
      <div class="scene-tools"><button id="pause" ${!isReplay?'disabled':''}>Ⅱ Пауза</button><button id="speed">${fast?'2×':'1×'} Скорость</button></div></div>
      <div class="sector-strip">${event.sectors.map((sector,i)=>`<div class="sector-node ${i<r.index?'done':i===r.index?'current':''}" title="${sector.name} · ${sector.length} м">${String(i+1).padStart(2,'0')} ${sector.type==='corner'?'⌁':'—'}</div>`).join('')}</div>
      <details class="route-brief"><summary>${isDrift?'Судейские клипы':isDrag?'Фазы дрэга':'Разведка маршрута'} · ${count}</summary><div class="route-list">${event.sectors.map((_,i)=>{const sector=sectorAt(i,r.weather,event.id);return `<div class="${i===r.index?'current':''}"><span class="micro">${String(i+1).padStart(2,'0')}</span><strong>${sector.name}</strong><span>${sectorDescription(sector)}</span></div>`;}).join('')}</div></details></section>
      <aside class="sidebar">${dashboardHTML(r.config)}
      <div class="panel"><div class="eyebrow">${isReplay?'ХРОНОМЕТР':duel?'СОПЕРНИК / AI · ПЛАН НА 3 СЕКТОРА':'ОДИНОЧНАЯ СЕССИЯ'}</div>
      ${duel&&!isReplay?`<div class="entry"><div class="car-swatch" style="--car:${r.rival.car.color}"></div><div><strong>${r.rival.car.name}</strong><span>${r.rival.pilot.name} / ${r.rival.pilot.trait}</span></div></div>`:''}
      <div class="gap ${isDrag&&r.player.drag.falseStart?'negative':duel&&gap<=0?'positive':duel?'negative':''}" id="live-clock">${isReplay?time(r.player.time):isDrift?score(r.player.drift.score):!duel?time(r.player.time):isDrag&&r.player.drag.falseStart?'RED LIGHT':signed(gap)}
      <small>${isReplay?'ПОВТОР БЕЗ НАГРАД':isDrift?'БАЛЛЫ ЗА СЕССИЮ / МАКС. 800':!duel?'ТВОЁ ВРЕМЯ':gap===0?'НА ОДНОЙ ЛИНИИ':gap<0?'ТЫ ВПЕРЕДИ / СЕК':'ТЫ ПОЗАДИ / СЕК'}</small></div>
      ${isDrift?driftMedals(event)+(isReplay?'<p class="micro">ИТОГ ЗАПИСАННОГО ЗАЕЗДА</p>':'')+driftMetrics(isReplay&&replayRecord.drift?replayRecord.drift:r.player.drift):!duel?medalHTML(event.id,r.weather):isDrag?dragMetrics(isReplay&&replayRecord.drag?replayRecord.drag:r.player.drag):''}
      ${isReplay?'<button id="stop-replay" class="secondary wide">Завершить просмотр</button>':!race?'<button id="start" class="primary wide">На старт ↗</button>':r.finished?'<button id="show-report" class="primary wide">Посмотреть результат ↓</button>':'<button id="abandon" class="secondary wide">Покинуть заезд</button>'}</div>
      ${!isReplay?`<div class="panel ghost-panel"><div class="eyebrow">ЛИЧНЫЙ РЕКОРД / ЭТА СБОРКА</div><div class="record-time">${ghost?ghost.drift?score(ghost.drift.score)+' Б':time(ghost.time):'Первый ориентир — ты.'}</div>
      <p>${ghost?'Та же трасса, погода, машина, пилот и детали. Состояние в рекорде: '+ghost.condition.toFixed(0)+'%.':'Заверши заезд — появятся рекорд, призрак и повтор.'}</p>
      ${ghost?`<label class="ghost-toggle"><input id="ghost-toggle" type="checkbox" ${career.ghostEnabled?'checked':''}> Показывать призрак</label>${!race||race.finished?'<button id="replay-best" class="secondary wide">▶ Повтор рекорда</button>':''}`:''}</div>`:''}
      </aside></div>
    ${isReplay||r.finished?'':`<section class="cards-area"><div class="cards-header"><h2>Твои решения <span>ПОЛНЫЙ НАБОР · ${availableCards(r.config,r.mode,r.eventId).length} КАРТ</span></h2><span class="micro">${race?'ВЫБЕРИ КАРТУ → ИСПОЛНИ СЕКТОР':'ПРОСМОТР ПЕРЕД СТАРТОМ'} · БЕЗ СЛУЧАЙНОЙ РАЗДАЧИ</span></div><div id="filters" class="filters"></div><div id="cards" class="cards-grid"></div><div id="forecast"></div></section>`}
    <div id="report"></div><div class="footer-line"><span>TOKYO STREETS / FOCUS & EXECUTION 0.7</span><span>КАРТЫ — НАМЕРЕНИЯ. РЕЗУЛЬТАТ — ФИЗИКА.</span></div>`;
  $('#control').value=r.manager?'manager':career.control;
  $('#control').onchange=event=>{career.control=event.target.value;save();render();};
  $('#weather').value=r.weather;$('#event-select').value=event.id;
  $('#weather').onchange=e=>{career.weather=e.target.value;save();render();};
  $('#event-select').onchange=e=>{if(!unlocked(getEvent(e.target.value),career))return;career.eventId=e.target.value;save();render();};
  scene=new Scene($('#scene'),r,ghost,career.ghostEnabled);scene.speed=fast?2:1;
  dashboardUpdate=bindDashboard($('.dashboard'),r.config);
  const initial=readTelemetry(r.config,!race&&!isReplay?{...r.player,velocity:0}:r.player,r.mode);dashboardUpdate(initial);
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
      const live=sampleTelemetry(r.config,r.mode,replayRecord,elapsed);if(live)dashboardUpdate(live);
      const index=replayIndex(replayRecord.sectorTimes,elapsed);
      if(isDrift){const pose=driftFrame(replayRecord,elapsed);$('#live-clock').innerHTML=score(pose.score)+'<small>ПОВТОР · БАЛЛЫ ЗА ЗАВЕРШЁННЫЕ КЛИПЫ</small>';}
      $('#scene-sector').textContent=event.sectors[index].name;
      const action=[...CARDS,...DRAG_CARDS,...DRIFT_CARDS].find(card=>card.id===replayRecord.actions[index]);
      $('#scene-description').textContent=action.name+' · '+sectorDescription(sectorAt(index,r.weather,event.id))+(replayRecord.manager?' · '+orderName(replayRecord.manager.log[index].effective):'')+(!replayRecord.telemetry?' · телеметрия старого повтора недоступна':'');
      document.querySelectorAll('.sector-node').forEach((node,i)=>{node.classList.toggle('current',i===index);node.classList.toggle('done',i<index);});
    };
    scene.onComplete=()=>{stopReplay();toast('Повтор завершён. Время и награды карьеры не изменились.');};
    scene.replay(replayRecord,fast?6000:12000);
  }else{
    scene.onComplete=finishAnimation;
    scene.onTick=(elapsed,frame)=>{if(frame.from)dashboardUpdate(interpolateTelemetry(r.config,r.mode,readTelemetry(r.config,frame.from,r.mode),readTelemetry(r.config,frame.to,r.mode),frame.fraction,frame.to.drag));};
    if(r.finished){renderReport();$('#show-report').onclick=()=>$('#report').scrollIntoView({behavior:'smooth'});}
    else if(r.manager||!race&&career.control==='manager')renderCommandPanel(r);else renderCards();
  }
}
function renderCards() {
  const r=previewRace(),sector=sectorAt(r.index,r.weather,r.eventId),gap=r.player.time-r.opponent.time;
  const cards=availableCards(r.config,r.mode,r.eventId),categories=['Все',...new Set(cards.map(card=>card.category))];
  if(!categories.includes(filter))filter='Все';
  $('#filters').innerHTML=categories.map(category=>`<button class="filter ${filter===category?'active':''}" data-filter="${category}">${category}</button>`).join('');
  $('#filters').querySelectorAll('button').forEach(button=>button.onclick=()=>{if(busy)return;filter=button.dataset.filter;renderCards();});
  if(!cards.some(card=>card.id===selected&&!disabledReason(card,sector,r.player,r.config,gap)))selected=cards.find(card=>!disabledReason(card,sector,r.player,r.config,gap))?.id;
  $('#cards').innerHTML=cards.filter(card=>filter==='Все'||filter===card.category).map(card=>{
    const reason=disabledReason(card,sector,r.player,r.config,gap);
    const cost=r.mode==='drag'&&!getEvent(r.eventId).longDrag?card.focus*(r.config.pilot.id==='ren'?.88:1):focusCost(r.config,r.player,card);
    return `<button class="card ${selected===card.id?'selected':''}" data-card="${card.id}" ${reason||busy?'disabled':''} aria-pressed="${selected===card.id}">
      <div class="card-top"><span class="card-icon">${card.icon}</span><span class="card-type">${card.category}</span></div><strong>${card.name}</strong><span class="en">${card.en}</span><p>${card.desc}</p>
      <div class="card-cost"><span>${cost>0?'−'+Math.ceil(cost):'+'+Math.floor(Math.abs(cost))} ФОКУС</span><span>${card.heat>0?'+':''}${card.heat}°C</span></div>${reason?`<span class="reason">${reason}</span>`:''}</button>`;
  }).join('');
  $('#cards').querySelectorAll('button').forEach(button=>button.onclick=()=>{if(busy)return;selected=button.dataset.card;renderCards();});
  const card=cards.find(card=>card.id===selected),prediction=simulate(r.config,r.player,sector,card);
  const forecast=qualitativeForecast(r.config,r.player,sector,card,prediction);
  $('#forecast').innerHTML=`<div class="forecast"><div class="forecast-main"><strong>${card.name} <span class="subtle">/ ${sector.label}</span></strong>
    <p>${forecast.habit}</p><p>${forecast.execution}</p>${forecast.warning?`<p class="negative">${forecast.warning}</p>`:''}</div>
    <div class="forecast-values"><strong>${forecast.pace}</strong><br><span class="micro">НАГРУЗКА: ${forecast.load} · ИЗНОС: ${forecast.wear}<br>ФОКУС: ${forecast.focus}</span></div>
    <button id="execute" class="primary" ${!race||busy?'disabled':''}>Исполнить ${r.mode==='drift'?'клип':r.mode==='drag'?'фазу':'сектор'} ↗</button></div>
    <p class="forecast-note">До решения доступна качественная оценка. Оценка, фактическое время и причины станут известны после исполнения.</p>
    ${r.history.length?`<div class="last-sector">${r.history.at(-1).card}${r.mode==='drift'?' · '+score(r.history.at(-1).drift.points)+' баллов':''} · ${r.history.at(-1).playerTime.toFixed(2)} с${['duel','drag'].includes(r.mode)?' / соперник: '+r.history.at(-1).aiCard+' · '+r.history.at(-1).aiTime.toFixed(2)+' с':''}. ${r.history.at(-1).reasons.join('. ')}</div>`:''}`;
  $('#execute').onclick=execute;
}
function setBusy(value) {
  busy=value;
  document.querySelectorAll('[data-view]').forEach(button=>button.disabled=value);
  if(value)document.querySelectorAll('.card,.filter,.command-button,#execute,#abandon').forEach(button=>button.disabled=true);
}
function startRace() {
  if(!unlocked(getEvent(career.eventId),career))return;
  const runId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  try{
    if(career.control==='manager'){
      const start=beginManagedRace(career,career.eventId,career.weather,runId);career=start.career;race=start.race;save();
    }else race=createRace(config(),career.weather,career.eventId,runId);
    race.ghost=bestFor(career,race.config,race.eventId,race.weather);
    selected='balanced';filter='Все';render();toast(race.manager?'Пилот на связи. Приказы можно менять между участками.':'Старт! Выбирай карту для каждого участка.');
  }catch(error){toast(error.message);}
}
function execute() {
  if(!race||busy||race.finished)return;
  try {
    const next=race.manager?resolveManagedSector(race):resolveSector(race,selected);
    setBusy(true);paused=false;$('#pause').disabled=false;
    scene.animateSector(next,race.ghost,fast?900:1800);
    race=next;$('#execute').textContent='Исполнение…';
    $('#scene-status').textContent='ИСПОЛНЕНИЕ · '+String(race.index).padStart(2,'0');
  }catch(error){toast(error.message);}
}
function finishAnimation() {
  if(!busy)return;
  setBusy(false);paused=false;
  if(['drag','drift'].includes(race.mode))filter='Все';
  if(race.finished){
    autoRun=false;clearTimeout(autoTimer);
    const before=EVENTS.filter(event=>unlocked(event,career)).map(event=>event.id);
    const award=awardRace(career,race);career=award.career;race=award.race;save();
    const opened=EVENTS.filter(event=>unlocked(event,career)&&!before.includes(event.id));
    if(opened.length)toast('Открыто: '+opened.map(event=>event.title).join(', '));
  }
  render();
  if(autoRun&&race&&!race.finished)autoTimer=setTimeout(()=>{if(autoRun&&view==='race')execute();},400);
}
function confirmAbandon() {
  autoRun=false;clearTimeout(autoTimer);
  openModal('<h2>Покинуть заезд?</h2><p>Незавершённый заезд не принесёт наград. Текущий прогресс по секторам будет потерян.</p><div class="inline-actions"><button class="primary" id="confirm-abandon">Покинуть</button><button class="secondary" data-close>Продолжить гонку</button></div>',()=>{
    $('#confirm-abandon').onclick=()=>{$('#modal').close();race=null;render();};
  });
}
function playReplay(record) {
  if(busy||race&&!race.finished)return;
  replayRecord=record;view='race';paused=false;setBusy(true);render();
}
function stopReplay() { replayRecord=null;paused=false;setBusy(false);render(); }
function damageHTML(r){
  return r.player.dnf?`<p class="negative"><strong>ВЫЛЕТ С ТРАССЫ · DNF</strong><br>Заезд остановлен. Повреждения: −${r.player.dnf.damage} п.п. состояния, с нижним пределом 35%. Состояние после заезда: ${Math.round(career.condition[r.config.car.id])}%. Награды и рекорда нет; требуется сервис.</p>`:r.opponent.dnf?'<p class="negative">Соперник сошёл после вылета с трассы.</p>':'';
}
function renderReport() {
  if(race.mode==='drift'){renderDriftReport();return;}
  const event=getEvent(race.eventId),outcome=race.outcome||raceOutcome(race),ghost=race.ghost;
  const previous=ghost?cumulativeTimes(ghost.sectorTimes):null;
  let elapsed=0;
  $('#report').innerHTML=`<section class="report"><div class="report-hero"><div><div class="eyebrow">${event.name.toUpperCase()} / ${race.isBest?'НОВЫЙ ЛИЧНЫЙ РЕКОРД':'РЕЗУЛЬТАТ'}</div>
    <h2>${outcome.label} · ${time(race.player.time)}</h2>${damageHTML(race)}${managerFeedbackHTML(race)}<span class="micro">${weatherName(race.weather)} · ${race.config.car.name} · ${race.config.pilot.name}</span>
    <p>+${money(outcome.reward)} · ${outcome.street?'Street Cred +'+outcome.street:'Official Rep +'+outcome.official} · Состояние машины ${Math.round(career.condition[race.config.car.id])}%
    ${ghost&&!race.player.dnf?'<br>К предыдущему рекорду: '+signed(race.player.time-ghost.time)+' с · состояние на старте '+race.config.condition.toFixed(0)+'% / в рекорде '+ghost.condition.toFixed(0)+'%':''}</p></div>
    ${race.mode==='drag'?'<div class="drag-result"><h3>Твоя дорожка</h3>'+dragMetrics(race.player.drag)+'<h3>Соперник</h3>'+dragMetrics(race.opponent.drag)+'</div>':''}<div class="report-actions"><button id="retry" class="primary">Ещё один заезд ↗</button><button id="report-garage" class="secondary">В гараж</button><button id="replay-run" class="secondary">▶ Повтор заезда</button><button id="export" class="secondary">Отчёт JSON ↓</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>Сектор / причина</th><th>Твоё решение</th><th>${race.mode!=='timeattack'?'Решение AI / план':'Медаль'}</th><th>Ты</th><th>Разрыв</th><th>К призраку</th><th>Ресурсы</th></tr></thead><tbody>
    ${race.history.map(row=>{elapsed+=row.playerTime;return `<tr><td>${row.index+1}. ${row.sector}<small>${row.reasons.join('. ')}</small></td><td>${row.card}${row.command?'<small>'+orderName(row.command.requested)+' → '+orderName(row.command.effective)+'<br>'+row.command.reason+'</small>':''}</td>
      <td>${row.aiTime!==null||race.opponent.dnf?row.aiCard:outcome.label}${row.aiReasons?.some(reason=>reason.includes('ВЫЛЕТ'))?'<small class="negative">Соперник вылетел с трассы и сошёл</small>':''}${row.aiPlan.length?'<small>План: '+row.aiPlan.join(' → ')+'<br>Фактический следующий ход зависит от ситуации.</small>':''}</td>
      <td>${row.playerTime.toFixed(2)} с</td><td class="${row.gap<=0?'positive':'negative'}">${row.gap===null?'—':signed(row.gap)+' с'}</td>
      <td class="${previous&&elapsed<=previous[row.index]?'positive':'negative'}">${previous?signed(elapsed-previous[row.index])+' с':'—'}</td>
      <td class="micro">${Math.round(row.tires)}% Ш<br>${Math.round(row.heat)}°C<br>${Math.round(row.focus)} Ф</td></tr>`;}).join('')}
    </tbody></table></div></section>`;
  bindReportActions();
}
function bindReportActions(){
  $('#retry').onclick=()=>{race=null;render();};
  $('#report-garage').onclick=()=>{race=null;view='garage';render();};
  $('#replay-run').disabled=!!race.player.dnf;
  if(race.player.dnf)$('#replay-run').textContent='Повтор схода недоступен';
  $('#replay-run').onclick=()=>playReplay(raceRecord(race));
  $('#export').onclick=downloadReport;
}
function downloadReport() {
  const report={version:2,eventId:race.eventId,route:getEvent(race.eventId).title,mode:race.mode,weather:race.weather,
    car:race.config.car.name,pilot:race.config.pilot.name,parts:race.config.parts,condition:race.config.condition,
    outcome:race.outcome,player:race.player,opponent:['duel','drag'].includes(race.mode)?race.opponent:null,sectors:race.history};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`tokyo-streets-${race.eventId}-report.json`;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderGarage(){
 const locked=!!race&&!race.finished;
 app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">THE GARAGE / 自分の車</div><h1>Сначала пойми машину.</h1></div><span class="micro">ДЕТАЛИ И СБОРКИ СОХРАНЯЮТСЯ ОТДЕЛЬНО ДЛЯ КАЖДОЙ МАШИНЫ</span></div>${locked?'<div class="notice">Идёт заезд. Сменить машину, пилота и детали можно после финиша или выхода из гонки.</div>':''}<div class="section-grid">${CARS.map(c=>`<article class="choice ${career.car===c.id?'selected':''}"><div class="eyebrow">${c.brand} / ${c.year}</div><div class="vehicle-art">${vehicleSVG(c)}</div><h2>${c.name}</h2><span class="badge">${c.tag}</span><div class="specs"><div>${c.power}<small>Л.С.</small></div><div>${c.mass}<small>КГ</small></div><div>${c.drive}<small>ПРИВОД</small></div></div><span class="micro">${c.engine}</span><p>${c.description}</p><button class="${career.car===c.id?'secondary':'primary'} wide" data-car="${c.id}" ${locked||career.car===c.id||(!career.ownedCars.includes(c.id)&&career.money<c.price)?'disabled':''}>${career.car===c.id?'Твоя машина':career.ownedCars.includes(c.id)?'Выбрать машину':'Купить · '+money(c.price)}</button></article>`).join('')}</div>
 <div class="section-title"><div><div class="eyebrow">НАСТРОЙКА / ${car().name}</div><h2>Не больше цифр. Больше возможностей.</h2></div><div><span class="micro">СОСТОЯНИЕ ${Math.round(career.condition[career.car])}%</span> <button id="repair" class="secondary" ${locked||career.condition[career.car]>=100||career.money<repairCost()?'disabled':''}>Сервис · ${money(repairCost())}</button></div></div><div class="parts-grid">${PARTS.map(p=>{const owned=career.purchased[career.car].includes(p.id),equipped=career.builds[career.car].includes(p.id);return `<article class="panel part"><div class="eyebrow">${p.type}</div><h3 style="margin-top:12px">${p.name}</h3><p>${p.desc}</p><span class="micro">${owned?'ДЕТАЛЬ В ГАРАЖЕ':money(p.price)}</span><button class="${equipped?'secondary':'primary'}" data-part="${p.id}" ${locked||!owned&&career.money<p.price?'disabled':''}>${equipped?'✓ Установлено · снять':owned?'Установить':'Купить и установить'}</button></article>`;}).join('')}</div>
 <div class="section-title"><div><div class="eyebrow">THE DRIVER</div><h2>За рулём всегда человек.</h2></div></div><div class="pilot-row">${PILOTS.map((p,i)=>`<button class="pilot ${career.pilot===p.id?'selected':''}" data-pilot="${p.id}" ${locked?'disabled':''}><div class="pilot-symbol" style="color:${p.color}">0${i+1} / ${p.trait}</div><h3>${p.name}</h3><span class="micro">${p.title.toUpperCase()} · ФОКУС ${p.focus}</span><p>${p.description}</p></button>`).join('')}</div>`;
 document.querySelectorAll('[data-car]').forEach(button=>button.onclick=()=>garageAction(()=>selectCar(career,button.dataset.car,locked)));
 document.querySelectorAll('[data-part]').forEach(button=>button.onclick=()=>garageAction(()=>togglePart(career,button.dataset.part,locked)));
 document.querySelectorAll('[data-pilot]').forEach(button=>button.onclick=()=>garageAction(()=>selectPilot(career,button.dataset.pilot,locked)));
 $('#repair').onclick=()=>garageAction(()=>serviceCar(career,locked));
}
function garageAction(action) {
  try{career=action();race=null;selected='balanced';if(career.control==='manager'&&!contractFor(career))career.control='personal';save();render();}catch(error){toast(error.message);}
}
function repairCost(){return serviceCost(career);}
function dragMetrics(drag) {
  const value=(number,suffix='с')=>number===null?'—':number.toFixed(3)+' '+suffix;
  return `<div class="drag-metrics"><span>Реакция<strong class="${drag.falseStart?'negative':'positive'}">${value(drag.reaction)}</strong></span>
    <span>60 ft (18.288 м)<strong>${value(drag.sixty)}</strong></span><span>ET (без реакции)<strong>${value(drag.et)}</strong></span>
    <span>Скорость финиша<strong>${drag.trap?drag.trap.toFixed(1)+' км/ч':'—'}</strong></span>
    <span>Шины / обороты<strong>${Math.round(drag.temperature)}°C / ${drag.rpm}</strong></span>
    ${drag.splits?.length?drag.splits.map(split=>'<span>Отсечка '+split.distance.toFixed(3)+' м<strong>'+split.et.toFixed(3)+' с / '+split.speed.toFixed(1)+' км/ч</strong></span>').join(''):''}
    ${drag.falseStart?'<b class="negative">ФАЛЬСТАРТ · без рекорда</b>':''}</div>`;
}
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
    <div class="panel"><div class="eyebrow">Рекорд выбранной сборки</div><div class="big-number">${currentBest?currentBest.drift?score(currentBest.drift.score)+' Б':time(currentBest.time):'—'}</div><span class="micro">${getEvent(career.eventId).title} / ${weatherName(career.weather)}</span></div></div>
    <div class="event-grid">${EVENTS.map((event,index)=>{
      const open=unlocked(event,career);
      return `<article class="event-card ${open?'':'locked'}"><div class="event-card-head"><span class="eyebrow">${event.region} / ${event.mode==='drift'?'DRIFT / JUDGED RUN':event.mode==='drag'?'DRAG / 402 M':event.mode==='duel'?'TOUGE DUEL':'OFFICIAL TIME ATTACK'}</span><span class="event-num">0${index+1}</span></div>
        <div class="route-art">${routeMap(event)}</div><h2>${event.title}</h2><p>${event.description}</p><div class="micro">${event.sectors.length} СЕКТОРОВ · ${(eventLength(event)/1000).toFixed(2)} КМ · БЕЗ ВЗНОСА<br>ДО ${money(event.prize)} / УЧАСТИЕ ${money(event.participation)}</div>
        ${['duel','drag'].includes(event.mode)?'<div class="event-rival">Соперник: '+CARS.find(car=>car.id===event.rivalCar).name+'</div>':'<div class="event-rival">Медали: золото / серебро / бронза</div>'}
        <button class="${open?'primary':'secondary'} wide" data-event="${event.id}" ${!open||race&&!race.finished?'disabled':''}>${open?'Выбрать маршрут ↗':'Откроется: '+unlockText(event)}</button></article>`;
    }).join('')}</div>
    ${race&&!race.finished?'<div class="notice" style="margin-top:15px">Сначала заверши текущую сессию или выйди из неё на экране заезда.</div>':''}
    <div class="section-title"><div><div class="eyebrow">ТВОИ ОРИЕНТИРЫ</div><h2>Рекорды и сохранённые повторы</h2></div></div>
    <div class="notice">Рекорды разделены по трассе, погоде, машине, пилоту и деталям. Состояние машины указано отдельно: износ может изменить результат той же сборки. Старые заезды v0.1 остаются в истории, но без выдуманного повтора.</div>
    ${career.bests.length?`<div class="table-wrap"><table><thead><tr><th>Событие</th><th>Погода</th><th>Машина / пилот / детали</th><th>Стартовое состояние</th><th>Результат</th><th>Повтор</th></tr></thead><tbody>${career.bests.map((best,index)=>`<tr><td>${getEvent(best.eventId).title}${best.key.startsWith('2|')?'<small>Архив: баланс v0.2</small>':''}</td><td>${weatherName(best.weather)}</td><td>${CARS.find(car=>car.id===best.carId).name}<small>${PILOTS.find(pilot=>pilot.id===best.pilotId).name} · ${best.parts.map(id=>PARTS.find(part=>part.id===id).name).join(', ')||'Сток'}</small></td><td>${Math.round(best.condition)}%</td><td class="positive">${best.drift?score(best.drift.score)+' Б':time(best.time)}</td><td><button class="secondary" data-replay="${index}" ${race&&!race.finished?'disabled':''}>▶ Смотреть</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Первый финиш сохранит твой ориентир и повтор.</div>'}
    <h2 style="margin-top:30px">История заездов</h2>${career.records.length?`<div class="table-wrap"><table><thead><tr><th>Событие / условия</th><th>Машина</th><th>Баллы / время</th><th>Результат</th></tr></thead><tbody>${career.records.map(record=>`<tr><td>${getEvent(record.eventId).title}<small>${weatherName(record.weather)}</small></td><td>${record.car}</td><td>${getEvent(record.eventId).mode==='drift'?score(record.score)+' Б':time(record.time)}</td><td>${record.dnf?'Сход · вылет с трассы':record.medal?{gold:'Золото',silver:'Серебро',bronze:'Бронза'}[record.medal]:['timeattack','drift'].includes(getEvent(record.eventId).mode)?'Сессия завершена':record.falseStart?'Фальстарт':record.won?'Победа':'Без победы'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Ночь ещё только начинается.</div>'}
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
  openModal(`<div class="eyebrow">TOKYO STREETS / FOCUS & EXECUTION 0.7</div><h2>Найди свою линию.</h2><ol>
    <li><strong>Гараж.</strong> Выбери машину и пилота. Купи детали, которые подходят к маршруту; сборки у каждой машины свои.</li>
    <li><strong>Событие.</strong> Харуна доступна сразу. Для Акаги нужно 12 Street Cred. После двух завершённых сессий открывается клубный Time Attack в Цукубе.</li>
    <li><strong>Тактика.</strong> Все карты открыты. Повтор активного приёма в последних шести решениях экспоненциально увеличивает нагрузку, износ и потерю темпа. Один промежуточный ход не сбрасывает штраф. Разнообразные действия постепенно выводят его из памяти. Базовый «Чистый темп» всегда остаётся без штрафа. Серые объясняют ограничения. Читай разведку маршрута, прогноз, шины, тормоза и концентрацию.</li>
    <li><strong>Исполнение.</strong> Чем меньше текущий фокус, тем шире случайный разброс результата. Он действует на тебя, командного пилота и соперника. Восстановление фокуса стабилизирует следующие действия. Прогноз показывает ожидаемый результат; случайное исполнение определяется после выбора. Крайняя ошибка может привести к вылету и сходу с повреждением машины; при низком фокусе и опасном манёвре риск выше. За свой сход нет награды, рекорда и зачётного финиша.</li>
    <li><strong>Дуэль.</strong> Соперник планирует на три сектора по тем же правилам. Защита и слипстрим требуют реального окна.</li>
    <li><strong>Time Attack.</strong> Соперника нет; карты дуэли недоступны. Пороги медалей видны до старта. Завершённая сессия приносит Official Reputation.</li>
    <li><strong>Дрэг.</strong> После трёх финишей откроется 402 м, после четырёх — 804 м, после пяти — стоячая миля. На длинной дистанции есть выбор главной пары и давления перед стартом, затем управление высшей передачей, рабочим диапазоном и тепловой нагрузкой. Прогрев не входит во время. Выбирай старт, режим переключений и финиш. Победу определяет реакция + ET; фальстарт проигрывает даже с лучшим ET.</li><li><strong>Дрифт.</strong> При 20 Street Cred откроется Эбису: две связки по четыре клипа. Важны линия, заданный угол, скорость и непрерывность, а не минимальное время. Стабилизация доступна всегда, но обрывает связку.</li><li><strong>Команда.</strong> После четырёх финишей и 24 Street Cred либо 12 Official Rep можно основать команду и заключить контракты. Выбери менеджерское управление: пилот играет теми же картами по приказам и условному плану. Оплата пилота списывается при старте и не возвращается при выходе.</li><li><strong>Повтор.</strong> Лучший заезд сохраняет решения и время секторов. В следующем заезде с той же сборкой можно включить призрак или посмотреть полный повтор.</li>
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

function driftMedals(event){
  return `<div class="medal-targets"><span>● Золото <strong>${event.medals.gold} Б</strong></span><span>● Серебро <strong>${event.medals.silver} Б</strong></span><span>● Бронза <strong>${event.medals.bronze} Б</strong></span></div>`;
}
function driftMetrics(drift){
  const clip=drift.clips.at(-1);
  return `<div class="drift-metrics"><span>Последний клип<strong>${clip?score(clip.points)+' Б':'—'}</strong></span>
    <span>Связка / максимум<strong>${drift.combo} / ${drift.peakCombo}</strong></span><span>Чистые серии<strong>${drift.completedChains} / 2</strong></span>
    <span>Разрывы / развороты<strong>${drift.breaks} / ${drift.spins}</strong></span><span>Температура шин<strong>${Math.round(drift.temperature)}°C</strong></span></div>`;
}
function renderDriftReport(){
  const event=getEvent(race.eventId),d= race.player.drift,outcome=race.outcome||raceOutcome(race),ghost=race.ghost;
  $('#report').innerHTML=`<section class="report"><div class="report-hero"><div><div class="eyebrow">EBISU CLUB DRIFT / ${race.isBest?'НОВЫЙ РЕКОРД ПО БАЛЛАМ':'СУДЕЙСКИЙ ПРОТОКОЛ'}</div>
    <h2>${outcome.label} · ${score(d.score)} / 800</h2><p>+${money(outcome.reward)} · Official Rep +${outcome.official} · ${weatherName(race.weather)}
    ${ghost&&!race.player.dnf?'<br>К прошлому рекорду: '+signed(d.score-ghost.drift.score)+' баллов':''}</p>${damageHTML(race)}${managerFeedbackHTML(race)}<span class="micro">ЛИНИЯ 35% · УГОЛ 25% · СКОРОСТЬ 20% · СВЯЗНОСТЬ 20%<br>ВРЕМЯ ${time(race.player.time)} — ДЛЯ ПОВТОРА; ОЦЕНКА ОПРЕДЕЛЯЕТ РЕЗУЛЬТАТ</span></div>
    <div class="drag-result">${driftMetrics(d)}</div><div class="report-actions"><button id="retry" class="primary">Ещё одна связка ↗</button><button id="report-garage" class="secondary">В гараж</button><button id="replay-run" class="secondary">▶ Повтор заезда</button><button id="export" class="secondary">Протокол JSON ↓</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>Клип / разбор</th><th>Приём</th><th>Линия</th><th>Угол</th><th>Скорость</th><th>Связность</th><th>Штраф</th><th>Баллы / к рекорду</th></tr></thead><tbody>
    ${race.history.map(row=>{const clip=row.drift,previous=ghost?.drift.clips[row.index];return `<tr><td>${row.index+1}. ${row.sector}<small>${row.reasons.join('. ')}</small></td><td>${row.card}${row.command?'<small>'+orderName(row.command.requested)+' → '+orderName(row.command.effective)+'<br>'+row.command.reason+'</small>':''}</td>
      <td>${score(clip.line)}</td><td>${score(clip.angle)}<small>${score(clip.angleDegrees)}° / задание ${event.sectors[row.index].targetAngle}°</small></td>
      <td>${score(clip.speed)}<small>${Math.round(clip.velocity)} км/ч</small></td><td>${score(clip.continuity)}</td><td>${score(clip.penalty)}</td>
      <td class="${clip.valid?'positive':'negative'}">${score(clip.points)} Б${previous?'<small>'+signed(clip.points-previous.points)+' Б</small>':''}</td></tr>`;}).join('')}
    </tbody></table></div></section>`;
  bindReportActions();
}

function renderCommandPanel(r){
  const contract=contractFor(career,r.config.pilot.id);
  const manager=r.manager||{pilotId:r.config.pilot.id,trust:contract?.trust||70,fee:CREW[r.config.pilot.id].salary,
    order:career.team.plan.order,plan:career.team.plan,log:[]};
  const response=interpretOrder({...r,manager});
  $('.cards-area').innerHTML=`<div class="cards-header"><div><div class="eyebrow" id="command-team-name"></div><h2>Командный мостик</h2></div><span class="micro">${r.config.pilot.name} · ДОВЕРИЕ ${manager.trust} · ДИСЦИПЛИНА ${Math.round(CREW[r.config.pilot.id].discipline*100)}%</span></div>
    <div class="command-grid">${ORDERS.map(order=>`<button class="command-button ${manager.order===order.id?'selected':''}" data-order="${order.id}" ${!race?'disabled':''}><strong>${order.name}</strong><span>${order.description}</span></button>`).join('')}</div>
    <div class="forecast"><div class="forecast-main"><strong>Ответ пилота: ${orderName(response.effective)}</strong><p>${response.reason}</p><p class="micro">Карты выбирает пилот. Темп и ресурсы рассчитываются общей симуляцией, без скрытых бонусов.</p></div>
    <div class="inline-actions"><button id="execute" class="primary" ${!race?'disabled':''}>Передать сектор пилоту ↗</button><button id="auto-run" class="secondary" ${!race?'disabled':''}>${autoRun?'Остановить после участка':'Авто до финиша'}</button></div></div>
    <p class="forecast-note">Оплата за старт: ${money(manager.fee)}. ${race?'Уже списана.':'Будет списана перед стартом.'} При выходе и перезагрузке не возвращается. План и контракты — в разделе «Команда».</p>
    ${manager.log.length?'<div class="last-sector">Последнее решение: '+orderName(manager.log.at(-1).requested)+' → '+orderName(manager.log.at(-1).effective)+'. '+manager.log.at(-1).reason+'</div>':''}`;
  $('#command-team-name').textContent=career.team.name;
  document.querySelectorAll('[data-order]').forEach(button=>button.onclick=()=>{if(busy||!race)return;race=setManagerOrder(race,button.dataset.order);renderCommandPanel(race);});
  $('#execute').onclick=execute;
  $('#auto-run').onclick=()=>{if(!race)return;autoRun=!autoRun;$('#auto-run').textContent=autoRun?'Остановить после участка':'Авто до финиша';if(autoRun&&!busy)execute();else if(!autoRun)clearTimeout(autoTimer);};
}
function managerFeedbackHTML(r){
  const feedback=r.teamFeedback;
  return feedback?`<p class="team-feedback">Пилот: оплата ${money(feedback.fee)} списана на старте · доверие ${feedback.before} → ${feedback.after} · опыт +1<br>${feedback.reason}</p>`:'';
}
function teamAction(action){
  try{career=action();race=null;save();render();return true;}catch(error){toast(error.message);return false;}
}
function renderTeam(){
  const locked=!!race&&!race.finished,team=career.team;
  app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">TEAM HQ / 仲間</div><h1 id="team-title"></h1></div><span class="badge">${team.founded?'ШТАБ ОТКРЫТ':'ПУТЬ К СВОЕЙ КОМАНДЕ'}</span></div>
    ${locked?'<div class="notice">Заезд активен. Контракты, назначение и план можно менять после финиша или выхода.</div>':''}
    ${!team.founded?`<section class="panel"><h2>Собери людей вокруг своего ритма.</h2><p>Команда открывает управление через приказы: ты отвечаешь за пилота и машину, а пилот сам выбирает карты. Первый этап — одна машина на трассе.</p>
    <div class="team-requirements"><span>Финиши: ${career.races} / 4</span><span>Street Cred: ${career.street} / 24 <b>или</b> Official Rep: ${career.official} / 12</span><span>Основание: ${money(TEAM_PRICE)}</span></div>
    <button id="found-team" class="primary" ${locked||!canFoundTeam(career)||career.money<TEAM_PRICE?'disabled':''}>Основать команду · ${money(TEAM_PRICE)}</button></section>`:
    `<div class="panel team-settings"><label>Название команды <input id="team-name" maxlength="40" ${locked?'disabled':''}></label><button id="rename-team" class="secondary" ${locked?'disabled':''}>Сохранить название</button><span class="micro">АКТИВНАЯ МАШИНА: ${car().name} / ${pilot().name}</span></div>`}
    <div class="section-title"><div><div class="eyebrow">THE PEOPLE</div><h2>Характер имеет значение.</h2></div></div>
    <div class="pilot-row">${PILOTS.map(p=>{const crew=CREW[p.id],contract=contractFor(career,p.id);return `<article class="pilot ${career.pilot===p.id?'selected':''}"><div class="pilot-symbol" style="color:${p.color}">${p.trait}</div><h3>${p.name}</h3><p>${p.description}</p>
      <div class="micro">ДИСЦИПЛИНА ${Math.round(crew.discipline*100)}% · КОНТРАКТ ${money(crew.fee)}<br>ОПЛАТА ЗА КАЖДЫЙ СТАРТ ${money(crew.salary)}<br>${contract?'ДОВЕРИЕ '+contract.trust+' / 100 · ЗАЕЗДОВ В КОМАНДЕ '+contract.experience:'БЕЗ КОНТРАКТА'}</div>
      <button class="${contract?'secondary':'primary'} wide" ${locked||!team.founded||!contract&&career.money<crew.fee||contract&&career.pilot===p.id?'disabled':''} ${contract?'data-assign':'data-hire'}="${p.id}">${contract?career.pilot===p.id?'Назначен на текущую машину':'Назначить пилота':'Заключить контракт · '+money(crew.fee)}</button></article>`;}).join('')}</div>
    ${team.founded?`<section class="panel team-plan"><div class="eyebrow">RACE PLAN</div><h2>Приказ и условия переключения</h2><p>Условия проверяются сверху вниз. Первое сработавшее меняет приказ на текущем участке; характер и состояние определяют ответ пилота.</p>
      <label>Базовый приказ <select id="plan-order" ${locked?'disabled':''}>${ORDERS.map(order=>`<option value="${order.id}">${order.name}</option>`).join('')}</select></label>
      <div class="plan-rules">${PLAN_RULES.map(rule=>`<label><input type="checkbox" data-rule="${rule.id}" ${team.plan.rules[rule.id]?'checked':''} ${locked?'disabled':''}> ${rule.name}</label>`).join('')}</div>
      <button id="save-plan" class="primary" ${locked?'disabled':''}>Сохранить план</button><span id="plan-saved" class="micro"></span></section>`:''}
    <p class="notice" style="margin-top:20px">Физика, карты, ограничения и наказание за повтор приёма одинаковы в личном и менеджерском режиме. Доверие влияет на трактовку приказа, а не даёт бонус к мощности. В гараже можно лично выступать любым пилотом; контракт нужен для командного управления.</p>`;
  $('#team-title').textContent=team.founded?team.name:'От гонщика — к руководителю';
  if($('#found-team'))$('#found-team').onclick=()=>teamAction(()=>foundTeam(career,locked));
  if(team.founded){
    $('#team-name').value=team.name;$('#plan-order').value=team.plan.order;
    $('#rename-team').onclick=()=>teamAction(()=>renameTeam(career,$('#team-name').value,locked));
    $('#save-plan').onclick=()=>{const rules=Object.fromEntries([...document.querySelectorAll('[data-rule]')].map(input=>[input.dataset.rule,input.checked]));if(teamAction(()=>setTeamPlan(career,{order:$('#plan-order').value,rules},locked)))toast('План сохранён для следующих заездов.');};
  }
  document.querySelectorAll('[data-hire]').forEach(button=>button.onclick=()=>teamAction(()=>hirePilot(career,button.dataset.hire,locked)));
  document.querySelectorAll('[data-assign]').forEach(button=>button.onclick=()=>teamAction(()=>assignPilot(career,button.dataset.assign,locked)));
}
