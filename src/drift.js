import {partCapabilities} from './parts.js';
import {tireFactor,aeroGrip} from './tuning.js';
import {DRIFT_CARDS} from './drift-data.js';
import {focusCost,repetitionEffect,rememberAction,strainEffect} from './tactics.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const DRIFT_WEIGHTS={line:.35,angle:.25,speed:.2,continuity:.2};
export function freshDriftState(config){
  return {time:0,tires:config.tireCondition??100,heat:55,focus:config.pilot.focus,velocity:20,cooldowns:{},recentActions:[],study:false,
    drift:{score:0,active:false,angle:0,direction:0,combo:0,peakCombo:0,completedChains:0,breaks:0,spins:0,temperature:50,clips:[]}};
}
export function driftCards(){return DRIFT_CARDS;}
export function driftReason(card,sector,state,config){
  if(!DRIFT_CARDS.some(item=>item.id===card.id))return 'Эта карта не используется в дрифте';
  if(card.phase!=='any'&&card.phase!==sector.phase)return 'Доступно в фазе: '+({init:'Инициация',hold:'Удержание',transition:'Перекладка',exit:'Выход'})[card.phase];
  if(card.requiresDrift&&!state.drift.active)return 'Нет устойчивого заноса: скорректируй линию или стабилизируй машину';
  const cost=focusCost(config,state,card);
  if(cost>state.focus)return `Нужно ${Math.ceil(cost)} концентрации с учётом повторов`;
  return '';
}
export function simulateDrift(config,state,sector,card,execution=null){
  const error=execution?.error||0;
  const reason=driftReason(card,sector,state,config);
  if(reason)throw new Error(reason);
  const {car,pilot}=config,parts=partCapabilities(config.parts),has=id=>parts.includes(id),repeat=repetitionEffect(state,card);
  const previous=state.drift,phase=sector.phase,wet=sector.wet;
  const mass=car.mass-(has('weight')?65:0)+(has('suspension')?8:0);
  const condition=.86+.14*config.condition/100;
  const tempFade=clamp(1-Math.max(0,previous.temperature-95)/220,.65,1);
  const grip=car.grip*(1-wet*.32)*tireFactor(config,wet)*aeroGrip(config,state.velocity)
    *(has('suspension')?1+.05*car.partSuspensionHealth:1)*(.75+.25*state.tires/100)*tempFade*condition;
  const precision=clamp(pilot.skill+(config.training?.control||0)*.008+(has('suspension')?.035:0)+(has('lsd')?.045*car.partLsdHealth:0)+(car.driftPrecision||0)-error,.3,1.08);
  const yaw=(car.drive==='AWD'?.82:car.drive==='FF'?.55:car.drive==='MR'?1.1:1.04)*(car.driftYaw||1);
  let response=yaw*(.92+.08*pilot.aggression)*condition;
  if(card.method==='power')response*=clamp(car.power/mass/.16,.74,1.24)*(has('lsd')?1.04:1);
  if(card.method==='feint'||card.id==='drift-flick')response*=clamp(1150/mass,.8,1.13)*(has('suspension')?1.04:1);
  if(card.method==='brake')response*=(has('brakes')?1+.04*(config.wear?.brakes??100)/100:1)*(.85+.15*(config.wear?.stockBrakes??100)/100);
  const targetSpeed=sector.targetSpeed*(1-wet*.16);
  const maxCornerSpeed=Math.sqrt(grip*9.81*sector.radius)*3.6;
  const acceleration=car.power*735.5*.78/(mass*Math.max(state.velocity,12));
  const attainable=Math.sqrt(state.velocity**2+2*acceleration*sector.length*.18)*3.6;
  const speed=Math.max(20,Math.min(targetSpeed*card.pace*(1-error*.25),maxCornerSpeed*1.12,attainable));
  const angle=card.reset?0:clamp(card.angle*response*(1+wet*.1)*(1+error*.8),0,86);
  const lateral=(speed/3.6)**2/sector.radius/(grip*9.81);
  const load=clamp((car.setupRisk||0)-(wet>.35||angle>40?(config.training?.control||0)*.018:0)+(car.drive==='MR'?.04:0)+strainEffect(state,card).risk+Math.max(0,angle-52)/38+Math.max(0,lateral-.85)*.55
    +Math.max(0,55-state.focus)/180+Math.max(0,65-state.tires)/170
    +Math.max(0,state.heat-115)/260+repeat.strain*.025-(precision-.85)*.45,0,1.2);
  const spin=!card.reset&&(load>.9||angle>78&&load>.55);
  const targetAngle=sector.targetAngle;
  const direction=sector.direction;
  const correctTransition=phase!=='transition'||previous.active&&previous.direction===-direction;
  const linked=phase==='init'||previous.active&&correctTransition;
  const active=!card.reset&&!spin&&(phase==='exit'?angle>=5:angle>=14);
  const lineQuality=clamp(precision-card.line-Math.abs(angle-targetAngle)/150
    -Math.max(0,lateral-1)*.2-load*.12-(linked?0:.15),0,1);
  const angleQuality=clamp(1-Math.abs(angle-targetAngle)/Math.max(25,targetAngle),0,1);
  const speedQuality=clamp(1-Math.abs(speed-targetSpeed)/targetSpeed,0,1);
  const continuity=phase==='init'?.8:linked?clamp(.85+previous.combo*.04,0,1):.25;
  const broken=spin||card.reset||!active||phase!=='init'&&!linked;
  const continuityQuality=broken?0:continuity*(car.drive==='FF'?.6:1);
  let points=active?100*(lineQuality*DRIFT_WEIGHTS.line+angleQuality*DRIFT_WEIGHTS.angle
    +speedQuality*DRIFT_WEIGHTS.speed+continuityQuality*DRIFT_WEIGHTS.continuity)/repeat.timeFactor:0;
  if(card.recover&&!previous.active)points*=.7;
  points=clamp(points,0,100);
  const combo=active?(phase==='init'?1:linked?previous.combo+1:1):0;
  const clip={phase,direction,angleDegrees:angle,velocity:speed,points,
    line:active?lineQuality*100:0,angle:active?angleQuality*100:0,speed:active?speedQuality*100:0,
    continuity:continuityQuality*100,spin,valid:active,linked:!broken};
  clip.penalty=Math.max(0,clip.line*DRIFT_WEIGHTS.line+clip.angle*DRIFT_WEIGHTS.angle+clip.speed*DRIFT_WEIGHTS.speed+clip.continuity*DRIFT_WEIGHTS.continuity-points);
  const reasons=[`Клип: ${sector.clip} · целевой угол ${targetAngle}°`,
    `Линия ${clip.line.toFixed(1)} / угол ${clip.angle.toFixed(1)} / скорость ${clip.speed.toFixed(1)} / связность ${clip.continuity.toFixed(1)}`];
  if(spin)reasons.push('Разворот: угол и нагрузка превысили управляемый предел. Клип — 0 баллов');
  else if(card.reset)reasons.push('Машина стабилизирована: концентрация восстановлена, связка прервана. Клип — 0 баллов');
  else if(!linked&&phase!=='init')reasons.push('Связность потеряна: предыдущий занос не поддержан');
  if(card.recover&&!previous.active)reasons.push('Возврат в занос: оценка снижена за разрыв связки');
  if(Math.abs(angle-targetAngle)>15)reasons.push('Больше угол не значит лучше: требуется точность попадания в задание');
  if(car.drive==='FF')reasons.push('FF: тяга передней оси ограничивает устойчивый занос и связность');
  if(car.drive==='AWD')reasons.push('AWD стабилен на тяге, но сопротивляется большому углу');
  if(has('lsd'))reasons.push('CUSCO LSD улучшает управление углом и тягой');
  if(previous.temperature>95)reasons.push('Перегретые шины теряют сцепление');
  if(repeat.repeats)reasons.push(`Повтор приёма ${repeat.repeats+1}: растёт нагрузка, снижается оценка исполнения`);
  const wear=card.wear*(mass/1100)*(has('tires')?1.25:1)*repeat.wearFactor*(car.wearFactor||1)+(spin?5:0);
  const heat=card.heat>=0?(card.heat+repeat.heatExtra)*(car.heatFactor||1)*(car.engineHeat||1)/(car.cooling*(has('cooling')?car.coolerFactor:1))
    :card.heat*repeat.recoveryFactor*car.cooling*(has('cooling')?car.coolerFactor:1);
  const duration=sector.length/(speed/3.6)*repeat.timeFactor+(spin?2:0);
  const next={...state,time:state.time+duration,velocity:speed/3.6,tires:clamp(state.tires-wear,0,100),
    heat:clamp(state.heat+heat,35,200),focus:clamp(state.focus-focusCost(config,state,card),0,pilot.focus),
    recentActions:rememberAction(state,card),
    drift:{score:previous.score+points,active:active&&phase!=='exit',angle:active?angle:0,direction:active?direction:0,
      combo,peakCombo:Math.max(previous.peakCombo,combo),completedChains:previous.completedChains+(phase==='exit'&&linked&&combo>=4?1:0),
      breaks:previous.breaks+(broken?1:0),spins:previous.spins+(spin?1:0),
      temperature:clamp(previous.temperature+(card.reset?-8:wear*2.4)-wet*3,25,160),clips:[...previous.clips,clip]}};
  return {time:duration,next,risk:clamp(load,0,1),slip:spin?2:Math.max(0,load-.65),speed,gain:0,reasons,clip};
}
