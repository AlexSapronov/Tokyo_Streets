import {executionLabel} from './execution.js';
// Repeated active intentions accumulate strain within the last six decisions.
// A single filler card does not reset it; a genuinely varied sequence does.
export const HABIT_WINDOW=6;
export function repetitionEffect(state,card) {
  const repeats=card.id==='balanced'?0:(state.recentActions||[]).slice(-HABIT_WINDOW).filter(id=>id===card.id).length;
  const strain=2**repeats-1;
  return {repeats,strain,timeFactor:1+.018*strain,focusFactor:1+.35*strain,
    wearFactor:1+.3*strain,heatExtra:3*strain,recoveryFactor:1/(1+.5*strain)};
}
export function rememberAction(state,card) {
  return [...(state.recentActions||[]),card.id].slice(-HABIT_WINDOW);
}
export function focusCost(config,state,card) {
  const effect=repetitionEffect(state,card);
  const driver=config.pilot.id==='ren'&&card.focus>0?.88:1;
  const equipment=config.parts.includes('weight')?1.1:1;
  return card.focus*driver*equipment*(card.focus>0?effect.focusFactor:effect.recoveryFactor);
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
  if(state.focus<40&&sector.phase!=='prep'&&!card.reset)warning+=(warning?' ':'')+'Низкий фокус: крайняя ошибка исполнения может привести к вылету и сходу.';
  return {pace,load,wear,focus,warning,execution:executionLabel(state.focus),
    habit:effect.repeats?`Повтор приёма: ${effect.repeats+1}-е применение в последних ${HABIT_WINDOW+1} решениях. Нагрузка растёт экспоненциально.`
      :card.id==='balanced'?'Базовый безопасный темп: без штрафа за повтор.':'Свежий приём: без штрафа за повтор.'};
}
