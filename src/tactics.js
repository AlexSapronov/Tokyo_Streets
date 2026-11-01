import {executionLabel} from './execution.js';
// Repetition and overall attack strain tax focus only. Execution risk comes
// from actual focus and driving conditions, never from the history counter.
// A single filler card does not reset it; a genuinely varied sequence does.
export const HABIT_WINDOW=6;
export function attackLoad(card){
 if(card.reset||card.focus<=0)return 0;
 return Math.max(0,(card.risk||0)*2+(card.focus>10?.45:.1)+(card.heat>10?.3:0));
}
export function strainAfter(state,card){
 const load=attackLoad(card),old=state.strain||0;
 return Math.max(0,Math.min(6,load>0?old*.92+load:old-(card.focus<0?1.4:.5)));
}
export function strainEffect(state,card){
 const strain=state.strain||0,active=attackLoad(card)>0;
 return {strain,focusFactor:active?1+strain*.09:1,timeFactor:1,risk:0};
}
export function repetitionEffect(state,card) {
  const repeats=card.id==='balanced'?0:(state.recentActions||[]).slice(-HABIT_WINDOW).filter(id=>id===card.id).length;
  const strain=2**repeats-1;
  // Neutral physical fields keep the helper contract; only focus fields vary.
  return {repeats,strain:0,timeFactor:1,focusFactor:1+.35*strain,
    wearFactor:1,heatExtra:0,recoveryFactor:1/(1+.5*strain)};
}
export function rememberAction(state,card) {
  return [...(state.recentActions||[]),card.id].slice(-HABIT_WINDOW);
}
export function focusCost(config,state,card,sector=null) {
  const effect=repetitionEffect(state,card);
  const driver=config.pilot.id==='ren'&&card.focus>0?.88:1;
  const equipment=(config.parts.includes('weight')?1.1:1)*(config.car.focusFactor||1);
  const training=card.focus>0?(1-(config.training?.endurance||0)*.05)*(card.gap?1-(config.training?.racecraft||0)*.08:1):1;
  return (sector?.decisionScale||1)*card.focus*driver*equipment*training*(card.focus>0?effect.focusFactor*strainEffect(state,card).focusFactor:effect.recoveryFactor);
}
export function qualitativeForecast(config,state,sector,card,prediction) {
  const effect=repetitionEffect(state,card);
  const ratio=prediction.gain/Math.max(.001,prediction.time+prediction.gain);
  const pace=sector.mode==='drift'?(prediction.clip.spin?'Срыв связки':prediction.clip.points>=80?'Точная связка':prediction.clip.points>=55?'Рабочая линия':'Потеря качества'):sector.mode==='drag'
    ?sector.phase==='prep'?'Подготовка к старту':prediction.next.drag.falseStart?'Недействительный старт':'Реализация тяги'
    :ratio>.01?'Потенциал выигрыша':ratio<-.01?'Потеря темпа':'Ровный темп';
  const load=prediction.risk>.3?'Высокая':prediction.risk>.15?'Умеренная':'Низкая';
  const tireLoss=state.tires-prediction.next.tires;
  const wear=tireLoss>4?'Высокий':tireLoss>1.5?'Умеренный':'Низкий';
  const focus=prediction.next.focus>state.focus?'Восстановление':prediction.next.focus===state.focus?'Без расхода':state.focus-prediction.next.focus>20?'Высокий расход':'Умеренный расход';
  let warning=prediction.clip?.spin?'Нагрузка грозит разворотом и потерей клипа.':card.reset?'Стабилизация прервёт связку: клип без баллов.':prediction.next.drag?.falseStart?'Фальстарт: результат не будет засчитан.'
    :prediction.slip>.1?'Есть риск потери сцепления и темпа.'
    :state.heat>110?'Перегрев ограничивает исполнение.':'';
  if(card.id==='defend')warning+=(warning?' ':'')+'Соперник получит +0.35 с, но защита не гарантирует удержание позиции.';
  if(card.gain>0&&prediction.gain<0)warning+=(warning?' ':'')+'Сейчас потери съедают ускорение приёма: проверь сцепление, нагрев и состояние машины.';
  if((state.strain||0)>2)warning+=(warning?' ':'')+'Накоплена нагрузка на фокус: активные приёмы дороже, смена карты не сбрасывает её.';
  if(state.focus<40&&sector.phase!=='prep'&&!card.reset)warning+=(warning?' ':'')+'Низкий фокус: крайняя ошибка исполнения может привести к вылету и сходу.';
  return {pace,load,wear,focus,warning,execution:executionLabel(state.focus),
    habit:effect.repeats?`Повтор приёма: ${effect.repeats+1}-е применение с учётом предыдущих ${HABIT_WINDOW} решений. Меняется только расход или восстановление фокуса; прямого штрафа темпа нет.`
      :card.id==='balanced'?'Базовый безопасный темп: без штрафа за повтор.':'Свежий приём: без штрафа за повтор.'};
}
