import {gridPanelHTML,gridPrizeHTML} from './grid-view.js';
import {gridStandings,gridPlanningState} from './grid-race.js';
import {cardComparison,cardMetricsHTML,strainHTML,unavailableHTML} from './race-ui.js';
import {partComparisonHTML} from './part-comparison.js';
import {finishOverviewHTML} from './finish-view.js';
import {createLesson,resolveLesson,settleLesson,schoolCards} from './driving-school.js';
import {schoolHomeHTML,schoolCoachHTML,schoolReportHTML} from './driving-school-view.js';
import {ZOOM_STEPS} from './scene-camera.js';
import {sectorFeedbackHTML,sectorDetailsHTML} from './sector-feedback.js';
import {savesHTML,beginnerHTML,welcomeHTML} from './release-view.js';
import {SLOT_LABELS} from './parts.js';
import {orderName} from './team.js'; // Archived manager replays only.
import {applyWorkshopPreset,partAccessReason,WORKSHOP_PRESETS} from './workshop.js';
import {workshopHTML} from './workshop-view.js';
import {RaceAudio} from './race-audio.js';
import {playerConfiguration,withTraining,SKILL_CARDS,trainPlayer,togglePlayerSkill,resetPlayer} from './player.js';
import {playerHTML,playerReportHTML,activeSkillsHTML} from './player-view.js';
import {benchDraft,normalizeBenchDraft,benchPart} from './bench.js';
import {benchHTML} from './bench-view.js';
import {specialCupsHTML} from './special-cups-view.js';
import {getChallenge,previewChallenge,bookChallenge,challengeReason} from './rivals.js';
import {rivalsHTML,challengeReportHTML} from './rivals-view.js';
import {racingLinesHTML} from './racing-lines-view.js';
import {lineCard,lineReason,lineName,RACING_LINES} from './racing-lines.js';
import {getLanguage,setLanguage,localize,observeLocalization} from './i18n.js';
import {summarizeRace,raceSummaryHTML} from './race-summary.js';
import {journeyFocusHTML,journeyHTML,routeMasteryHTML,journeyReportHTML} from './journey-view.js';
import {powertrainHTML,maintenanceHTML,wearSummaryHTML,mountPowertrain} from './powertrain-view.js';
import {buyEngine,installEngine,exchangeEngines} from './powertrain.js';
import {getEngine} from './engine-data.js';
import {installedEngineId} from './engine-data.js';
import {mountWorkbench,fitWorkspace,selectWorkspaceTab} from './workbench.js';
import {defaultSeries,saveSeries,deleteSeries,exportSeries,importSeries} from './organizer.js';
import {organizerHTML,seriesQuoteHTML} from './organizer-view.js';
import {CUPS,getCup,activeCup,enterCup,withdrawCup,prepareStage,bookCupRace,previewCupOpponent} from './championship.js';
import {savePreset,applyPreset,deletePreset} from './presets.js';
import {cupNameHTML,escapeHTML,presetsHTML,championshipHTML,seasonReportHTML} from './career-view.js';
import {setupControlsHTML} from './setup-view.js';
import {SETUP_FIELDS,defaultSetup} from './setup.js';
import {partReason} from './tuning.js';
import {admissionReason,payoutScale,raceClass,unlockEverything,rewardFactor} from './balance.js';
import {dashboardHTML,bindDashboard} from './dashboard.js';
import {readTelemetry,interpolateTelemetry,sampleTelemetry,transmissionProfile} from './telemetry.js';
import {DRIFT_CARDS} from './drift-data.js';
import {replayIndex,driftFrame} from './replay.js';
import {qualitativeForecast} from './tactics.js';
import {ALL_DRAG_CARDS as DRAG_CARDS} from './drag-data.js';
import {selectCar,togglePart,serviceCar,serviceCost,tradeInQuote,tradeInCar,recoveryService,setCarSetup,repairComponent,recoveryNeeded} from './garage.js';
import {disciplineOf,CARS, PARTS, TUNING_GROUPS, DISCIPLINES, EVENTS, CARDS, getEvent, sectorAt, eventLength} from './data.js';
import {configuration, modernRoadRace,freeRivalOptions,performanceProfile,nominalConfiguration,availableCards, disabledReason, simulate, createRace, resolveSector, medalTargets, raceOutcome} from './engine.js';
import {readSlot,storeCareer,newCareer,activeSlot,slotKey,slotList,renameSlot,activateSlot,writeSlot,restoreSlot,exportCareer,importCareer,SAVE_FILE_LIMIT} from './storage.js';
import {awardRace, bestFor, unlocked, unlockText, cumulativeTimes, raceRecord} from './progress.js';
import {garageArtworkHTML,garageCarsByPrice} from './garage-art.js';
import {Scene} from './scene.js';

const $ = selector => document.querySelector(selector);
const app = $('#app');
let storage;
try { storage = window.localStorage; }
catch { storage = {getItem: () => null, setItem: () => {throw Error('Нет хранилища');}}; }
const sound=new RaceAudio(storage);
let sessionSlot=activeSlot(storage),initialSave=readSlot(storage,sessionSlot),expectedRaw=initialSave.raw;
let career=initialSave.career,saveState=initialSave.status==='error'?'error':'ok',unreadableSlot=initialSave.status==='error';
const debugEnabled=new URLSearchParams(window.location?.search||'').get('debug')==='1';
let raceStart=null,schoolIntent=null;
// A single playable driver for now; preserve legacy pilots and team contracts in the save for future updates.
career.pilot='ren';career.control='personal';
if (!unlocked(getEvent(career.eventId),career)) career.eventId = 'haruna';
let trialBuild=null;
let challengeIntent=null,selectedLine='neutral';
let motorSelection={},garagePreview=null,garageDrive='all',seasonIntent=!!career.raceIntent,seriesDraft=defaultSeries(),seriesEditingId=null;
if(seasonIntent)career=prepareStage(career);
let view = 'race', race = null, selected = 'balanced', filter = 'Все',onlyAvailable=true;
let dashboardUpdate=null;
let closeCamera=false,lastCamera=null,lastCameraEvent=null,focusRace=true;
let busy = false, scene = null, fast = false, paused = false, replayRecord = null;
let toastTimer;
const money = value => '¥ ' + Math.round(value).toLocaleString(getLanguage()==='en'?'en-US':'ru-RU');
const time = value => `${Math.floor(value/60)}:${(value%60).toFixed(2).padStart(5,'0')}`;
const score=value=>(value||0).toFixed(1);
const signed = value => (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(2);
const weatherName = value => ({dry:'Сухо',mixed:'Переменная влажность',rain:'Дождь'})[value];
const car = () => CARS.find(car => car.id === career.car);
function config() { return {routeVersion:['duel','timeattack'].includes(getEvent(career.eventId).mode)?3:2,...playerConfiguration(configuration(career.car,career.pilot,career.builds[career.car],career.condition[career.car],career.setups?.[career.car],installedEngineId(career),career.wear?.[career.car]),career.player),...(!seasonIntent?{rivalLevel:career.rivalLevel}:{})}; }
function previewRace() {
  if(replayRecord){
    const saved=withTraining(configuration(replayRecord.carId,replayRecord.pilotId,replayRecord.parts,replayRecord.condition,replayRecord.setup,replayRecord.engineId,replayRecord.wear),replayRecord.training||{});
    if(replayRecord.routeVersion)saved.routeVersion=replayRecord.routeVersion;
    saved.pilot={...saved.pilot,focus:saved.pilot.focus+(replayRecord.manager?.level||0)};
    return createRace(saved,replayRecord.weather,replayRecord.eventId);
  }
  if(race)return race;
  if(schoolIntent!==null)return createLesson(career,schoolIntent);
  if(challengeIntent)return modernRoadRace(previewChallenge(config(),challengeIntent));
  const preview=createRace(config(),career.weather,career.eventId,null,null,seasonIntent?null:career.rivalLevel);
  const opponent=seasonIntent?previewCupOpponent(career):null;
  if(opponent){preview.rival=opponent.rival;preview.rivalName=opponent.name;preview.opponent=createRace(opponent.rival,career.weather,career.eventId).player;if(opponent.dns)preview.opponent.dnf={reason:'Технический недопуск',damage:0,speed:0};}
  return preview;
}
function ghostFor(r) { return race === r && !r.finished ? race.ghost : bestFor(career,r.config,r.eventId,r.weather); }
function updateWallet() { $('#wallet').textContent = money(career.money); }
function save() {
  try{
    if(activeSlot(storage)!==sessionSlot||storage.getItem(slotKey(sessionSlot))!==expectedRaw){saveState='conflict';throw Error('Сохранение изменилось в другой вкладке. Скачай текущую карьеру и перезагрузи страницу.');}
    if(!storeCareer(storage,career)){saveState='error';throw Error('Не удалось сохранить прогресс. Открой «Сохранения» и скачай текущую карьеру.');}
    expectedRaw=storage.getItem(slotKey(sessionSlot));saveState='ok';updateSaveStatus();updateWallet();return true;
  }catch(error){if(saveState!=='conflict')saveState='error';updateSaveStatus();toast(error.message);updateWallet();return false;}
}
function updateSaveStatus(){
 const button=$('#saves');if(button){button.textContent=saveState==='ok'?'Сохранения · '+sessionSlot:'⚠ Не сохранено';button.classList.toggle('negative',saveState!=='ok');}
 let warning=$('#save-warning');if(saveState==='ok'){warning?.remove();return;}
 if(!warning){warning=document.createElement('div');warning.id='save-warning';warning.className='notice negative';warning.setAttribute('role','alert');app.prepend(warning);}
 warning.textContent=saveState==='conflict'?'Карьера изменена в другой вкладке. Автосохранение остановлено: скачай файл текущей карьеры через «Сохранения», затем перезагрузи страницу.':(unreadableSlot?'Слот не удалось загрузить: открыта временная новая карьера, исходные данные не перезаписаны. ':'Автосохранение недоступно. Прогресс не записан. ')+ ' Открой «Сохранения»: скачай текущую карьеру, восстанови резервную копию или выбери другой слот.';
}
function toast(message) {
  $('#toast').textContent=message;localize($('#toast'));$('#toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);
}
function render() {
  if(scene){lastCamera=scene.viewState;lastCameraEvent=scene.event.id;}
  scene?.destroy();scene=null;dashboardUpdate=null;
  document.body.classList.toggle('race-focus',view==='race'&&focusRace&&!!(race&&!race.finished||replayRecord));
  document.querySelectorAll('[data-view]').forEach(button=>{
    button.classList.toggle('active',button.dataset.view===view);button.disabled=busy;
  });
  delete app.dataset.lesson;
  if(view==='player')renderPlayer();else if(view==='garage')renderGarage();else if(view==='tuning')renderTuning();else if(view==='seasons')renderSeasons();else if(view==='world')renderWorld();else renderRace();
  mountWorkbench(app,view,career,race);
  if(!replayRecord&&schoolIntent===null&&!race?.school)app.querySelector('.context-bar').insertAdjacentHTML('afterend',journeyFocusHTML(career,busy||!!race&&!race.finished));
  const cupState=career.championships.active;
  if(cupState&&!seasonIntent&&!replayRecord&&!(race&&!race.finished)&&!race?.season&&schoolIntent===null){
    app.querySelector('.context-bar').insertAdjacentHTML('afterend',`<div class="notice cup-resume">${cupNameHTML(activeCup(cupState))} · <span>Завершено этапов:</span> ${cupState.stage} / ${activeCup(cupState).stages.length} <button id="resume-cup" class="primary">Продолжить чемпионат ↗</button></div>`);
    $('#resume-cup').onclick=prepareCupStage;
  }
  document.querySelectorAll('[data-journey-event]').forEach(button=>button.onclick=()=>{if(busy||race&&!race.finished)return;career.eventId=button.dataset.journeyEvent;schoolIntent=null;race=null;seasonIntent=false;career.raceIntent=null;challengeIntent=null;view='race';save();render();});
  document.querySelectorAll('[data-journey-view]').forEach(button=>button.onclick=()=>{if(busy||race&&!race.finished)return;race=null;view=button.dataset.journeyView;if(view==='world')selectWorkspaceTab('world','events');render();});
  if(debugEnabled)app.insertAdjacentHTML('beforeend',`<details class="debug-drawer"><summary>Отладка</summary><aside class="debug-tools"><strong>DEBUG</strong><button id="debug-unlock" class="secondary" ${busy?'disabled':''}>Открыть всё</button><button id="debug-reset" class="secondary" ${busy?'disabled':''}>Сбросить всё</button><span>Локальная карьера в этом браузере</span></aside></details>`);
  if($('#debug-unlock'))$('#debug-unlock').onclick=()=>{stopDebugRun();career=unlockEverything(career);career.raceIntent=null;save();render();toast('Открыты все события, машины и детали. На счету ¥1 000 000.');};
  if($('#debug-reset'))$('#debug-reset').onclick=()=>openModal('<h2>Сбросить всё?</h2><p>Будут удалены деньги, покупки, история и повторы. Начнётся новая карьера с ¥18 000.</p><div class="inline-actions"><button class="primary" id="debug-reset-confirm">Сбросить всё</button><button class="secondary" data-close>Отмена</button></div>',()=>{$('#debug-reset-confirm').onclick=()=>{stopDebugRun();career=newCareer();save();$('#modal').close();render();};});
  document.querySelectorAll('[data-school-start]').forEach(button=>button.onclick=()=>{if(busy||race&&!race.finished)return;schoolIntent=Number(button.dataset.schoolStart);race=null;seasonIntent=false;career.raceIntent=null;challengeIntent=null;view='race';save();render();});
  localize(document);
  fitWorkspace(app);
  updateWallet();updateSaveStatus();updateRaceFocus();
}
function updateRaceFocus(){
 const active=view==='race'&&!!(race&&!race.finished||replayRecord);
 document.body.classList.toggle('race-focus',active&&focusRace);
 const button=$('#race-menu-toggle');if(button)button.textContent=focusRace?'Показать меню':'Скрыть меню';
 fitWorkspace(app);
}
function stopDebugRun(){schoolIntent=null;scene?.destroy();scene=null;race=null;replayRecord=null;busy=false;paused=false;selected='balanced';filter='Все';garageDrive='all';garagePreview=null;seriesDraft=defaultSeries();seriesEditingId=null;seasonIntent=false;challengeIntent=null;selectedLine='neutral';}
function sectorDescription(s) {
  return `${s.label}${s.mode==='drift'?' · '+s.clip+' · угол '+s.targetAngle+'° · '+s.targetSpeed+' км/ч':''} · ${Math.round(s.length)} м${s.radius?' · радиус '+s.radius+' м':''} · уклон ${Math.round(s.slope*100)}% · влажность ${Math.round(s.wet*100)}%`;
}
function medalHTML(eventId,weather,r=previewRace()) {
  const targets=r.targets||medalTargets(eventId,weather,r.config);
  const profile=performanceProfile(nominalConfiguration(r.config),eventId,weather);
  return `<p class="micro">Норматив для этой машины: ${profile.kgPerHp.toFixed(2)} кг/л.с. · сцепление ×${profile.grip.toFixed(2)} · ресурс 100%</p><div class="medal-targets"><span>● Золото <strong>${time(targets.gold)}</strong></span>
    <span>● Серебро <strong>${time(targets.silver)}</strong></span><span>● Бронза <strong>${time(targets.bronze)}</strong></span></div>`;
}
function duelOptions(r){
 if(r.grid)return '';
 if(r.school||!['duel','drag'].includes(r.mode)||race||replayRecord||seasonIntent||challengeIntent||r.season||r.challenge)return '';
 return `<fieldset class="rival-options"><legend>Выбор соперника</legend>${freeRivalOptions(r.config,r.eventId,r.weather).map(o=>`<button class="secondary ${career.rivalLevel===o.id?'selected':''}" data-rival-level="${o.id}" aria-pressed="${career.rivalLevel===o.id}" ${race?'disabled':''}><strong>${o.name} · ${o.rival.car.name}</strong><span>${o.profile.power} л.с. / ${Math.round(o.profile.mass)} кг · рейтинг ${Math.round(o.profile.rating)} / твой ${Math.round(o.playerRating)}${o.prepared?' · подготовленный автомобиль':''} · приз ×${o.reward}</span></button>`).join('')}<p class="micro">${r.mode==='duel'?'Учебный соперник едет по базовой линии и использует простой план. «На равных» и «Сильнее» планируют на три сектора и подбирают траектории.':'Сила машины соперника зависит от мощности, массы и сцепления. Приёмы дрэга используют прежнее планирование.'} Рекорды разделены по уровню соперника.</p></fieldset>`;
}
function renderRace() {
  const r=previewRace(),event=getEvent(r.eventId,r.routeVersion),count=event.sectors.length;
  const isSchool=!!r.school;
  const offers=duelOptions(r),startReason=isSchool?'':!seasonIntent&&!unlocked(getEvent(r.eventId,r.routeVersion),career)?unlockText(getEvent(r.eventId,r.routeVersion)):admissionReason(career,r.eventId);
  const s=sectorAt(Math.min(r.index,count-1),r.weather,event.id,r.routeVersion),duel=['duel','drag'].includes(r.mode),isDrag=r.mode==='drag',isDrift=r.mode==='drift';
  const gap=r.opponent.dnf?Infinity:r.player.time-r.opponent.time,ghost=ghostFor(r),isReplay=!!replayRecord;
  app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">JAPAN / ${event.region}</div>
      <h1>${isReplay?'Твой лучший заезд':event.title}</h1></div><div class="event-controls ${race||isReplay?'session-active':''}">
      <label><span class="micro">ДИСЦИПЛИНА</span><select id="discipline-select" ${race||isReplay||seasonIntent||challengeIntent||isSchool?'disabled':''}>${DISCIPLINES.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}</select></label><label><span class="micro">ТРАССА</span><select id="event-select" ${race||isReplay||seasonIntent||challengeIntent||isSchool?'disabled':''}>
      ${EVENTS.filter(item=>disciplineOf(item)===disciplineOf(event)).map(item=>`<option value="${item.id}" ${!unlocked(item,career)?'disabled':''}>${item.title}${!unlocked(item,career)?' · '+unlockText(item):''}</option>`).join('')}</select></label>
      <label><span class="micro">ПОКРЫТИЕ</span><select id="weather" ${race||isReplay||seasonIntent||challengeIntent||isSchool?'disabled':''}><option value="mixed">☂ Переменная влажность</option><option value="dry">☾ Сухой асфальт</option><option value="rain">☂ Дождь</option></select></label></div>
    ${race||isReplay?'<div class="session-context"><span>ЗА РУЛЁМ: ТЫ</span><strong>'+escapeHTML(event.title)+'</strong><span>'+weatherName(r.weather)+'</span></div>':''}</div>
    ${r.grid&&!r.finished&&!isReplay?gridPanelHTML(r,busy):''}${isSchool?schoolCoachHTML(r):!isReplay?beginnerHTML(career,race):''}<div id="last-result" aria-live="polite"></div>${isReplay||r.finished?'':'<section id="forecast" class="decision-bar" aria-label="Выбранный приём и исполнение"></section>'}<div class="race-layout"><section><div class="scene-wrap"><canvas id="scene" tabindex="0" aria-describedby="map-instructions" aria-label="Изометрическая трасса ${event.title}"></canvas>
      <div class="scene-top"><div><div class="eyebrow">${event.japanese} · ${event.name.toUpperCase()}</div><h2>${event.title}</h2><span class="badge">${isDrift?'DRIFT / JUDGED RUN':isDrag?(event.id==='yokohama-mile'?'DRAG / STANDING MILE':event.longDrag?'DRAG / HALF MILE':'DRAG / QUARTER MILE'):duel?'TOUGE / DUEL':'OFFICIAL / TIME ATTACK'}</span></div>
      <div class="route-stats">${(eventLength(event)/1000).toFixed(2)} KM<br>${count} ${isDrift?'КЛИПОВ':isDrag?(count===4?'ФАЗЫ':'ФАЗ'):'СЕКТОРОВ'}<br>${event.theme==='circuit'?'18:20':'23:48'} / 12°C<br>ЗАКРЫТЫЙ МАРШРУТ</div></div>
      <div class="scene-caption"><div class="stamp" id="scene-status">${isReplay?'ПОВТОР РЕКОРДА':isDrag&&!race?count+(count===4?' ФАЗЫ':' ФАЗ')+' / ET + РЕАКЦИЯ':r.finished?(r.player.dnf?'СХОД / DNF':r.grid?'ФИНИШ':r.opponent.dnf?'ПОБЕДА · СОХОД СОПЕРНИКА':'ФИНИШ'):race?'СЕКТОР '+String(r.index+1).padStart(2,'0')+' · '+(s.type==='corner'?'ПОВОРОТ':'ПРЯМАЯ'):'ПЕРЕД СТАРТОМ'}</div>
      <h3 id="scene-sector">${r.finished?'Заезд окончен.':s.name}</h3>
      <p id="scene-description">${isReplay?'Сохранённые решения и время. Повтор не приносит наград.':race?sectorDescription(s):event.description}</p></div>
      <div id="scene-tactic" class="scene-tactic" aria-live="off"></div><div class="scene-tools"><button id="map-zoom-out" aria-label="Отдалить карту">−</button><output id="map-zoom" aria-label="Масштаб карты" aria-live="off">100%</output><button id="map-zoom-in" aria-label="Приблизить карту">+</button><button id="camera-toggle">Вся трасса</button><button id="camera-focus">К машине</button><button id="camera-follow" aria-pressed="${closeCamera}">${closeCamera?'Слежение: вкл':'Слежение: выкл'}</button><span id="map-inspection" role="status" hidden></span><span id="map-instructions">Колёсико — масштаб · тянуть — сдвиг</span>${race&&!race.finished||isReplay?'<button id="race-menu-toggle">Показать меню</button>':''}<button id="sound-toggle" aria-pressed="${sound.enabled}">${sound.enabled?'♫ Звук: вкл':'♫ Звук: выкл'}</button><label class="sound-volume">Громкость<input id="sound-volume" type="range" min="0" max="0.6" step="0.05" value="${sound.volume}" aria-label="Громкость звука"></label><button id="pause" ${!isReplay?'disabled':''}>Ⅱ Пауза</button><button id="speed">${fast?'2×':'1×'} Скорость</button></div></div>
      <div class="sector-strip">${event.sectors.map((sector,i)=>`<div class="sector-node ${i<r.index?'done':i===r.index?'current':''}" title="${sector.name} · ${Math.round(sector.length)} м">${String(i+1).padStart(2,'0')} ${sector.type==='corner'?'⌁':'—'}</div>`).join('')}</div>
      <details class="route-brief"><summary>${isDrift?'Судейские клипы':isDrag?'Фазы дрэга':'Информация о трассе'} · ${count}</summary><div class="route-list">${event.sectors.map((_,i)=>{const sector=sectorAt(i,r.weather,event.id,r.routeVersion);return `<div class="${i===r.index?'current':''}"><span class="micro">${String(i+1).padStart(2,'0')}</span><strong>${sector.name}</strong><span>${sectorDescription(sector)}</span></div>`;}).join('')}</div></details></section>
      <aside class="sidebar">${challengeIntent&&!race&&!isReplay?'<div class="notice">Вызов: '+getChallenge(challengeIntent).name+'<br>'+getChallenge(challengeIntent).tell+'<button id="challenge-cancel" class="secondary">К свободным заездам</button></div>':''}${seasonIntent&&career.championships.active?'<div class="notice">Этап кубка: '+cupNameHTML(activeCup(career.championships.active))+'<button id="season-practice" class="secondary">Перейти к свободному заезду</button></div>':''}${offers}${activeSkillsHTML(r.config)}${dashboardHTML(r.config)}<div class="notice">Класс сборки: <strong>${raceClass(r.config).name}</strong><br>${!seasonIntent&&!unlocked(event,career)?'Доступ: '+unlockText(event):admissionReason(career,r.eventId)||'Машина допущена к старту'}<br>${routeMasteryHTML(career,event)}Выплаты за повторение: ${Math.round(payoutScale(career,r.eventId)*100)}%<br>Нагрузка атак: ${(r.player.strain||0).toFixed(1)} / 6</div>
      <div class="panel race-session"><div class="eyebrow">${isReplay?'ХРОНОМЕТР':duel?(r.rivalLevel==='easy'&&r.mode==='duel'?'УЧЕБНЫЙ СОПЕРНИК · БАЗОВАЯ ЛИНИЯ':'СОПЕРНИК / AI · ПЛАН НА 3 СЕКТОРА'):'ОДИНОЧНАЯ СЕССИЯ'}</div>
      ${duel&&!isReplay?`<div class="entry"><div class="car-swatch" style="--car:${r.rival.car.color}"></div><div><strong>${r.rival.car.name}</strong><span>${r.rivalName||r.rival.pilot.name} / ${r.rival.pilot.trait}</span></div></div>`:''}
      <div class="gap ${isDrag&&r.player.drag.falseStart?'negative':duel&&gap<=0?'positive':duel?'negative':''}" id="live-clock">${isReplay?time(r.player.time):isDrift?score(r.player.drift.score):!duel?time(r.player.time):isDrag&&r.player.drag.falseStart?'RED LIGHT':r.opponent.dnf?'СОПЕРНИК СОШЁЛ':signed(gap)}
      <small>${isReplay?'ПОВТОР БЕЗ НАГРАД':isDrift?'БАЛЛЫ ЗА СЕССИЮ / МАКС. 800':!duel?'ТВОЁ ВРЕМЯ':r.opponent.dnf?'ПОБЕДА · СОПЕРНИК СОШЁЛ':gap===0?'НА ОДНОЙ ЛИНИИ':gap<0?'ТЫ ВПЕРЕДИ / СЕК':'ТЫ ПОЗАДИ / СЕК'}</small></div>
      ${r.challenge?.target!==null&&r.challenge?.target!==undefined?'<p class="notice">Цель соперника: <strong>'+r.challenge.target+' баллов</strong></p>':''}${isDrift?driftMedals(event)+(isReplay?'<p class="micro">ИТОГ ЗАПИСАННОГО ЗАЕЗДА</p>':'')+driftMetrics(isReplay&&replayRecord.drift?replayRecord.drift:r.player.drift):!duel?medalHTML(event.id,r.weather):isDrag?dragMetrics(isReplay&&replayRecord.drag?replayRecord.drag:r.player.drag):''}
      ${isReplay?'<button id="stop-replay" class="secondary wide">Завершить просмотр</button>':!race?'<button id="start" class="primary wide" '+(startReason?'disabled':'')+'>'+(isSchool?'Начать учебный заезд ↗':seasonIntent?'На старт этапа ↗':'1. Начать заезд ↗')+'</button>'+(startReason?'<p class="negative">'+escapeHTML(startReason)+'</p>'+(unlocked(event,career)?'<button id="race-maintenance" class="secondary wide">Открыть сервис узлов</button>':'<button id="race-career" class="secondary wide">Выбрать доступный маршрут</button>'):''):r.finished?'<button id="show-report" class="primary wide">Посмотреть результат ↓</button>':'<button id="restart" class="secondary wide">Начать заново</button><button id="abandon" class="secondary wide">Покинуть заезд</button>'}</div>
      ${!isReplay?`<div class="panel ghost-panel"><div class="eyebrow">ЛИЧНЫЙ РЕКОРД / ЭТА СБОРКА</div><div class="record-time">${ghost?ghost.drift?score(ghost.drift.score)+' Б':time(ghost.time):'Рекорда пока нет.'}</div>
      <p>${ghost?'Та же трасса, погода, машина, детали и уровень соперника. Состояние в рекорде: '+ghost.condition.toFixed(0)+'%.':'Заверши заезд — появятся рекорд, призрак и повтор.'}</p>
      ${ghost?`<label class="ghost-toggle"><input id="ghost-toggle" type="checkbox" ${career.ghostEnabled?'checked':''}> Показывать призрак</label>${!race||race.finished?'<button id="replay-best" class="secondary wide">▶ Повтор рекорда</button>':''}`:''}</div>`:''}
      </aside></div>
    ${isReplay||r.finished?'':`<section class="cards-area"><div class="cards-header"><h2>2. Выбери приём <span id="deck-count">${schoolCards(r).length} КАРТ</span></h2><span class="micro">${race?'ВЫБЕРИ КАРТУ → ИСПОЛНИ СЕКТОР':'ПРОСМОТР ПЕРЕД СТАРТОМ'} · БЕЗ СЛУЧАЙНОЙ РАЗДАЧИ</span></div><div id="racing-plan"></div><div id="filters" class="filters"></div><div id="cards" class="cards-grid"></div><div id="unavailable"></div></section>`}
    <div id="report"></div><div class="footer-line"><span>TOKYO STREETS / PUBLIC ALPHA 0.31.1</span><span>КАРТЫ — НАМЕРЕНИЯ. РЕЗУЛЬТАТ — ФИЗИКА.</span></div>`;
  if(isSchool)app.dataset.lesson=String(r.school.step);
  if($('#school-leave'))$('#school-leave').onclick=()=>{schoolIntent=null;race=null;render();};
  $('.sidebar')?.prepend($('.race-session'));
  document.querySelectorAll('[data-rival-level]').forEach(button=>button.onclick=()=>{if(race||replayRecord||seasonIntent)return;career.rivalLevel=button.dataset.rivalLevel;save();render();});
  $('#discipline-select').value=disciplineOf(event);$('#discipline-select').onchange=e=>{const routes=EVENTS.filter(item=>disciplineOf(item)===e.target.value);const next=routes.find(item=>unlocked(item,career))||routes[0];career.eventId=next.id;race=null;save();render();};
  if(r.grid){$('#live-clock').innerHTML=gridStandings(r).find(e=>e.id==='player').position+' / 4<small>Позиция в пелотоне</small>';}
  $('#weather').value=r.weather;$('#weather').disabled||=!!r.grid;$('#event-select').value=event.id;
  $('#weather').onchange=e=>{career.weather=e.target.value;save();render();};
  $('#event-select').onchange=e=>{if(!unlocked(getEvent(e.target.value),career))return;career.eventId=e.target.value;save();render();};
  if($('#grid-pit'))$('#grid-pit').onchange=e=>{if(!race||busy)return;race.grid.requestPit=e.target.checked;renderCards();};
  scene=new Scene($('#scene'),r,ghost,career.ghostEnabled,sound);scene.speed=fast?2:1;scene.follow=closeCamera;
  if(lastCameraEvent===event.id)scene.restoreView(lastCamera);
  const tools=$('.scene-tools');$('#scene').closest('.scene-wrap').after(tools);
  const cameraControls=()=>{
   closeCamera=scene.follow;const zoom=scene.cameraState?.zoom||1;
   $('#map-zoom').textContent=Math.round(zoom*100)+'%';$('#map-zoom-out').disabled=zoom<=ZOOM_STEPS[0];$('#map-zoom-in').disabled=zoom>=ZOOM_STEPS.at(-1);
   $('#camera-follow').textContent=closeCamera?'Слежение: вкл':'Слежение: выкл';$('#camera-follow').setAttribute('aria-pressed',String(closeCamera));
  };
  scene.onCameraChange=cameraControls;cameraControls();
  $('#map-zoom-in').onclick=()=>scene.zoomBy(1);$('#map-zoom-out').onclick=()=>scene.zoomBy(-1);
  $('#camera-toggle').onclick=()=>scene.showAll();$('#camera-focus').onclick=()=>scene.focusCar();
  $('#camera-follow').onclick=()=>{scene.follow=!scene.follow;if(scene.follow)scene.cameraState=null;cameraControls();};
  if($('#race-menu-toggle'))$('#race-menu-toggle').onclick=()=>{focusRace=!focusRace;updateRaceFocus();};
  scene.onPresentation=(frame,moving)=>{const node=$('#scene-tactic');if(node){node.hidden=!moving;node.textContent=[frame.actionName,frame.lineName,frame.cue].filter(Boolean).join(' · ');}};
  $('#sound-toggle').onclick=async()=>{await sound.setEnabled(!sound.enabled);const button=$('#sound-toggle');if(button){button.textContent=sound.enabled?'♫ Звук: вкл':'♫ Звук: выкл';button.setAttribute('aria-pressed',String(sound.enabled));}if(!sound.available)toast('Звук недоступен в этом браузере. Игра продолжается.');};
  $('#sound-volume').oninput=event=>sound.setVolume(Number(event.target.value));
  if($('#challenge-cancel'))$('#challenge-cancel').onclick=()=>{challengeIntent=null;render();};
  if($('#season-practice'))$('#season-practice').onclick=()=>{seasonIntent=false;career.raceIntent=null;save();render();};
  dashboardUpdate=bindDashboard($('.dashboard'),r.config,r.mode);
  const initial=readTelemetry(r.config,!race&&!isReplay?{...r.player,velocity:0}:r.player,r.mode);dashboardUpdate(initial);
  $('#speed').onclick=()=>{fast=!fast;scene.setSpeed(fast?2:1);$('#speed').textContent=(fast?'2×':'1×')+' Скорость';};
  $('#pause').onclick=()=>{paused=!paused;scene.setPaused(paused);$('#pause').textContent=paused?'▶ Продолжить':'Ⅱ Пауза';};
  if($('#ghost-toggle'))$('#ghost-toggle').onchange=e=>{career.ghostEnabled=e.target.checked;scene.showGhost=career.ghostEnabled;save();};
  if($('#start'))$('#start').onclick=startRace;
  if($('#restart'))$('#restart').onclick=confirmRestart;
  if($('#race-maintenance'))$('#race-maintenance').onclick=()=>{view='tuning';selectWorkspaceTab('tuning','maintenance');render();};
  if($('#race-career'))$('#race-career').onclick=()=>{view='world';selectWorkspaceTab('world','events');render();};
  if($('#beginner-help'))$('#beginner-help').onclick=help;
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
      const action=[...CARDS,...DRAG_CARDS,...DRIFT_CARDS,...SKILL_CARDS].find(card=>card.id===replayRecord.actions[index]);
      $('#scene-description').textContent=action.name+(replayRecord.lines?' / '+lineName(replayRecord.lines[index]):'')+' · '+sectorDescription(sectorAt(index,r.weather,event.id,r.routeVersion))+(replayRecord.manager?' · '+orderName(replayRecord.manager.log[index].effective):'')+(!replayRecord.telemetry?' · телеметрия старого повтора недоступна':'');
      document.querySelectorAll('.sector-node').forEach((node,i)=>{node.classList.toggle('current',i===index);node.classList.toggle('done',i<index);});
    };
    scene.onComplete=()=>{stopReplay();toast('Повтор завершён. Время и награды карьеры не изменились.');};
    scene.replay(replayRecord);
  }else{
    scene.onComplete=finishAnimation;
    scene.onTick=(elapsed,frame)=>{if(frame.from)dashboardUpdate(interpolateTelemetry(r.config,r.mode,readTelemetry(r.config,frame.from,r.mode),readTelemetry(r.config,frame.to,r.mode),frame.fraction,frame.to.drag));};
    if(r.finished){renderReport();$('#show-report').onclick=()=>$('#report').scrollIntoView({behavior:'smooth'});}
    else renderCards();
  }
}
function renderCards() {
  const current=previewRace(),r=current.grid?{...current,player:gridPlanningState(current)}:current,sector=sectorAt(r.index,r.weather,r.eventId,r.routeVersion),gap=r.opponent.dnf?Infinity:r.player.time-r.opponent.time;
  if(lineReason(selectedLine,sector))selectedLine='neutral';
  if(scene)scene.previewLine=selectedLine;
  $('#racing-plan').innerHTML=racingLinesHTML(r,selectedLine,busy);
  document.querySelectorAll('[data-map-sector]').forEach(button=>button.setAttribute('aria-pressed',String(scene?.previewSector===Number(button.dataset.mapSector))));
  document.querySelectorAll('[data-map-sector]').forEach(button=>button.onclick=()=>{if(busy)return;scene?.focusSector(Number(button.dataset.mapSector));$('#map-inspection').hidden=false;$('#map-inspection').textContent='На карте № '+(Number(button.dataset.mapSector)+1)+' · решение для № '+(r.index+1);document.querySelectorAll('[data-map-sector]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
  document.querySelectorAll('[data-line]').forEach(button=>button.onclick=()=>{if(busy)return;selectedLine=button.dataset.line;renderCards();localize(document);});
  const cards=schoolCards(r),categories=['Все',...new Set(cards.map(card=>card.category))];
  $('#deck-count').textContent=cards.filter(card=>!disabledReason(card,sector,r.player,r.config,gap)).length+' доступно / '+cards.length+' всего';
  if(!categories.includes(filter))filter='Все';
  $('#filters').innerHTML=categories.map(category=>`<button class="filter ${filter===category?'active':''}" data-filter="${category}">${category}</button>`).join('')+`<label class="available-toggle"><input id="only-available" type="checkbox" ${onlyAvailable?'checked':''}> Только доступные</label>`;
  $('#only-available').onchange=e=>{if(busy)return;onlyAvailable=e.target.checked;renderCards();};
  $('#filters').querySelectorAll('button').forEach(button=>button.onclick=()=>{if(busy)return;filter=button.dataset.filter;renderCards();});
  if(!cards.some(card=>card.id===selected&&!disabledReason(card,sector,r.player,r.config,gap)))selected=cards.find(card=>!disabledReason(card,sector,r.player,r.config,gap))?.id;
  const cardScroll=$('#cards').scrollTop;
  const categoryCards=cards.filter(card=>filter==='Все'||filter===card.category),blockedCards=categoryCards.map(card=>({card,reason:disabledReason(card,sector,r.player,r.config,gap)})).filter(c=>c.reason);
  $('#unavailable').innerHTML=onlyAvailable?unavailableHTML(blockedCards):'';
  if($('#unavailable details'))$('#unavailable details').ontoggle=()=>fitWorkspace(app);
  $('#cards').innerHTML=categoryCards.filter(card=>!onlyAvailable||!disabledReason(card,sector,r.player,r.config,gap)).map(card=>{
    const disabled=disabledReason(card,sector,r.player,r.config,gap),reason=disabled==='Нужен поворот'?'Сейчас прямая · нужен сектор-поворот':disabled;
    const metrics=cardComparison(r.config,r.player,sector,card,selectedLine,reason);
    return `<button class="card ${selected===card.id?'selected':''}" data-card="${card.id}" title="${escapeHTML(card.desc+(reason?' · '+reason:''))}" ${reason||busy?'disabled':''} aria-pressed="${selected===card.id}">
      <div class="card-top"><span class="card-icon">${card.icon}</span><span class="card-type">${card.category}</span></div><strong>${card.name}</strong><span class="en">${card.en}</span><p>${card.desc}</p>
      ${cardMetricsHTML(metrics)}${reason?`<span class="reason">${reason}</span>`:''}</button>`;
  }).join('');
  if(!$('#cards').children.length)$('#cards').innerHTML='<p class="deck-empty">В этой категории нет доступных приёмов. Выбери «Все» или покажи недоступные.</p>';
  $('#cards').scrollTop=cardScroll;
  $('#cards').querySelectorAll('button').forEach(button=>button.onclick=()=>{if(busy)return;selected=button.dataset.card;renderCards();});
  const card=cards.find(card=>card.id===selected),prediction=simulate(r.config,r.player,sector,lineCard(card,selectedLine));
  const forecast=qualitativeForecast(r.config,r.player,sector,card,prediction);if(r.school)forecast.wear='Отключён в школе';
  $('#forecast').innerHTML=`<div class="forecast"><div class="forecast-main"><span class="forecast-label">Текущий выбор</span><strong>${card.name} <span class="subtle">/ ${sector.label} · ${lineName(selectedLine)}</span></strong><span class="tactic-explanation">${card.desc}</span><span class="line-explanation">${RACING_LINES.find(line=>line.id===selectedLine)?.description||''}</span>
    <p>${forecast.habit} · ${forecast.execution}</p>${forecast.warning?`<p class="negative">${forecast.warning}</p>`:''}</div>
    <div class="forecast-values"><strong>${forecast.pace}</strong><br><span class="micro">НАГРУЗКА: ${forecast.load} · ИЗНОС: ${forecast.wear}<br>ФОКУС: ${Math.round(r.player.focus)} → ${Math.round(prediction.next.focus)} · ${forecast.focus}</span></div>
    <button id="execute" class="primary" ${!race||busy?'disabled':''}>3. Исполнить ${r.mode==='drift'?'клип':r.mode==='drag'?'фазу':'сектор'} ↗</button></div>
    <p class="forecast-note">До решения доступна качественная оценка. Оценка, фактическое время и причины станут известны после исполнения.</p>
    ${strainHTML(r.player,prediction.next.strain)}`;
  const last=r.history.at(-1),resultIndex=String(last?.index??'');if($('#last-result').dataset.resultIndex!==resultIndex){$('#last-result').innerHTML=sectorFeedbackHTML(last);$('#last-result').dataset.resultIndex=resultIndex;}
  $('#execute').onclick=execute;
  if($('#sector-details'))$('#sector-details').onclick=()=>openModal(sectorDetailsHTML(r.history.at(-1)));
  localize(document);fitWorkspace(app);
}
function setBusy(value) {
  $('#language-select').disabled=value;
  busy=value;
  document.querySelectorAll('[data-view]').forEach(button=>button.disabled=value);
  if(value)document.querySelectorAll('.card,.filter,.command-button,[data-line],[data-map-sector],#only-available,#execute,#abandon,#restart,#debug-unlock,#debug-reset').forEach(button=>button.disabled=true);
}
function startRace() {
  if(sound.enabled)void sound.unlock();
  if(schoolIntent===null&&!seasonIntent&&!unlocked(getEvent(career.eventId),career))return;
  const runId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  try{
    const blocked=schoolIntent===null?admissionReason(career,career.eventId):'';if(blocked)throw new Error(blocked);
    if(schoolIntent!==null){race=createLesson(career,schoolIntent,runId);}
    else if(challengeIntent){const start=bookChallenge(career,challengeIntent,runId);career=start.career;race=modernRoadRace(start.race);save();}
    else if(seasonIntent){const start=bookCupRace(career,runId);career=start.career;race=modernRoadRace(start.race);seasonIntent=false;save();}
    else{
      const nextRace=createRace(config(),career.weather,career.eventId,runId,null,career.rivalLevel);
      race=nextRace;save();
    }
    race.rewardScale=payoutScale(career,career.eventId);
    race.ghost=bestFor(career,race.config,race.eventId,race.weather);
    focusRace=true;raceStart=structuredClone(race);selectedLine='neutral';
    selected='balanced';filter='Все';render();toast('Старт! Выбирай карту для каждого участка.');
  }catch(error){toast(error.message);}
}
function execute() {
  if(sound.enabled)void sound.unlock();
  if(!race||busy||race.finished)return;
  try {
    const next=resolveLesson(race,selected,selectedLine);
    setBusy(true);paused=false;$('#pause').disabled=false;
    scene.animateSector(next,race.ghost);
    race=next;$('#execute').textContent='Исполнение…';
    $('#scene-status').textContent='ИСПОЛНЕНИЕ · '+String(race.index).padStart(2,'0');
  }catch(error){toast(error.message);}
}
function finishAnimation() {
  if(!busy)return;
  setBusy(false);paused=false;
  if(['drag','drift'].includes(race.mode))filter='Все';
  if(race.finished){
    const before=EVENTS.filter(event=>unlocked(event,career)).map(event=>event.id);
    const award=race.school?settleLesson(career,race):awardRace(career,race);career=award.career;race=award.race;save();
    const opened=EVENTS.filter(event=>unlocked(event,career)&&!before.includes(event.id));
    if(opened.length)toast('Открыто: '+opened.map(event=>event.title).join(', '));
  }
  render();
}
function confirmRestart(){
 if(busy||!race||race.finished||!raceStart)return;
 openModal('<h2>Начать гонку заново?</h2><p>Текущие решения и время сбросятся. Наград за прерванную попытку нет. Машина, погода, соперник и случайные условия останутся теми же. Этап кубка или вызов сохраняется.</p><div class="inline-actions"><button class="primary" id="confirm-restart">Начать заново</button><button class="secondary" data-close>Продолжить гонку</button></div>',()=>{
  $('#confirm-restart').onclick=()=>{if(busy||!race||race.finished)return;race=structuredClone(raceStart);selected='balanced';selectedLine='neutral';filter='Все';paused=false;$('#modal').close();render();};
 });
}
function confirmAbandon() {
  openModal('<h2>Покинуть заезд?</h2><p>Незавершённый заезд не принесёт наград. Текущий прогресс по секторам будет потерян.</p><div class="inline-actions"><button class="primary" id="confirm-abandon">Покинуть</button><button class="secondary" data-close>Продолжить гонку</button></div>',()=>{
    $('#confirm-abandon').onclick=()=>{$('#modal').close();race=null;render();};
  });
}
function playReplay(record) {
  if(busy||race&&!race.finished)return;
  if(sound.enabled)void sound.unlock();
  replayRecord=record;view='race';paused=false;setBusy(true);render();
}
function stopReplay() { replayRecord=null;paused=false;setBusy(false);render(); }
function damageHTML(r){
  return r.player.dnf?`<p class="negative"><strong>ВЫЛЕТ С ТРАССЫ · DNF</strong><br>Заезд остановлен. Повреждения: −${r.player.dnf.damage} п.п. состояния, с нижним пределом 35%. Состояние после заезда: ${Math.round(career.condition[r.config.car.id])}%. Награды и рекорда нет; требуется сервис.</p>`:r.opponent.dnf?'<p class="negative">Соперник сошёл после вылета с трассы.</p>':'';
}
function renderReport() {
  if(race.school){renderSchoolReport();return;}
  if(race.mode==='drift'){renderDriftReport();return;}
  const event=getEvent(race.eventId,race.routeVersion),outcome=race.outcome||raceOutcome(race),ghost=race.ghost;
  const previous=ghost?cumulativeTimes(ghost.sectorTimes):null;
  let elapsed=0;
  $('#report').innerHTML=`<section class="report"><div class="report-hero"><div><div class="eyebrow">${event.name.toUpperCase()} / ${race.isBest?'НОВЫЙ ЛИЧНЫЙ РЕКОРД':'РЕЗУЛЬТАТ'}</div>
    <h2>${outcome.label} · ${time(race.player.time)}</h2>${damageHTML(race)}<span class="micro">${weatherName(race.weather)} · ${race.config.car.name} · За рулём: ты</span>
    <p>+${money(outcome.reward)} · ${outcome.street?'Street Cred +'+outcome.street:'Official Rep +'+outcome.official} · Состояние машины ${Math.round(career.condition[race.config.car.id])}%${race.debtPaid?' · удержано за ремонт '+money(race.debtPaid):''}
    ${ghost&&race.history.length===event.sectors.length&&!race.player.dnf?'<br>К предыдущему рекорду: '+signed(race.player.time-ghost.time)+' с · состояние на старте '+race.config.condition.toFixed(0)+'% / в рекорде '+ghost.condition.toFixed(0)+'%':''}</p></div>
    ${race.mode==='drag'?'<div class="drag-result"><h3>Твоя дорожка</h3>'+dragMetrics(race.player.drag)+'<h3>Соперник</h3>'+dragMetrics(race.opponent.drag)+'</div>':''}<div class="report-actions">${cupNextButton()}<button id="retry" class="primary">Ещё один заезд ↗</button><button id="report-routes" class="secondary">К выбору заездов</button><button id="report-garage" class="secondary">В гараж</button><button id="replay-run" class="secondary">▶ Повтор заезда</button></div></div>
    ${raceSummaryHTML(summarizeRace(race,outcome,event,getLanguage()),escapeHTML)}${finishOverviewHTML(career,race)}<details class="report-progress"><summary>Прогресс и состояние машины</summary>${playerReportHTML(race.playerReport)}${challengeReportHTML(race.challengeReport)}${seasonReportHTML(race.seasonReport)}${journeyReportHTML(race.journeyReport,race.eventId)}${wearSummaryHTML(career,race)}</details><details class="report-details"><summary>Подробный разбор по участкам</summary>
    <div class="table-wrap"><table><thead><tr><th>Сектор / причина</th><th>Твоё решение</th><th>${race.mode!=='timeattack'?'Решение AI / план':'Медаль'}</th><th>Ты</th><th>Разрыв</th><th>К призраку</th><th>Ресурсы</th></tr></thead><tbody>
    ${race.history.map(row=>{elapsed+=row.playerTime;return `<tr><td>${row.index+1}. ${row.sector}<small>${row.reasons.join('. ')}</small></td><td>${row.card}${row.lineId?'<small>'+lineName(row.lineId)+'</small>':''}${row.command?'<small>'+orderName(row.command.requested)+' → '+orderName(row.command.effective)+'<br>'+row.command.reason+'</small>':''}</td>
      <td>${row.aiTime!==null||race.opponent.dnf?row.aiCard:outcome.label}${row.aiReasons?.some(reason=>reason.includes('ВЫЛЕТ'))?'<small class="negative">Соперник вылетел с трассы и сошёл</small>':''}${row.aiPlan.length?'<small>План: '+row.aiPlan.join(' → ')+'<br>Фактический следующий ход зависит от ситуации.</small>':''}</td>
      <td>${row.playerTime.toFixed(2)} с</td><td class="${row.gap<=0?'positive':'negative'}">${row.gap===null?'—':signed(row.gap)+' с'}</td>
      <td class="${previous&&elapsed<=previous[row.index]?'positive':'negative'}">${previous?signed(elapsed-previous[row.index])+' с':'—'}</td>
      <td class="micro">${Math.round(row.tires)}% Ш<br>${Math.round(row.heat)}°C<br>${Math.round(row.focus)} Ф</td></tr>`;}).join('')}
    </tbody></table></div></details></section>`;
  if(race.grid)$('#report').insertAdjacentHTML('afterbegin',gridPrizeHTML(race)+gridPanelHTML(race));
  bindReportActions();
}
function showRaceSelection(){
  if(busy)return;
  race=null;raceStart=null;schoolIntent=null;seasonIntent=false;career.raceIntent=null;challengeIntent=null;
  view='world';selectWorkspaceTab('world','events');save();render();
}
function prepareCupStage(){
  if(busy||race&&!race.finished)return;
  try{career=prepareStage(career);seasonIntent=true;schoolIntent=null;challengeIntent=null;race=null;replayRecord=null;raceStart=null;view='race';save();render();}catch(error){toast(error.message);}
}
function cupNextButton(){
  const state=career.championships.active,tag=race?.season;
  return tag&&state&&tag.cupId===state.cupId&&tag.attempt===state.attempt&&state.stage===tag.stage+1?'<button id="report-cup-next" class="primary">К следующей гонке чемпионата ↗</button>':'';
}
function bindReportActions(){
  $('#report-routes').onclick=showRaceSelection;
  if($('#report-cup-next'))$('#report-cup-next').onclick=prepareCupStage;
  $('#report-next').onclick=()=>{const next=$('#report-next').dataset.next;if(next==='maintenance')$('#report-maintenance').click();else if(next==='recovery'){race=null;view='garage';render();$('#recovery-service')?.scrollIntoView({block:'center'});}else if(next==='season'){race=null;view='seasons';render();}else $('#retry').click();};
  if($('#report-player'))$('#report-player').onclick=()=>{race=null;view='player';selectWorkspaceTab('player','skills');render();};
  if($('#return-rivals'))$('#return-rivals').onclick=()=>{race=null;challengeIntent=null;view='world';selectWorkspaceTab('world','rivals');render();};
  if($('#season-return'))$('#season-return').onclick=()=>{race=null;view='seasons';render();};
  $('#retry').className=$('#report-next').dataset.next==='retry'?'primary':'secondary';
  $('#retry').textContent=race.season||race.challenge?'Свободный заезд на этой трассе ↗':'Начать следующий заезд ↗';
  $('#retry').onclick=()=>{if(busy)return;race=null;seasonIntent=false;career.raceIntent=null;challengeIntent=null;startRace();};
  $('#report-maintenance').onclick=()=>{race=null;selectWorkspaceTab('tuning','maintenance');view='tuning';render();};
  $('#report-garage').onclick=()=>{race=null;view='garage';render();};
  const shortRun=race.history.length<getEvent(race.eventId,race.routeVersion).sectors.length;
  $('#replay-run').disabled=!!race.player.dnf||shortRun;
  if(race.player.dnf||shortRun)$('#replay-run').textContent=shortRun?'Повтор досрочного финиша недоступен':'Повтор схода недоступен';
  $('#replay-run').onclick=()=>playReplay(raceRecord(race));
}
function serviceHTML(locked){
 return `<section class="panel garage-service"><h2>${car().name} · кузов ${Math.round(career.condition[career.car])}%</h2><p>Ремонт кузова: ¥450 за 1 процентный пункт состояния. Полный сервис также восстанавливает установленные узлы; их ремонт входит в цену. Долг за аварийный ремонт: ${money(career.repairDebt||0)}; погашается из половины призовых.</p><div class="inline-actions"><button id="repair" class="secondary" ${locked||!repairCost()||career.money<repairCost()?'disabled':''}>Полный сервис · ${money(repairCost())}</button><button id="recovery-service" class="secondary" ${locked||!recoveryNeeded(career)?'disabled':''}>Кузов и основные узлы до 60%</button><button id="open-maintenance" class="secondary">Сервис отдельных узлов ↗</button><button id="open-tuning" class="primary">Тюнинг выбранной машины ↗</button></div></section>`;
}
function tradeInHTML(targetId,locked){
 if(career.ownedCars.includes(targetId)||CARS.find(c=>c.id===targetId)?.rewardOnly)return '';
 try{
  const q=tradeInQuote(career,targetId);
  return `<section class="trade-in-quote"><h3>Трейд-ин активной машины</h3><p>${car().name}: оценка кузова и основных узлов ${money(q.base)}${q.engineAdjustment?' · поправка за мотор '+money(q.engineAdjustment):''}. Детали: ${q.parts.length}. Коэффициент выкупа ${q.rate}.</p><p><strong>Зачёт ${money(q.credit)} · доплата ${money(q.due)}${q.cashback?' · возврат '+money(q.cashback):''}</strong></p><details><summary>Состав оценки</summary><ul>${q.parts.map(p=>`<li>${p.name}: ${Math.round(p.condition*100)}% · до коэффициента ${money(p.value)}</li>`).join('')||'<li>Без купленных деталей</li>'}</ul><p>В цену включены все детали этой машины, в том числе снятые. Складские моторы не продаются.</p></details><button id="trade-in" class="secondary" ${locked||!q.affordable?'disabled':''}>Обменять на ${CARS.find(c=>c.id===targetId).name} ↗</button></section>`;
 }catch(error){return `<p class="micro">Трейд-ин: ${escapeHTML(error.message)}</p>`;}
}
function renderGarage(){
 const locked=!!race&&!race.finished,shown=garageCarsByPrice(CARS.filter(c=>garageDrive==='all'||c.drive===garageDrive));
 const preview=shown.find(c=>c.id===garagePreview)||shown.find(c=>c.id===career.car)||shown[0];garagePreview=preview.id;const previewBuild=configuration(preview.id,career.pilot,career.builds[preview.id],career.condition[preview.id],career.setups[preview.id],installedEngineId(career,preview.id),career.wear[preview.id]);
 app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">GARAGE / 車庫</div><h1>Автопарк и обслуживание</h1></div><label>Показать <select id="garage-drive"><option value="all">Все приводы</option>${['FR','AWD','FF','MR'].map(d=>'<option value="'+d+'">'+d+'</option>').join('')}</select></label></div>
 ${locked?'<div class="notice">Заезд активен. Просмотр доступен; смена машины и сервис — после финиша или выхода.</div>':''}
 <div class="garage-workspace"><aside class="garage-catalog" aria-label="Список автомобилей"><div class="garage-price-sort">ЦЕНА <span>↑</span></div>${shown.map(c=>`<button class="garage-car-row ${preview.id===c.id?'selected':''}" data-garage-preview="${c.id}" aria-pressed="${preview.id===c.id}"><span class="mini-car">${garageArtworkHTML(c)}</span><span><strong>${c.name}</strong><small>${c.drive} · ${c.power} л.с. · ${career.car===c.id?'АКТИВНАЯ':career.ownedCars.includes(c.id)?'В ГАРАЖЕ':money(c.price)}</small></span></button>`).join('')}</aside>
 <section class="garage-detail"><div class="garage-car-detail panel"><div class="eyebrow">${preview.brand} / ${preview.year} · ${previewBuild.car.engine}</div><div class="vehicle-art">${garageArtworkHTML(preview)}</div><div class="section-title"><div><h2>${preview.name}</h2><span class="badge">${preview.tag}</span></div><button class="primary" data-car="${preview.id}" ${locked||career.car===preview.id||preview.rewardOnly&&!career.ownedCars.includes(preview.id)||!career.ownedCars.includes(preview.id)&&career.money<preview.price?'disabled':''}>${career.car===preview.id?'✓ Активная машина':career.ownedCars.includes(preview.id)?'Выбрать машину':preview.rewardOnly?'Приз за победу в Club Trophy':'Купить · '+money(preview.price)}</button></div><div class="specs"><div>${previewBuild.car.power}<small>Л.С.</small></div><div>${previewBuild.car.mass-(previewBuild.parts.includes('weight')?65:0)+(previewBuild.parts.includes('suspension')?8:0)}<small>КГ</small></div><div>${preview.drive}<small>ПРИВОД</small></div><div>${Math.round(career.condition[preview.id])}%<small>СОСТОЯНИЕ</small></div></div><p>${preview.description}</p>${tradeInHTML(preview.id,locked)}</div>
 <section class="garage-player-note panel"><strong>За рулём: ты</strong><p>За рулём всегда ты. Развивай навыки во вкладке «Игрок → Специализации», а обучение проходи в школе вождения.</p></section></section><aside class="garage-tools">${serviceHTML(locked)}<div class="panel"><h3>Просмотр и выбор</h3><p>Список слева открывает характеристики. Активная машина меняется только кнопкой выбора или покупки. Сервис относится к активной машине, указанной сверху.</p><p>Купленные детали и настройки хранятся отдельно для каждой машины.</p></div></aside></div>`;
 $('#garage-drive').value=garageDrive;$('#garage-drive').onchange=e=>{garageDrive=e.target.value;render();};
 document.querySelectorAll('[data-garage-preview]').forEach(button=>button.onclick=()=>{garagePreview=button.dataset.garagePreview;render();});
 document.querySelectorAll('[data-car]').forEach(button=>button.onclick=()=>garageAction(()=>selectCar(career,button.dataset.car,locked)));
 if($('#trade-in'))$('#trade-in').onclick=()=>{const quote=tradeInQuote(career,preview.id);openModal('<h2>Подтвердить трейд-ин?</h2><p>Будут переданы '+car().name+', установленный мотор и все купленные для этой машины детали. Запасные моторы на общем складе останутся. Пресеты проданной машины удалятся. Долг за ремонт сохраняется.</p><p>Зачёт '+money(quote.credit)+' · новая машина '+money(quote.price)+' · доплата '+money(quote.due)+(quote.cashback?' · возврат '+money(quote.cashback):'')+'</p><button class="primary" id="trade-in-confirm">Обменять машины</button><button class="secondary" data-close>Отмена</button>',()=>{$('#trade-in-confirm').onclick=()=>{try{const next=tradeInCar(career,preview.id,locked);$('#modal').close();garageAction(()=>next);}catch(error){toast(error.message);}};});};
 $('#repair').onclick=()=>garageAction(()=>serviceCar(career,locked));$('#recovery-service').onclick=()=>garageAction(()=>recoveryService(career,locked));$('#open-maintenance').onclick=()=>{selectWorkspaceTab('tuning','maintenance');view='tuning';render();};$('#open-tuning').onclick=()=>{view='tuning';render();};
}
function renderTuning(){
 const locked=!!race&&!race.finished,build=config();
 app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">WORKSHOP / セッティング</div><h1>Тюнинг и настройки</h1></div><label>Твоя машина <select id="tuning-car" ${locked?'disabled':''}>${CARS.filter(c=>career.ownedCars.includes(c.id)).map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label></div>
 ${locked?'<div class="notice">Идёт заезд. Изменения доступны после его завершения или выхода.</div>':''}
 <section class="panel"><h2>${car().name} · ${raceClass(build).name} · ${getEngine(installedEngineId(career)).name}</h2><div class="specs"><div>${build.car.power}<small>Л.С.</small></div><div>${build.car.mass-(build.parts.includes('weight')?65:0)+(build.parts.includes('suspension')?8:0)}<small>КГ</small></div><div>${transmissionProfile(build).final.toFixed(2)}<small>ГЛАВНАЯ ПАРА</small></div></div><p class="micro">${build.parts.length} деталей · ${build.setup.pressure} бар · пружины ${build.setup.springRate}% · тормозной баланс ${build.setup.brakeBias}% вперёд</p></section>
 ${benchHTML(career,trialBuild,locked)}${powertrainHTML(career,locked)}${maintenanceHTML(career,locked)}${workshopHTML(career,locked)}${setupControlsHTML(build,locked)}${presetsHTML(career,locked)}
 <nav class="tuning-nav" aria-label="Блоки тюнинга">${TUNING_GROUPS.map(group=>'<a href="#tuning-'+group.id+'">'+group.name+'</a>').join('')}</nav>${TUNING_GROUPS.map((group,index)=>`<section class="tuning-group" id="tuning-${group.id}" aria-labelledby="tuning-title-${group.id}"><header class="tuning-group-header"><div><span class="eyebrow">БЛОК ${String(index+1).padStart(2,'0')}</span><h3 id="tuning-title-${group.id}">${group.name}</h3><p>${group.description}</p></div><span class="badge">УСТАНОВЛЕНО ${group.parts.filter(id=>career.builds[career.car].includes(id)).length}</span></header><div class="parts-grid">${PARTS.filter(p=>group.parts.includes(p.id)).sort((a,b)=>a.price-b.price||a.name.localeCompare(b.name)).map(p=>{const owned=career.purchased[career.car].includes(p.id),equipped=career.builds[career.car].includes(p.id),blocked=partReason(career.car,p.id,installedEngineId(career))||partAccessReason(career,p.id);return `<article class="panel part"><div class="eyebrow">${p.type}</div><h3 style="margin-top:12px">${p.name}</h3><p>${p.desc}</p><span class="micro">${owned?'РЕСУРС '+career.wear[career.car][p.id].toFixed(1)+'%':money(p.price)}</span><button class="${equipped?'secondary':'primary'}" data-part="${p.id}" ${locked||blocked||!owned&&career.money<p.price?'disabled':''}>${blocked|| (equipped?'✓ Установлено · снять':owned?'Установить':'Купить и установить')}</button>${partComparisonHTML(career,p.id)}${p.slot?'<span class="micro">СЛОТ '+(SLOT_LABELS[p.slot]||p.slot)+' · при установке заменяет текущую деталь этого слота</span>':''}</article>`;}).join('')}</div></section>`).join('')}`;
 mountPowertrain(app,motorSelection);
 bindBench(locked);
 document.querySelectorAll('[data-engine-buy]').forEach(button=>button.onclick=()=>{const id=globalThis.crypto.randomUUID();motorSelection.spare=id;garageAction(()=>buyEngine(career,button.dataset.engineBuy,id,locked));});
 document.querySelectorAll('[data-engine-install]').forEach(button=>button.onclick=()=>garageAction(()=>installEngine(career,button.dataset.engineInstall,locked)));
 document.querySelectorAll('[data-engine-exchange]').forEach(button=>button.onclick=()=>garageAction(()=>exchangeEngines(career,button.dataset.engineExchange,locked)));
 document.querySelectorAll('[data-component-repair]').forEach(button=>button.onclick=()=>garageAction(()=>repairComponent(career,button.dataset.componentRepair,locked)));
 $('#tuning-car').value=career.car;$('#tuning-car').onchange=event=>garageAction(()=>selectCar(career,event.target.value,locked));
 document.querySelectorAll('[data-part]').forEach(button=>button.onclick=()=>garageAction(()=>togglePart(career,button.dataset.part,locked)));
 document.querySelectorAll('[data-setup]').forEach(input=>input.oninput=()=>{
  const field=SETUP_FIELDS.find(f=>f.key===input.dataset.setup);$('#setup-output-'+field.key).textContent=input.value+' '+field.unit;$('#setup-state').textContent='Есть несохранённые изменения';
 });
 $('#setup-save').onclick=()=>{const values=Object.fromEntries([...document.querySelectorAll('[data-setup]')].map(input=>[input.dataset.setup,Number(input.value)]));garageAction(()=>setCarSetup(career,values,locked));};
 document.querySelectorAll('[data-workshop-preset]').forEach(button=>button.onclick=()=>{
  const profile=WORKSHOP_PRESETS.find(p=>p.id===button.dataset.workshopPreset);
  if(garageAction(()=>applyWorkshopPreset(career,profile.id,locked)))toast(profile.name+': настройка выполнена · '+money(career.lastWorkshop.paidMoney)+' и −'+career.lastWorkshop.paidStreet+' Street Cred');
 });
 const openSetup=$('[data-workshop-open-setup]');if(openSetup)openSetup.onclick=()=>{selectWorkspaceTab('tuning','setup');render();};
 $('#setup-defaults').onclick=()=>garageAction(()=>setCarSetup(career,defaultSetup(),locked));
 $('#preset-save').onclick=()=>{const values=Object.fromEntries([...document.querySelectorAll('[data-setup]')].map(input=>[input.dataset.setup,Number(input.value)]));garageAction(()=>savePreset(setCarSetup(career,values,locked),$('#preset-name').value,locked));};
 document.querySelectorAll('[data-preset-apply]').forEach(button=>button.onclick=()=>garageAction(()=>applyPreset(career,Number(button.dataset.presetApply),locked)));
 document.querySelectorAll('[data-preset-delete]').forEach(button=>button.onclick=()=>garageAction(()=>deletePreset(career,Number(button.dataset.presetDelete),locked)));
}
function garageAction(action) {
  try{career=action();race=null;selected='balanced';save();render();return true;}catch(error){toast(error.message);return false;}
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
function renderPlayer(){
 const locked=!!race&&!race.finished;app.innerHTML='<div class="page-heading"><h1>Игрок · обучение и специализации</h1></div>'+schoolHomeHTML(career,locked)+playerHTML(career,locked);
 document.querySelectorAll('[data-player-train]').forEach(button=>button.onclick=()=>playerAction(()=>trainPlayer(career,button.dataset.playerTrain,locked)));
 document.querySelectorAll('[data-player-active]').forEach(button=>button.onclick=()=>playerAction(()=>togglePlayerSkill(career,button.dataset.playerActive,locked)));
 $('#player-reset').onclick=()=>playerAction(()=>resetPlayer(career,locked));
}
function renderSchoolReport(){
 $('#report').innerHTML=schoolReportHTML(race,career.school);
 $('#school-retry').onclick=()=>{schoolIntent=race.school.step;race=null;startRace();};
 if($('#school-next'))$('#school-next').onclick=()=>{schoolIntent=career.school.step;race=null;render();};
 $('#school-home').onclick=()=>{race=null;schoolIntent=null;view='player';selectWorkspaceTab('player','school');render();};
 $('#school-routes').onclick=showRaceSelection;
 $('#school-free').onclick=()=>{race=null;schoolIntent=null;render();};
}
function renderWorld() {
  const currentBest=bestFor(career,config(),career.eventId,career.weather);
  app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">CLUB SEASON / 次の一歩</div><h1>Две сцены. Одно имя.</h1></div><label>Дисциплина <select id="world-discipline" ${race&&!race.finished?'disabled':''}>${DISCIPLINES.map(d=>`<option value="${d.id}" ${d.id===disciplineOf(getEvent(career.eventId))?'selected':''}>${d.name}</option>`).join('')}</select></label></div>
    <div class="career-stats"><div class="panel"><div class="eyebrow">Street Credibility</div><div class="big-number">${career.street}</div><span class="micro">УЛИЧНАЯ РЕПУТАЦИЯ · ДОПУСК И ТЮНИНГ</span></div>
    <div class="panel"><div class="eyebrow">Official Reputation</div><div class="big-number">${career.official}</div><span class="micro">ОФИЦИАЛЬНАЯ РЕПУТАЦИЯ · ДОПУСК И ТЮНИНГ</span></div>
    <div class="panel"><div class="eyebrow">Победы в дуэлях / Заезды</div><div class="big-number">${career.wins}<span style="font-size:20px;color:var(--muted)"> / ${career.races}</span></div><span class="micro">ВСЕ ЗАВЕРШЁННЫЕ СЕССИИ</span></div>
    <div class="panel"><div class="eyebrow">Рекорд выбранной сборки</div><div class="big-number">${currentBest?currentBest.drift?score(currentBest.drift.score)+' Б':time(currentBest.time):'—'}</div><span class="micro">${getEvent(career.eventId).title} / ${weatherName(career.weather)}</span></div></div>
    ${journeyHTML(career)}<p class="micro">Указаны призовые до ремонта. Повторные выплаты на одном маршруте постепенно снижаются до 50%; разовые отметки и карьерные премии начисляются отдельно.</p><div class="event-grid">${EVENTS.filter(event=>disciplineOf(event)===disciplineOf(getEvent(career.eventId))).map((event,index)=>{
      event=getEvent(event.id,3);const open=unlocked(event,career);
      return `<article class="event-card ${open?'':'locked'}"><div class="event-card-head"><span class="eyebrow">${event.region} / ${event.mode==='drift'?'DRIFT / JUDGED RUN':event.mode==='drag'?(event.id==='yokohama-mile'?'DRAG / 1 MILE':event.longDrag?'DRAG / 804 M':'DRAG / 402 M'):event.grid?'CIRCUIT / CLUB TROPHY':event.mode==='duel'?'TOUGE DUEL':'OFFICIAL TIME ATTACK'}</span><span class="event-num">${String(index+1).padStart(2,'0')}</span></div>
        <div class="route-art">${routeMap(event)}</div><h2>${event.title}</h2><p>${event.description}</p><div class="micro">${event.sectors.length} СЕКТОРОВ · ${(eventLength(event)/1000).toFixed(2)} КМ · БЕЗ ВЗНОСА<br>ДО ${money(event.prize*(event.grid?1:rewardFactor(config(),event.mode))*payoutScale(career,event.id)*(!event.grid&&['duel','drag'].includes(event.mode)?1.35:1))} / УЧАСТИЕ ${money(event.participation*(event.grid?1:rewardFactor(config(),event.mode))*payoutScale(career,event.id))}</div>
        ${event.grid?'<div class="event-rival">Пелотон: ты и три соперника</div>':['duel','drag'].includes(event.mode)?'<div class="event-rival">Свободный заезд: выбор из трёх соперников</div>':'<div class="event-rival">Медали: золото / серебро / бронза</div>'}
        ${routeMasteryHTML(career,event)}<button class="${open?'primary':'secondary'} wide" data-event="${event.id}" ${!open||race&&!race.finished?'disabled':''}>${open?'Выбрать маршрут ↗':'Откроется: '+unlockText(event)}</button></article>`;
    }).join('')}</div>
    ${race&&!race.finished?'<div class="notice" style="margin-top:15px">Сначала заверши текущую сессию или выйди из неё на экране заезда.</div>':''}
    ${rivalsHTML(career,!!race&&!race.finished)}<div class="section-title"><div><div class="eyebrow">ТВОИ ОРИЕНТИРЫ</div><h2>Рекорды и сохранённые повторы</h2></div></div>
    <div class="notice">Рекорды разделены по трассе, погоде, машине, пилоту и деталям. Состояние машины указано отдельно: износ может изменить результат той же сборки. Старые заезды v0.1 остаются в истории, но без выдуманного повтора.</div>
    ${career.bests.length?`<div class="table-wrap"><table><thead><tr><th>Событие</th><th>Погода</th><th>Машина / детали</th><th>Стартовое состояние</th><th>Результат</th><th>Повтор</th></tr></thead><tbody>${career.bests.map((best,index)=>`<tr><td>${getEvent(best.eventId).title}${(['2','3','4','drag-1','drift-1'].includes(best.key.split('|')[0])||best.rivalLevel==='easy'&&getEvent(best.eventId).mode==='duel'&&!best.key.endsWith(';opponent=learning-1'))?'<small>Архив прежней модели</small>':''}</td><td>${weatherName(best.weather)}</td><td>${CARS.find(car=>car.id===best.carId).name}<small>${best.parts.map(id=>PARTS.find(part=>part.id===id).name).join(', ')||'Сток'}</small>${best.setup?'<small>'+best.setup.pressure+' бар · пара ×'+best.setup.finalDrive+' · пружины '+best.setup.springRate+'% · баланс '+best.setup.brakeBias+'%</small>':''}</td><td>${Math.round(best.condition)}%</td><td class="positive">${best.drift?score(best.drift.score)+' Б':time(best.time)}</td><td><button class="secondary" data-replay="${index}" ${race&&!race.finished?'disabled':''}>▶ Смотреть</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Первый финиш сохранит твой ориентир и повтор.</div>'}
    <h2 style="margin-top:30px">История заездов</h2>${career.records.length?`<div class="table-wrap"><table><thead><tr><th>Событие / условия</th><th>Машина</th><th>Баллы / время</th><th>Результат</th></tr></thead><tbody>${career.records.map(record=>`<tr><td>${getEvent(record.eventId).title}<small>${weatherName(record.weather)}</small></td><td>${record.car}</td><td>${getEvent(record.eventId).mode==='drift'?score(record.score)+' Б':time(record.time)}</td><td>${record.dnf?'Сход · вылет с трассы':record.medal?{gold:'Золото',silver:'Серебро',bronze:'Бронза'}[record.medal]:['timeattack','drift'].includes(getEvent(record.eventId).mode)?'Сессия завершена':record.falseStart?'Фальстарт':record.won?'Победа':'Без победы'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Ночь ещё только начинается.</div>'}
    <div class="section-title"><span class="micro">АВТОСОХРАНЕНИЕ В АКТИВНЫЙ СЛОТ · ФАЙЛ ДЛЯ ПЕРЕНОСА В «СОХРАНЕНИЯХ»</span><button id="reset" class="secondary">Новая карьера</button></div>`;
  document.querySelectorAll('[data-challenge]').forEach(button=>button.onclick=()=>{if(busy||race&&!race.finished)return;const id=button.dataset.challenge;if(challengeReason(career,id))return;const c=getChallenge(id);challengeIntent=id;seasonIntent=false;career.raceIntent=null;career.eventId=c.eventId;career.weather=c.weather;race=null;view='race';save();render();});
  $('#world-discipline').onchange=e=>{const next=EVENTS.find(item=>disciplineOf(item)===e.target.value&&unlocked(item,career))||EVENTS.find(item=>disciplineOf(item)===e.target.value);if(race&&!race.finished)return;career.eventId=next.id;save();render();};
  document.querySelectorAll('[data-event]').forEach(button=>button.onclick=()=>{
    const event=getEvent(button.dataset.event);if(!unlocked(event,career)||race&&!race.finished)return;
    career.eventId=event.id;race=null;seasonIntent=false;career.raceIntent=null;challengeIntent=null;view='race';save();render();
  });
  document.querySelectorAll('[data-replay]').forEach(button=>button.onclick=()=>playReplay(career.bests[Number(button.dataset.replay)]));
  $('#reset').textContent='Управление карьерами';$('#reset').onclick=openSaves;
}
function renderSeasons(){
 const locked=!!race&&!race.finished;app.innerHTML=championshipHTML(career,config(),locked)+specialCupsHTML(career,config(),locked)+organizerHTML(career,seriesDraft,seriesEditingId,locked);
 bindOrganizer(locked);
 document.querySelectorAll('[data-special-enter]').forEach(button=>button.onclick=()=>garageAction(()=>enterCup(career,button.dataset.specialEnter,globalThis.crypto.randomUUID(),locked)));
 document.querySelectorAll('[data-cup-enter]').forEach(button=>button.onclick=()=>garageAction(()=>enterCup(career,button.dataset.cupEnter,globalThis.crypto.randomUUID(),locked)));
 if($('#season-prepare'))$('#season-prepare').onclick=prepareCupStage;
 if($('#season-withdraw'))$('#season-withdraw').onclick=()=>openModal('<h2>Покинуть кубок?</h2><p>Очки текущего сезона будут потеряны. Вступительный взнос не возвращается.</p><button id="confirm-withdraw" class="primary">Покинуть кубок</button><button class="secondary" data-close>Продолжить</button>',()=>{$('#confirm-withdraw').onclick=()=>{try{career=withdrawCup(career,locked);seasonIntent=false;career.raceIntent=null;save();$('#modal').close();render();}catch(error){toast(error.message);}};});
}
function readSeriesDraft(){
 return {name:$('#series-name').value,kind:$('#series-kind').value,maxPower:Number($('#series-power').value),pool:Number($('#series-pool').value),naOnly:$('#series-na').checked,drives:[...document.querySelectorAll('[data-series-drive]:checked')].map(e=>e.dataset.seriesDrive),stages:[...document.querySelectorAll('[data-series-event]')].map((e,i)=>[e.value,$('[data-series-weather="'+i+'"]').value])};
}
function bindOrganizer(locked){
 const id=()=> 'custom-'+globalThis.crypto.randomUUID();
 document.querySelectorAll('[data-series-discipline]').forEach(select=>select.onchange=()=>{seriesDraft=readSeriesDraft();seriesDraft.stages[Number(select.dataset.seriesDiscipline)][0]=EVENTS.find(e=>e.mode===select.value).id;render();});
 document.querySelectorAll('.organizer-panel input,.organizer-panel select').forEach(input=>input.oninput=()=>{seriesDraft=readSeriesDraft();$('#series-quote').innerHTML=seriesQuoteHTML(career,seriesDraft);});
 $('#series-new').onclick=()=>{seriesDraft=defaultSeries();seriesEditingId=null;render();};
 $('#series-add-stage').onclick=()=>{seriesDraft=readSeriesDraft();if(seriesDraft.stages.length<6)seriesDraft.stages.push(['haruna','dry']);render();};
 document.querySelectorAll('[data-series-remove]').forEach(button=>button.onclick=()=>{seriesDraft=readSeriesDraft();if(seriesDraft.stages.length>2)seriesDraft.stages.splice(Number(button.dataset.seriesRemove),1);render();});
 document.querySelectorAll('[data-series-up]').forEach(button=>button.onclick=()=>{seriesDraft=readSeriesDraft();const i=Number(button.dataset.seriesUp);if(i>0)[seriesDraft.stages[i-1],seriesDraft.stages[i]]=[seriesDraft.stages[i],seriesDraft.stages[i-1]];render();});
 $('#series-save').onclick=()=>{seriesDraft=readSeriesDraft();const key=seriesEditingId||id();if(teamAction(()=>saveSeries(career,seriesDraft,key,locked))){seriesEditingId=key;render();toast('Проект сохранён. Взнос списывается только при запуске.');}};
 document.querySelectorAll('[data-series-edit]').forEach(button=>button.onclick=()=>{seriesEditingId=button.dataset.seriesEdit;seriesDraft=structuredClone(career.organizer.series.find(s=>s.id===seriesEditingId));render();$('.organizer-panel').scrollIntoView({behavior:'smooth'});});
 document.querySelectorAll('[data-series-delete]').forEach(button=>button.onclick=()=>{if(teamAction(()=>deleteSeries(career,button.dataset.seriesDelete,locked))&&seriesEditingId===button.dataset.seriesDelete){seriesDraft=defaultSeries();seriesEditingId=null;render();}});
 document.querySelectorAll('[data-series-enter]').forEach(button=>button.onclick=()=>garageAction(()=>enterCup(career,button.dataset.seriesEnter,globalThis.crypto.randomUUID(),locked)));
 document.querySelectorAll('[data-series-export]').forEach(button=>button.onclick=()=>{const json=exportSeries(career.organizer.series.find(s=>s.id===button.dataset.seriesExport));openModal('<h2>JSON серии</h2><p>Скопируй текст и передай другому игроку. Передаются правила и календарь.</p><textarea id="series-json" readonly aria-label="JSON серии"></textarea><button class="secondary" data-close>Закрыть</button>',()=>{$('#series-json').value=json;$('#series-json').select();});});
 $('#series-import').onclick=()=>openModal('<h2>Импорт серии</h2><p>Вставь JSON проекта Tokyo Streets. Чужой прогресс и деньги не импортируются.</p><textarea id="series-json" maxlength="16000" aria-label="JSON серии"></textarea><p id="series-import-error" role="alert"></p><button id="series-import-confirm" class="primary">Импортировать проект</button><button class="secondary" data-close>Отмена</button>',()=>{$('#series-import-confirm').onclick=()=>{try{const next=importSeries(career,$('#series-json').value,id(),locked);career=next;save();$('#modal').close();render();toast('Проект импортирован.');}catch(error){$('#series-import-error').textContent=error.message;}};});
}
function openModal(html,setup) {
  $('#modal-content').innerHTML=html;
  $('#modal-content').querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$('#modal').close());
  setup?.();localize($('#modal-content'));$('#modal').showModal();
}
function help() {
  openModal(`<div class="eyebrow">TOKYO STREETS / PUBLIC ALPHA 0.31.1</div><h2>Найди свою линию.</h2><p>Следующая цель карьеры видна над игровым экраном. Осваивай трассы, получай разовые премии, открывай тюнинг репутацией и выйди на подиум Japan Masters. Полный путь — «Карьера → Путь гонщика».</p><ol>
    <li><strong>Гараж.</strong> Выбери машину и проведи сервис. За рулём всегда ты. В «Тюнинг → Детали и установка» покупай и устанавливай детали. В «Настройка машины» меняй регулировки, покупай настройку под режим и работай с пресетами. Регулировки коробки, подвески и антикрыла требуют соответствующих деталей; настройки у каждой машины свои.</li>
    <li><strong>Событие.</strong> Харуна доступна сразу. Для Акаги нужно 12 очков уличной репутации (Street Cred). После двух завершённых сессий открывается клубный Time Attack в Цукубе.</li>
    <li><strong>Тактика.</strong> Базовые приёмы доступны без случайной раздачи; оборудование и специализации добавляют новые карты. Повтор приёма в последних шести решениях увеличивает расход фокуса или уменьшает его восстановление. Прямого штрафа времени, нагрева и износа за повтор нет. В тогу и Time Attack износ зависит от километража и нагрузки; повтор бережного приёма не умножает расход шин. Один промежуточный ход не сбрасывает штраф. Разнообразные действия постепенно выводят его из памяти. Базовый «Чистый темп» всегда остаётся без штрафа. У недоступных приёмов указана причина блокировки. Читай разведку маршрута, прогноз, шины, тормоза и фокус. Тормоза охлаждаются обдувом: на длинной быстрой прямой сильнее, чем в повороте. Их температура — условный игровой показатель, порог потери эффективности 105°C.</li>
    <li><strong>Исполнение.</strong> После участка машины ждут следующего решения; разрыв сохраняется по времени на отсечках. Чем меньше текущий фокус, тем шире случайный разброс результата. Он действует на тебя и соперника. Восстановление фокуса стабилизирует следующие действия. Прогноз показывает характер эффекта и риски без точного времени. Случайное отклонение учитывается при исполнении. Крайняя ошибка может привести к вылету и сходу с повреждением машины; при низком фокусе и опасном манёвре риск выше. За свой сход нет награды, рекорда и зачётного финиша.</li>
    <li><strong>Ресурсы.</strong> Разные атакующие карты накапливают общую нагрузку. Скорость выхода влияет на следующий сектор. Соперники зависят от класса сборки; выплаты снижаются при повторении события до 50%. Для старта нужно 45% состояния в дуэли и 55% в официальных дисциплинах. Аварийный ремонт до 60% доступен в счёт будущих призовых.</li><li><strong>Дуэль.</strong> Соперник планирует на три сектора по тем же правилам. Защита доступна при лидерстве менее 2,5 с, слипстрим — при отставании менее 2,5 с на прямой.</li>
    <li><strong>Time Attack.</strong> Соперника нет; карты дуэли недоступны. Пороги медалей видны до старта. Завершённая сессия приносит официальную репутацию (Official Rep).</li>
    <li><strong>Свапы и ресурс.</strong> В тюнинге есть «Моторы / свапы» и «Сервис узлов». Двигатели обмениваются вместе с моторными деталями и износом. Ресурс шин, тормозов и мотора сохраняется между заездами; переустановка детали не заменяет ремонт. Каждый узел оплачивается отдельно; износ шин повторно не списывается через общее состояние. Масло и вода при перегреве снижают мощность мотора, охлаждение помогает сохранять темп.</li><li><strong>Дрэг.</strong> После трёх финишей откроется 402 м, после четырёх — 804 м, после пяти — стоячая миля. На длинной дистанции есть выбор главной пары и давления перед стартом, затем управление высшей передачей, рабочим диапазоном и тепловой нагрузкой. Прогрев не входит во время. Выбирай старт, режим переключений и финиш. Победу определяет реакция + ET; фальстарт проигрывает даже с лучшим ET.</li><li><strong>Дрифт.</strong> Сначала выбери дисциплину, затем трассу. Уличные дороги доступны и для тогу, и для дрифта. Эбису открывается при 20 Street Cred, Мэйхан — при 32; в дрифте две связки по четыре клипа. Клип — судейская зона трассы. Важны линия, заданный угол, скорость и непрерывность связки, а не минимальное время. Стабилизация доступна всегда, но обрывает связку.</li><li><strong>Мастерская.</strong> Детали открываются по лучшей достигнутой Street или Official репутации. Готовые настройки под сухую трассу, дождь, дрэг и дрифт применяются за деньги и текущую Street Cred с качеством 85–100% от целевого пресета. Ручные настройки бесплатны; уже купленные детали доступны всегда.</li><li><strong>Повтор.</strong> Лучший заезд сохраняет решения и время секторов. В следующем заезде с той же сборкой можно включить призрак или посмотреть полный повтор.</li>
    <li><strong>Кольцевая гонка.</strong> Club Trophy открывается при 120 Official Rep и 12 финишах. Три круга Цукубы, старт с четвёртого места и три фиксированных соперника. Замена шин перед вторым или третьим кругом занимает 25 секунд; стоимость комплекта списывается после гонки. При нехватке денег остаток попадает в долг за сервис. Первая победа выдаёт GR Supra GT4 в гараж.</li></ol><p><a href="https://github.com/AlexSapronov/Tokyo_Streets/issues/new" target="_blank" rel="noopener noreferrer">Сообщить об ошибке</a> · Укажи версию 0.31.1, трассу и шаги для повторения.</p><p class="micro">ОЦЕНКА РИСКА ПОКАЗЫВАЕТ НАГРУЗКУ НА МАШИНУ, А НЕ ТОЧНУЮ ВЕРОЯТНОСТЬ ОШИБКИ. КАРЬЕРА СОХРАНЯЕТСЯ В БРАУЗЕРЕ. НЕЗАВЕРШЁННЫЙ ЗАЕЗД ПРИ ПЕРЕЗАГРУЗКЕ СБРАСЫВАЕТСЯ. ПОВТОРЫ НЕ ПРИНОСЯТ НАГРАД.</p><button class="primary" data-close>На дорогу ↗</button>`);
}
function welcome(){
 openModal(welcomeHTML(),()=>{
  const complete=quick=>{if(quick){seasonIntent=false;career.raceIntent=null;challengeIntent=null;schoolIntent=Math.min(3,career.school.step);view='race';}career.helpSeen=true;save();$('#modal').close();render();};
  $('#welcome-drive').onclick=()=>complete(true);$('#welcome-continue').onclick=()=>complete(false);
 });
}
$('#language-select').value=getLanguage();
$('#language-select').onchange=event=>{if(busy)return;setLanguage(event.target.value);render();};
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
  if(busy)return;view=button.dataset.view;render();window.scrollTo?.(0,0);
});
$('#help').onclick=help;
$('#saves').onclick=openSaves;
$('.logo').onclick=event=>{event.preventDefault();if(!busy){view='race';render();}};
window.addEventListener('resize',()=>fitWorkspace(app));
window.addEventListener('beforeunload',event=>{if(busy||race&&!race.finished||saveState!=='ok'){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{
  if(event.code==='Space'&&busy&&!$('#modal').open&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){
    event.preventDefault();$('#pause')?.click();
  }
});
render();if(!career.helpSeen&&initialSave.status!=='error')welcome();

function driftMedals(event){
 return `<div class="medal-targets"><span>● Золото <strong>${event.medals.gold} Б</strong></span><span>● Серебро <strong>${event.medals.silver} Б</strong></span><span>● Бронза <strong>${event.medals.bronze} Б</strong></span></div>`;
}

function driftMetrics(drift){
  const clip=drift.clips.at(-1);
  return `<div class="drift-metrics"><span>Последний клип<strong>${clip?score(clip.points)+' Б':'—'}</strong></span>
    <span>Связка / максимум<strong>${drift.combo} / ${drift.peakCombo}</strong></span><span>Чистые связки<strong>${drift.completedChains} / 2</strong></span>
    <span>Разрывы / развороты<strong>${drift.breaks} / ${drift.spins}</strong></span><span>Температура шин<strong>${Math.round(drift.temperature)}°C</strong></span></div>`;
}
function renderDriftReport(){
  const event=getEvent(race.eventId,race.routeVersion),d= race.player.drift,outcome=race.outcome||raceOutcome(race),ghost=race.ghost;
  $('#report').innerHTML=`<section class="report"><div class="report-hero"><div><div class="eyebrow">${event.name.toUpperCase()} / ${race.isBest?'НОВЫЙ РЕКОРД ПО БАЛЛАМ':'СУДЕЙСКИЙ ПРОТОКОЛ'}</div>
    <h2>${outcome.label} · ${score(d.score)} / 800</h2><p>+${money(outcome.reward)} · Official Rep +${outcome.official}${race.debtPaid?' · удержано за ремонт '+money(race.debtPaid):''} · ${weatherName(race.weather)}
    ${ghost&&race.history.length===event.sectors.length&&!race.player.dnf?'<br>К прошлому рекорду: '+signed(d.score-ghost.drift.score)+' баллов':''}</p>${damageHTML(race)}<span class="micro">ЛИНИЯ 35% · УГОЛ 25% · СКОРОСТЬ 20% · СВЯЗНОСТЬ 20%<br>ВРЕМЯ ${time(race.player.time)} — ДЛЯ ПОВТОРА; ОЦЕНКА ОПРЕДЕЛЯЕТ РЕЗУЛЬТАТ</span></div>
    <div class="drag-result">${driftMetrics(d)}</div><div class="report-actions">${cupNextButton()}<button id="retry" class="primary">Ещё один заезд ↗</button><button id="report-routes" class="secondary">К выбору заездов</button><button id="report-garage" class="secondary">В гараж</button><button id="replay-run" class="secondary">▶ Повтор заезда</button></div></div>
    ${raceSummaryHTML(summarizeRace(race,outcome,event,getLanguage()),escapeHTML)}${finishOverviewHTML(career,race)}<details class="report-progress"><summary>Прогресс и состояние машины</summary>${playerReportHTML(race.playerReport)}${challengeReportHTML(race.challengeReport)}${seasonReportHTML(race.seasonReport)}${journeyReportHTML(race.journeyReport,race.eventId)}${wearSummaryHTML(career,race)}</details><details class="report-details"><summary>Подробный разбор по участкам</summary>
    <div class="table-wrap"><table><thead><tr><th>Клип / разбор</th><th>Приём</th><th>Линия</th><th>Угол</th><th>Скорость</th><th>Связность</th><th>Штраф</th><th>Баллы / к рекорду</th></tr></thead><tbody>
    ${race.history.map(row=>{const clip=row.drift,previous=ghost?.drift.clips[row.index];return `<tr><td>${row.index+1}. ${row.sector}<small>${row.reasons.join('. ')}</small></td><td>${row.card}${row.lineId?'<small>'+lineName(row.lineId)+'</small>':''}${row.command?'<small>'+orderName(row.command.requested)+' → '+orderName(row.command.effective)+'<br>'+row.command.reason+'</small>':''}</td>
      <td>${score(clip.line)}</td><td>${score(clip.angle)}<small>${score(clip.angleDegrees)}° / задание ${event.sectors[row.index].targetAngle}°</small></td>
      <td>${score(clip.speed)}<small>${Math.round(clip.velocity)} км/ч</small></td><td>${score(clip.continuity)}</td><td>${score(clip.penalty)}</td>
      <td class="${clip.valid?'positive':'negative'}">${score(clip.points)} Б${previous?'<small>'+signed(clip.points-previous.points)+' Б</small>':''}</td></tr>`;}).join('')}
    </tbody></table></div></details></section>`;
  bindReportActions();
}

function teamAction(action){
  try{career=action();race=null;save();render();return true;}catch(error){toast(error.message);return false;}
}

function bindBench(locked){
 if(locked||!$('#bench-event'))return;
 trialBuild=normalizeBenchDraft(career,trialBuild||benchDraft(career));
 const refresh=()=>{selectWorkspaceTab('tuning','bench');render();};
 $('#bench-event').onchange=e=>{trialBuild.eventId=e.target.value;refresh();};
 $('#bench-weather').onchange=e=>{trialBuild.weather=e.target.value;refresh();};
 $('#bench-engine').onchange=e=>{trialBuild.engineId=e.target.value;trialBuild=normalizeBenchDraft(career,trialBuild);refresh();};
 $('#bench-reset').onclick=()=>{trialBuild=benchDraft(career);refresh();};
 document.querySelectorAll('[data-bench-part]').forEach(input=>input.onchange=()=>{trialBuild=benchPart(career,trialBuild,input.dataset.benchPart,input.checked);refresh();});
 document.querySelectorAll('[data-bench-setup]').forEach(input=>input.onchange=()=>{trialBuild.setup[input.dataset.benchSetup]=Number(input.value);trialBuild=normalizeBenchDraft(career,trialBuild);refresh();});
}

function playerAction(action){try{career=action();race=null;view='player';save();selectWorkspaceTab('player','skills');render();}catch(error){toast(error.message);}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){sound.stop();if(busy&&!paused&&scene){paused=true;scene.setPaused(true);if($('#pause'))$('#pause').textContent='▶ Продолжить';}}});
window.addEventListener('pagehide',()=>sound.dispose());

function openSaves(){
 const locked=busy||!!race&&!race.finished||!!replayRecord;
 openModal(savesHTML(slotList(storage),sessionSlot,locked),()=>{
  const fail=error=>{const node=$('#save-error');if(node)node.textContent=error.message;else toast(error.message);};
  const guarded=action=>{try{if(busy||race&&!race.finished||replayRecord)throw Error('Сначала заверши текущую сессию');action();}catch(error){fail(error);}};
  const select=id=>{career=activateSlot(storage,id);sessionSlot=id;expectedRaw=storage.getItem(slotKey(id));schoolIntent=null;saveState='ok';unreadableSlot=false;stopDebugRun();seasonIntent=!!career.raceIntent;if(seasonIntent)career=prepareStage(career);raceStart=null;trialBuild=null;motorSelection={};view='race';$('#modal').close();render();if(!career.helpSeen)welcome();};
  const confirm=(id,title,description,action)=>openModal(`<h2>${title}</h2><p>${description} Слот ${id}. Другие слоты сохранятся.</p><div class="inline-actions"><button id="slot-confirm" class="primary">Подтвердить</button><button class="secondary" data-close>Отмена</button></div>`,()=>{$('#slot-confirm').onclick=()=>guarded(()=>{action();if(id===sessionSlot)select(id);else openSaves();});});
  document.querySelectorAll('[data-slot-rename]').forEach(button=>button.onclick=()=>guarded(()=>{renameSlot(storage,Number(button.dataset.slotRename),$('[data-slot-name="'+button.dataset.slotRename+'"]').value);openSaves();}));
  document.querySelectorAll('[data-slot-load]').forEach(button=>button.onclick=()=>guarded(()=>{
   const id=Number(button.dataset.slotLoad);openModal('<h2>Переключить карьеру?</h2><p>Откроется выбранный слот. Текущий прогресс остаётся в своём слоте. Если автосохранение недоступно, сначала скачай текущую карьеру.</p><button id="slot-confirm" class="primary">Загрузить слот '+id+'</button><button class="secondary" data-close>Отмена</button>',()=>{$('#slot-confirm').onclick=()=>guarded(()=>{if(saveState==='ok'&&!save())return;select(id);});});
  }));
  document.querySelectorAll('[data-slot-new]').forEach(button=>button.onclick=()=>guarded(()=>{const id=Number(button.dataset.slotNew);confirm(id,'Новая карьера?','Прогресс выбранного слота будет заменён новой карьерой. Предыдущее исправное сохранение останется в резервной копии.',()=>writeSlot(storage,id,newCareer(),{replace:true}));}));
  document.querySelectorAll('[data-slot-copy]').forEach(button=>button.onclick=()=>guarded(()=>{const id=Number(button.dataset.slotCopy);confirm(id,'Скопировать текущую карьеру?','Выбранный слот будет заменён копией текущего прогресса.',()=>writeSlot(storage,id,career,{replace:true}));}));
  document.querySelectorAll('[data-slot-restore]').forEach(button=>button.onclick=()=>guarded(()=>{const id=Number(button.dataset.slotRestore);confirm(id,'Вернуть резервную копию?','Текущий прогресс этого слота будет заменён предыдущим исправным автосохранением.',()=>restoreSlot(storage,id));}));
  document.querySelectorAll('[data-slot-import]').forEach(input=>input.onchange=async()=>{
   try{
    if(busy||race&&!race.finished||replayRecord)throw Error('Сначала заверши текущую сессию');
    const file=input.files?.[0];if(!file)return;if(file.size>SAVE_FILE_LIMIT)throw Error('Файл должен быть JSON до 5 МБ');
    const imported=importCareer(await file.text());guarded(()=>{const id=Number(input.dataset.slotImport);confirm(id,'Импортировать карьеру?',`${escapeHTML(CARS.find(c=>c.id===imported.car).name)} · ${imported.races} заездов. Существующий прогресс выбранного слота будет заменён.`,()=>writeSlot(storage,id,imported,{replace:true}));});
   }catch(error){fail(error);}finally{input.value='';}
  });
  $('#save-download').onclick=()=>{
   try{const blob=new Blob([exportCareer(career)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tokyo-streets-slot-'+sessionSlot+'-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){fail(error);}
  };
 });
}
window.addEventListener('storage',event=>{
 if(event.key===slotKey(sessionSlot)||event.key==='tokyo-streets-v1-active-slot'||event.key===null){
  try{if(activeSlot(storage)!==sessionSlot||storage.getItem(slotKey(sessionSlot))!==expectedRaw){saveState='conflict';updateSaveStatus();}}catch{saveState='error';updateSaveStatus();}
 }
});

observeLocalization(document);
