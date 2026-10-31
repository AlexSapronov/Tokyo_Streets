import {executionLabel} from './execution.js';
// Repeated active intentions accumulate strain within the last six decisions.
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
 return {strain,focusFactor:active?1+strain*.09:1,timeFactor:active?1+Math.max(0,strain-2)*.006:1,risk:strain*.025};
}
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
  const equipment=(config.parts.includes('weight')?1.1:1)*(config.car.focusFactor||1);
  return card.focus*driver*equipment*(card.focus>0?effect.focusFactor*strainEffect(state,card).focusFactor:effect.recoveryFactor);
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
  if((state.strain||0)>2)warning+=(warning?' ':'')+'Накоплена общая нагрузка от атак: смена карты не снимает напряжение.';
  if(state.focus<40&&sector.phase!=='prep'&&!card.reset)warning+=(warning?' ':'')+'Низкий фокус: крайняя ошибка исполнения может привести к вылету и сходу.';
  return {pace,load,wear,focus,warning,execution:executionLabel(state.focus),
    habit:effect.repeats?`Повтор приёма: ${effect.repeats+1}-е применение в последних ${HABIT_WINDOW+1} решениях. Нагрузка растёт экспоненциально.`
      :card.id==='balanced'?'Базовый безопасный темп: без штрафа за повтор.':'Свежий приём: без штрафа за повтор.'};
}
