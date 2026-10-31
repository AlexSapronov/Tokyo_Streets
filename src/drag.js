import {transmissionProfile,longShiftSpeeds} from './telemetry.js';
import {focusCost,repetitionEffect,rememberAction} from './tactics.js';
import {DRAG_CARDS,ALL_DRAG_CARDS} from './drag-data.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function freshDragState(config) {
  return {time:0,tires:100,heat:55,focus:config.pilot.focus,velocity:0,cooldowns:{},study:false,
    drag:{temperature:25,rpm:3500,pressure:1,reaction:null,sixty:null,et:0,trap:0,distance:0,
      falseStart:false,shiftIndex:0,shifts:0,shiftStyle:'band'}};
}
export function dragReason(card,sector,state,config=null) {
  if(card.requiresLong&&!sector.longDrag)return 'Только для 804 м и одной мили';
  if(!card.phase)return 'Эта карта не используется в дрэге';
  if(card.phase!==sector.phase)return 'Доступно в фазе: '+({prep:'Подготовка',launch:'Старт',shifts:'Переключения',finish:'Финиш',pull:'Длинный разгон'})[card.phase];
  if(card.minSpeed&&state.velocity*3.6<card.minSpeed)return `Нужна скорость от ${card.minSpeed} км/ч`;
  const cost=sector.longDrag&&config?focusCost(config,state,card):card.focus;
  if(cost>state.focus)return `Нужно ${Math.ceil(cost)} концентрации`;
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
  if(sector.longDrag)return travelLong(config,state,sector,card);
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
  const reason=dragReason(card,sector,state,config);
  if(reason)throw new Error(reason);
  const next=structuredClone(state),drag=next.drag;
  const repeat=sector.longDrag?repetitionEffect(state,card):null;
  const prep=sector.phase==='prep',launch=sector.phase==='launch';
  const reasons=[];
  let time=0,risk=0,slip=0;
  if(prep){
    drag.temperature=card.temp;drag.rpm=card.rpm;drag.pressure=card.pressure;
    if(sector.longDrag){drag.longFormat=true;drag.gearing=card.gearing||1;drag.forceTop=false;drag.splits=[];next.recentActions=rememberAction(state,card);}
    reasons.push(`Шины ${card.temp}°C · ${card.rpm} об/мин · давление ${Math.round(card.pressure*100)}%`);
    reasons.push('Подготовка проходит до сигнала и не входит в зачётное время');
  }else{
    const result=travel(config,state,sector,card);
    time=result.elapsed;next.velocity=result.velocity;
    drag.distance+=sector.length;drag.et+=result.elapsed;
    drag.shiftIndex=result.shiftIndex;drag.shifts+=result.shifts;
    if(sector.phase==='shifts'||card.shift)drag.shiftStyle=card.shift;
    if(sector.longDrag){next.heat=result.engineHeat;drag.forceTop=result.forceTop;drag.splits=[...(drag.splits||[]),...result.splits];next.recentActions=rememberAction(state,card);}
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
    if(sector.longDrag){
      if(drag.gearing<1)reasons.push('Длинная главная пара: меньше обороты и момент на колёсах');
      if(card.topGear)reasons.push('Ранняя высшая передача: обороты снижены, доступная мощность зависит от power band');
      if(card.reselectGear)reasons.push(result.shifts?'Передача выбрана заново; пауза включена в ET':'Проверен рабочий диапазон: текущая передача подходит, лишней паузы нет');
      reasons.push(`Температура мотора: пик ${result.peakHeat.toFixed(1)}°C / выход ${result.engineHeat.toFixed(1)}°C`);
      if(result.minFade<.999)reasons.push(`Перегрев ограничил доступную мощность до ${Math.round(result.minFade*100)}%`);
      if(result.limiterTime>.01)reasons.push(`Отсечка ограничивала тягу ${result.limiterTime.toFixed(2)} с`);
      if(repeat.repeats)reasons.push(`Повтор приёма ${repeat.repeats+1}: растёт тепловая нагрузка и расход концентрации`);
      for(const split of result.splits)reasons.push(`Отсечка ${split.distance.toFixed(3)} м: ET ${split.et.toFixed(3)} с / ${split.speed.toFixed(1)} км/ч`);
    }
    if(state.heat>105)reasons.push('Перегрев мотора снижает доступную мощность');
    if(config.parts.includes('lsd')&&launch)reasons.push('CUSCO LSD улучшает реализацию тяги');
    drag.temperature=clamp(drag.temperature+(launch?8:4)-sector.wet*4,20,140);
    if(sector.phase==='finish')drag.trap=result.velocity*3.6;
  }
  const cooling=config.car.cooling*(config.parts.includes('cooling')?1.3:1);
  const heat=card.heat>0?card.heat/cooling:card.heat*cooling;
  if(!sector.longDrag||prep)next.heat=clamp(state.heat+heat,35,200);
  next.focus=clamp(state.focus-(sector.longDrag?focusCost(config,state,card):card.focus*(config.pilot.id==='ren'?.88:1)),0,config.pilot.focus);
  next.tires=clamp(state.tires-card.wear*(config.parts.includes('tires')?1.25:1)*(repeat?.wearFactor||1)-slip*2,0,100);
  next.time+=time;
  if(config.parts.includes('cooling'))reasons.push('HKS уменьшает нагрев мотора');
  return {time,next,risk,slip,speed:next.velocity*3.6,gain:0,reasons};
}
export function dragCards(long=false){return long?ALL_DRAG_CARDS:DRAG_CARDS;}

function travelLong(config,state,sector,card){
  const drag=state.drag,car=config.car,parts=config.parts,launch=sector.phase==='launch';
  const mass=car.mass-(parts.includes('weight')?65:0)+(parts.includes('suspension')?8:0);
  const grip=tireGrip(config,state,sector),drive=car.drive==='AWD'?1.18:1,lsd=parts.includes('lsd')?1.045:1;
  const demand=(car.power/mass)*5.4*(launch?card.throttle*clamp(drag.rpm/4800,.7,1.15):1)*(drag.gearing||1);
  const capacity=grip*drive*lsd,slipRatio=launch?clamp((demand-capacity)/capacity,0,.9):0;
  const launchGrip=launch?clamp(card.throttle*clamp(drag.rpm/4800,.7,1.15),.65,1.05)*(1-slipRatio*.25)*(drag.gearing||1):1;
  const profile=transmissionProfile(config),ratio=drag.gearing||1;
  const style=card.shift||drag.shiftStyle,thresholds=longShiftSpeeds(config,style,ratio);
  const delay={short:.12,band:.18,redline:.27}[style]+(1-config.pilot.skill)*.14;
  const basePower=car.power*735.5*.78*(.9+.1*config.condition/100)*(card.power??1);
  const repeat=repetitionEffect(state,card),cooling=car.cooling*(parts.includes('cooling')?1.3:1);
  let velocity=state.velocity,engineHeat=state.heat,distance=0,elapsed=0,shiftIndex=drag.shiftIndex,shifts=0,forceTop=drag.forceTop||false;
  const changeGear=target=>{if(target!==shiftIndex){shiftIndex=target;shifts++;elapsed+=delay;velocity=Math.max(.1,velocity-delay*.15);}};
  if(card.topGear){changeGear(profile.ratios.length-1);forceTop=true;}
  if(card.reselectGear){forceTop=false;changeGear(thresholds.filter(v=>velocity>=v).length);}
  const marks=[402.336,804.672,1609.344].filter(mark=>mark>drag.distance+1e-8&&mark<=drag.distance+sector.length+1e-8),splits=[];
  let peakHeat=engineHeat,minFade=1,limiterTime=0;
  const reference={launch:2,shifts:8,pull:8,finish:5}[sector.phase],dt=.02;
  while(distance<sector.length&&elapsed<90){
    if(!forceTop)while(shiftIndex<thresholds.length&&velocity>=thresholds[shiftIndex])changeGear(shiftIndex+1);
    const gear=Math.min(profile.ratios.length-1,shiftIndex);
    const rpm=velocity/profile.circumference*60*profile.ratios[gear]*profile.final*ratio;
    const band=rpm>profile.redline?.18:clamp(1-((rpm/profile.redline-.82)/.7)**2,.45,1);
    const fade=clamp(1-Math.max(0,engineHeat-105)/200,.5,1);minFade=Math.min(minFade,fade);
    const force=Math.min(grip*9.81*drive*lsd*launchGrip,basePower*band*fade/(mass*Math.max(velocity,7.5)));
    const resistance=.43*velocity**2/mass+.012*9.81*(1+(1-drag.pressure)*2);
    const acceleration=force-resistance;
    const nextVelocity=Math.max(.1,velocity+acceleration*dt),step=(velocity+nextVelocity)*.5*dt;
    const fraction=Math.min(1,(sector.length-distance)/step),stepTime=dt*fraction;
    for(const mark of marks){
      const local=mark-drag.distance;
      if(local>distance+1e-9&&local<=distance+step*fraction+1e-8){
        const part=clamp((local-distance)/step,0,fraction);
        splits.push({distance:mark,et:drag.et+elapsed+dt*part,speed:(velocity+(nextVelocity-velocity)*part)*3.6});
      }
    }
    const rate=card.heat>=0?(card.heat/reference+repeat.heatExtra*.8)*(.8+.5*clamp(rpm/profile.redline,0,1.2))/cooling:card.heat/reference*cooling*repeat.recoveryFactor;
    engineHeat=clamp(engineHeat+(rate-Math.max(0,engineHeat-75)*.012*cooling)*stepTime,35,200);
    peakHeat=Math.max(peakHeat,engineHeat);if(rpm>profile.redline)limiterTime+=stepTime;
    distance+=step*fraction;elapsed+=stepTime;velocity+=(nextVelocity-velocity)*fraction;
  }
  if(distance<sector.length)throw new Error('Не удалось завершить длинный разгон');
  return {elapsed,velocity,engineHeat,slipRatio,shifts,shiftIndex,forceTop,grip,splits,peakHeat,minFade,limiterTime};
}
