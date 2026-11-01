// A short, evidence-based finish report. No random narrative and no invented telemetry.
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const sec=(n,lang)=>Math.abs(n).toFixed(2)+(lang==='en'?' s':' с');
const name=(row)=>row.sector||('№ '+(row.index+1));
const maxBy=(rows,key)=>rows.reduce((best,row)=>!best||key(row)>key(best)?row:best,null);
const rankName=(medal,lang)=>({ru:{gold:'Золото',silver:'Серебро',bronze:'Бронза'},en:{gold:'Gold',silver:'Silver',bronze:'Bronze'}})[lang]?.[medal]||'';
const phrase=(lang,ru,en)=>lang==='en'?en:ru;

function drivingFlags(rows,lang){
  const messages=[];
  const fade=rows.flatMap(row=>(row.reasons||[]).map(reason=>String(reason).match(/эффективность тормозов (\d+)%/)).filter(Boolean).map(match=>Number(match[1])));
  if(fade.length){
    const low=Math.min(...fade);
    messages.push(phrase(lang,
      'Перегрев тормозов: эффективность падала до '+low+'%.',
      'Brake fade: braking efficiency dropped to '+low+'%.'));
  }
  const repeats=rows.filter(row=>(row.reasons||[]).some(reason=>String(reason).startsWith('Повтор приёма')));
  if(repeats.length)messages.push(phrase(lang,
    'Повторные приёмы повышали цену фокуса'+(repeats.length>1?' на '+repeats.length+' участках.':'.'),
    'Repeated tactics increased focus costs'+(repeats.length>1?' in '+repeats.length+' sectors.':'.')));
  const slip=rows.filter(row=>valid(row.slip)&&row.slip>.03);
  if(slip.length)messages.push(phrase(lang,
    'На '+slip.length+' участк'+(slip.length===1?'е':slip.length<5?'ах':'ах')+' машина выходила за предел сцепления.',
    'You exceeded the grip limit in '+slip.length+' sector'+(slip.length===1?'':'s')+'.'));
  return messages;
}

function duelSummary(race,outcome,event,lang){
  const rows=race.history||[];
  const player=race.player||{},opponent=race.opponent||{};
  const isDrag=race.mode==='drag';
  const playerDnf=!!player.dnf,opponentDnf=!!opponent.dnf;
  const falseStart=!!player.drag?.falseStart,opponentFalseStart=!!opponent.drag?.falseStart;
  const won=!!outcome.won;
  const gap=valid(player.time)&&valid(opponent.time)?player.time-opponent.time:null;
  let title,lead;
  if(playerDnf){
    title=phrase(lang,'Сход с трассы','Did not finish');
    const last=rows.at(-1);
    lead=phrase(lang,'Заезд закончился вылетом'+(last?' на участке «'+name(last)+'»':'')+'.',
      'Your run ended with an off-track incident'+(last?' in '+name(last):'')+'.');
  }else if(falseStart){
    title=phrase(lang,'Фальстарт','False start');
    lead=phrase(lang,'Результат не засчитан: старт произошёл до сигнала.',
      'The run did not count because you launched before the signal.');
  }else if(opponentDnf||opponentFalseStart){
    title=phrase(lang,'Победа после ошибки соперника','Win after a rival mistake');
    lead=opponentDnf?phrase(lang,'Соперник сошёл с дистанции.','Your rival failed to finish.'):
      phrase(lang,'Соперник допустил фальстарт.','Your rival jumped the start.');
  }else if(gap!==null){
    title=won?phrase(lang,'Победа по времени','Faster to the finish'):phrase(lang,'Соперник оказался быстрее','Your rival was faster');
    lead=won?phrase(lang,'Ты финишировал на '+sec(gap,lang)+' раньше соперника.','You finished '+sec(gap,lang)+' ahead of your rival.'):
      phrase(lang,'Ты уступил '+sec(gap,lang)+'.','You finished '+sec(gap,lang)+' behind your rival.');
  }else{
    title=won?phrase(lang,'Победа','Victory'):phrase(lang,'Заезд завершён','Race finished');
    lead=phrase(lang,'Итог определён по правилам заезда.','The result follows the race rules.');
  }

  const facts=[];
  const splits=rows.filter(row=>valid(row.playerTime)&&valid(row.aiTime)).map(row=>({...row,delta:row.playerTime-row.aiTime}));
  const slower=maxBy(splits,row=>row.delta),faster=maxBy(splits,row=>-row.delta);
  if(slower?.delta>.12)facts.push(phrase(lang,
    'Больше всего потерял на «'+name(slower)+'»: '+sec(slower.delta,lang)+'.',
    'Biggest time loss: '+name(slower)+' ('+sec(slower.delta,lang)+').'));
  if(faster?.delta<-.12)facts.push(phrase(lang,
    'Лучший отыгрыш на «'+name(faster)+'»: '+sec(faster.delta,lang)+'.',
    'Best sector gain: '+name(faster)+' ('+sec(faster.delta,lang)+').'));
  if(!isDrag&&splits.length>1&&event?.sectors){
    const corner=splits.filter(row=>event.sectors[row.index]?.type==='corner');
    const straights=splits.filter(row=>event.sectors[row.index]?.type!=='corner');
    const cornerDelta=corner.reduce((sum,row)=>sum+row.delta,0);
    const straightDelta=straights.reduce((sum,row)=>sum+row.delta,0);
    if(Math.abs(cornerDelta)>.5&&Math.abs(cornerDelta)>Math.abs(straightDelta)){
      facts.unshift(cornerDelta>0?phrase(lang,
        'Главная потеря в поворотах: '+sec(cornerDelta,lang)+' суммарно.',
        'Corners cost you '+sec(cornerDelta,lang)+' in total.'):
        phrase(lang,'Решили повороты: здесь ты отыграл '+sec(cornerDelta,lang)+'.',
          'Corners made the difference: you gained '+sec(cornerDelta,lang)+'.'));
    }else if(Math.abs(straightDelta)>.5&&Math.abs(straightDelta)>Math.abs(cornerDelta)){
      facts.unshift(straightDelta>0?phrase(lang,
        'На прямых потеряно '+sec(straightDelta,lang)+' суммарно.',
        'Straights cost you '+sec(straightDelta,lang)+' in total.'):
        phrase(lang,'На прямых отыграно '+sec(straightDelta,lang)+'.',
          'You gained '+sec(straightDelta,lang)+' on the straights.'));
    }
  }
  if(isDrag&&!playerDnf){
    if(valid(player.drag?.reaction))facts.push(phrase(lang,
      'Реакция на старте: '+player.drag.reaction.toFixed(3)+' с.',
      'Launch reaction: '+player.drag.reaction.toFixed(3)+' s.'));
    if(splits.some(row=>(row.reasons||[]).some(x=>String(x).includes('Пробуксовка')))){
      facts.push(phrase(lang,'Пробуксовка на старте или разгоне съела часть тяги.',
        'Wheelspin reduced usable traction during the run.'));
    }
  }else if(!isDrag){
    const flags=drivingFlags(rows,lang);
    // Preserve the deciding sector, but never bury a mechanical issue below the fold.
    if(flags.length)facts.splice(Math.min(2,facts.length),0,...flags);
  }
  return {title,lead,facts:[...new Set(facts)].slice(0,3)};
}

function timeAttackSummary(race,outcome,event,lang){
  const rows=race.history||[],player=race.player||{};
  if(player.dnf)return {title:phrase(lang,'Сход с трассы','Did not finish'),
    lead:phrase(lang,'Вылет прервал попытку. Время не засчитано.','An off-track incident ended the attempt. No valid time.'),
    facts:drivingFlags(rows,lang).slice(0,2)};
  const targets=race.targets||{},medal=outcome.medal;
  const title=medal?phrase(lang,rankName(medal,lang)+' по времени',rankName(medal,lang)+' time'):
    phrase(lang,'Без медали','No medal');
  let lead=phrase(lang,'Попытка завершена за '+sec(player.time,lang)+'.','Run completed in '+sec(player.time,lang)+'.');
  if(medal&&valid(targets[medal]))lead+=phrase(lang,
    ' Запас до норматива: '+sec(targets[medal]-player.time,lang)+'.',
    ' Margin against the target: '+sec(targets[medal]-player.time,lang)+'.');
  else if(!medal&&valid(targets.bronze))lead+=phrase(lang,
    ' До бронзы не хватило '+sec(player.time-targets.bronze,lang)+'.',
    ' You missed bronze by '+sec(player.time-targets.bronze,lang)+'.');
  const facts=drivingFlags(rows,lang);
  if(valid(race.ghost?.time))facts.unshift(player.time<race.ghost.time?
    phrase(lang,'Улучшен прошлый рекорд на '+sec(player.time-race.ghost.time,lang)+'.',
      'Previous best improved by '+sec(player.time-race.ghost.time,lang)+'.'):
    phrase(lang,'Отставание от прошлого рекорда: '+sec(player.time-race.ghost.time,lang)+'.',
      'Behind your previous best by '+sec(player.time-race.ghost.time,lang)+'.'));
  return {title,lead,facts:facts.slice(0,3)};
}

function driftSummary(race,outcome,event,lang){
  const state=race.player?.drift||{},clips=(race.history||[]).filter(row=>valid(row.drift?.points));
  if(race.player?.dnf)return {title:phrase(lang,'Сход с трассы','Did not finish'),
    lead:phrase(lang,'Попытка прервана вылетом.','An off-track incident ended the drift run.'),facts:[]};
  const medal=outcome.medal,title=medal?rankName(medal,lang):
    phrase(lang,'Без медали','No medal');
  let lead=phrase(lang,'За сессию набрано '+(valid(state.score)?state.score.toFixed(1):'0')+' баллов.',
    'You scored '+(valid(state.score)?state.score.toFixed(1):'0')+' points.');
  const bronze=event?.medals?.bronze;
  if(!medal&&valid(bronze)&&valid(state.score))lead+=phrase(lang,
    ' До бронзы не хватило '+(bronze-state.score).toFixed(1)+' балла.',
    ' Bronze was '+(bronze-state.score).toFixed(1)+' points away.');
  const facts=[];
  if(state.spins)facts.push(phrase(lang,
    'Разворотов: '+state.spins+'. Каждый обнуляет оценку клипа.',
    'Spins: '+state.spins+'. A spin zeroes that clip.'));
  if(state.breaks)facts.push(phrase(lang,
    'Разрывов связки: '+state.breaks+'. Это снижает итоговые баллы.',
    'Broken links: '+state.breaks+'. They hurt your score.'));
  const best=maxBy(clips,row=>row.drift.points);
  if(best)facts.push(phrase(lang,
    'Лучший клип: «'+name(best)+'» ('+best.drift.points.toFixed(1)+' балла).',
    'Best clip: '+name(best)+' ('+best.drift.points.toFixed(1)+' points).'));
  return {title,lead,facts:facts.slice(0,3)};
}

export function summarizeRace(race,outcome,event,lang='ru'){
  const language=lang==='en'?'en':'ru';
  if(!race||!outcome)return {title:'',lead:'',facts:[]};
  if(race.mode==='drift')return driftSummary(race,outcome,event,language);
  if(race.mode==='timeattack')return timeAttackSummary(race,outcome,event,language);
  return duelSummary(race,outcome,event,language);
}

export function raceSummaryHTML(summary,escape){
  const safe=escape||((value)=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])));
  return '<section class="race-recap" aria-label="'+safe(summary.title)+'"><div class="race-recap-heading">'+safe(summary.title)+'</div>'+
    '<p>'+safe(summary.lead)+'</p>'+(summary.facts.length?'<ul>'+summary.facts.map(item=>'<li>'+safe(item)+'</li>').join('')+'</ul>':'')+'</section>';
}
