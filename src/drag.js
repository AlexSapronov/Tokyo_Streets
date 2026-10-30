import {DRAG_CARDS} from './drag-data.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function freshDragState(config) {
  return {time:0,tires:100,heat:55,focus:config.pilot.focus,velocity:0,cooldowns:{},study:false,
    drag:{temperature:25,rpm:3500,pressure:1,reaction:null,sixty:null,et:0,trap:0,distance:0,
      falseStart:false,shiftIndex:0,shifts:0,shiftStyle:'band'}};
}
export function dragReason(card,sector,state) {
  if(!card.phase)return 'Эта карта не используется в дрэге';
  if(card.phase!==sector.phase)return 'Доступно в фазе: '+({prep:'Подготовка',launch:'Старт',shifts:'Переключения',finish:'Финиш'})[card.phase];
  if(card.focus>state.focus)return `Нужно ${card.focus} концентрации`;
  return '';
}
function reactionFor(config,card) {
  if(card.reaction==='edge')return .18-.16*config.pilot.aggression+(.98-config.pilot.skill)*.08;
  return card.reaction+(.98-config.pilot.skill)*.08;
}
function tireGrip(config,state,sector) {
  const wet=sector.wet,drag=state.drag,parts=config.parts;
  const optimum=wet>.35?60:85;
  const temperature=clamp(1-Math.abs(drag.temperature-optimum)/180,.67,1);
  const pressure=1+(1-drag.pressure)*.4;
  return config.car.grip*temperature*pressure*(1-wet*(config.car.drive==='AWD'?.2:.35))
    *(parts.includes('tires')?(wet>.35?.93:1.12):1)
    *(parts.includes('suspension')?1.025:1)*(.8+.2*state.tires/100);
}
// Integrate longitudinal motion at fixed 20 ms steps. No dice rolls and no bonus
// horsepower from cards. Gear timing changes delivered power and interruption.
function travel(config,state,sector,card) {
  const drag=state.drag,parts=config.parts,car=config.car,launch=sector.phase==='launch';
  const mass=car.mass-(parts.includes('weight')?65:0)+(parts.includes('suspension')?8:0);
  const drive=car.drive==='AWD'?1.18:1;
  const lsd=parts.includes('lsd')?1.045:1;
  const grip=tireGrip(config,state,sector);
  const rpmFactor=clamp(drag.rpm/4800,.7,1.15);
  const request=launch?card.throttle*rpmFactor:1;
  const demand=(car.power/mass)*5.4*request;
  const capacity=grip*drive*lsd;
  const slipRatio=launch?clamp((demand-capacity)/capacity,0,.9):0;
  const launchGrip=launch?clamp(request,.65,1.05)*(1-slipRatio*.25):1;
  const style=sector.phase==='shifts'?card.shift:drag.shiftStyle;
  const shiftPower={short:.91,band:1,redline:.96}[style];
  const delay={short:.12,band:.18,redline:.27}[style]+(1-config.pilot.skill)*.14;
  const thresholds=[13,23,34,46,59].map(speed=>speed*({short:.89,band:1,redline:1.1}[style]));
  const power=car.power*735.5*.78*(.9+.1*config.condition/100)*shiftPower
    *(sector.phase==='finish'?card.power:1)*clamp(1-Math.max(0,state.heat-105)/260,.68,1);
  let distance=0,elapsed=0,velocity=state.velocity,shiftIndex=drag.shiftIndex,shifts=0;
  const target=sector.length,dt=.02;
  while(distance<target&&elapsed<90){
    while(shiftIndex<thresholds.length&&velocity>=thresholds[shiftIndex]){
      elapsed+=delay;shiftIndex++;shifts++;velocity=Math.max(0,velocity-delay*.15);
    }
    const force=Math.min(grip*9.81*drive*lsd*launchGrip,power/(mass*Math.max(velocity,7.5)));
    const dragForce=.43*velocity*velocity/mass;
    const rolling=.012*9.81*(1+(1-drag.pressure)*2);
    const acceleration=Math.max(.05,force-dragForce-rolling);
    const nextVelocity=velocity+acceleration*dt;
    const step=(velocity+nextVelocity)*.5*dt;
    const fraction=Math.min(1,(target-distance)/step);
    distance+=step*fraction;elapsed+=dt*fraction;velocity+=(nextVelocity-velocity)*fraction;
  }
  if(distance<target)throw new Error('Не удалось завершить фазу дрэга');
  return {elapsed,velocity,slipRatio,shifts,shiftIndex,grip};
}
export function simulateDrag(config,state,sector,card) {
  const reason=dragReason(card,sector,state);
  if(reason)throw new Error(reason);
  const next=structuredClone(state),drag=next.drag;
  const prep=sector.phase==='prep',launch=sector.phase==='launch';
  const reasons=[];
  let time=0,risk=0,slip=0;
  if(prep){
    drag.temperature=card.temp;drag.rpm=card.rpm;drag.pressure=card.pressure;
    reasons.push(`Шины ${card.temp}°C · ${card.rpm} об/мин · давление ${Math.round(card.pressure*100)}%`);
    reasons.push('Подготовка проходит до сигнала и не входит в зачётное время');
  }else{
    const result=travel(config,state,sector,card);
    time=result.elapsed;next.velocity=result.velocity;
    drag.distance+=sector.length;drag.et+=result.elapsed;
    drag.shiftIndex=result.shiftIndex;drag.shifts+=result.shifts;
    if(sector.phase==='shifts')drag.shiftStyle=card.shift;
    if(launch){
      drag.reaction=reactionFor(config,card);drag.falseStart=drag.reaction<0;
      drag.sixty=result.elapsed;time+=Math.max(0,drag.reaction);
      reasons.push(`Реакция ${drag.reaction.toFixed(3)} с · 60 ft ${drag.sixty.toFixed(3)} с`);
      if(drag.falseStart)reasons.push('ФАЛЬСТАРТ: отрицательная реакция. Результат не попадёт в рекорды');
    }
    risk=result.slipRatio;slip=result.slipRatio*.8;
    if(slip>.01)reasons.push(`Пробуксовка ${Math.round(result.slipRatio*100)}%: часть момента потеряна`);
    reasons.push(`Реализуемое сцепление ${result.grip.toFixed(2)} · скорость ${Math.round(result.velocity*3.6)} км/ч`);
    if(result.shifts)reasons.push(`Переключений: ${result.shifts}. Паузы включены в ET`);
    if(state.heat>105)reasons.push('Перегрев мотора снижает доступную мощность');
    if(config.parts.includes('lsd')&&launch)reasons.push('CUSCO LSD улучшает реализацию тяги');
    drag.temperature=clamp(drag.temperature+(launch?8:4)-sector.wet*4,20,140);
    if(sector.phase==='finish')drag.trap=result.velocity*3.6;
  }
  const cooling=config.car.cooling*(config.parts.includes('cooling')?1.3:1);
  const heat=card.heat>0?card.heat/cooling:card.heat*cooling;
  next.heat=clamp(state.heat+heat,35,200);
  next.focus=clamp(state.focus-card.focus*(config.pilot.id==='ren'?.88:1),0,config.pilot.focus);
  next.tires=clamp(state.tires-card.wear*(config.parts.includes('tires')?1.25:1)-slip*2,0,100);
  next.time+=time;
  if(config.parts.includes('cooling'))reasons.push('HKS уменьшает нагрев мотора');
  return {time,next,risk,slip,speed:next.velocity*3.6,gain:0,reasons};
}
export function dragCards(){return DRAG_CARDS;}
