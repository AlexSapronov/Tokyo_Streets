// Stateless, seeded execution draws. Planning never reads the race seed.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function focusRange(focus){
  const reserve=clamp(Number.isFinite(focus)?focus:0,0,100)/100;
  return .008+.152*(1-reserve)**2;
}
export function hashSeed(value){
  let hash=2166136261;
  for(const c of String(value)){hash=Math.imul(hash^c.charCodeAt(0),16777619);}
  return hash>>>0;
}
export function newSeed(){return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];}
export function executionRoll(seed,index,side,focus){
  let value=hashSeed(`${seed>>>0}:${index}:${side}`);
  value=Math.imul(value^(value>>>16),0x21f0aaad);
  value=Math.imul(value^(value>>>15),0x735a2d97);
  value=(value^(value>>>15))>>>0;
  const roll=value/4294967296*2-1,range=focusRange(focus);
  return {focus,range,roll,error:roll*range};
}
export function executionLabel(focus){
  return focus>=75?'Стабильное исполнение':focus>=40?'Заметный разброс исполнения':'Сильный разброс исполнения';
}

// A run-off occupies the worst tail of the same draw, never a hidden second roll.
export function runOffChance(focus,risk,sector,card){
  if(sector.phase==='prep'||card.reset)return 0;
  const deficit=1-clamp(Number.isFinite(focus)?focus:0,0,100)/100;
  const load=.15+clamp(risk,0,1)+(card.focus>10?.2:0);
  return Math.min(.06,.045*deficit**3*load);
}
export function applyRunOff(result,sector,card){
  const execution=result.execution;
  if(!execution||!Number.isFinite(execution.roll))return result;
  const chance=runOffChance(execution.focus,result.risk,sector,card);
  execution.runOffChance=chance;
  if(chance<=0||execution.roll<1-2*chance)return result;
  const speed=result.speed;
  const damage=Math.round(12+clamp(speed/12,0,18)+execution.error*50);
  result.next.dnf={reason:'Вылет с трассы',damage,speed};
  result.next.velocity=0;
  if(result.next.drag)result.next.drag.rpm=0;
  if(result.clip){
    const clip=result.clip;
    result.next.drift.score-=clip.points;
    clip.points=0;clip.valid=false;clip.linked=false;clip.continuity=0;
    clip.line=0;clip.angle=0;clip.speed=0;clip.penalty=0;
    result.next.drift.active=false;result.next.drift.combo=0;
  }
  result.speed=0;
  result.reasons.push(`ВЫЛЕТ С ТРАССЫ: крайняя ошибка исполнения на ${Math.round(speed)} км/ч. Сход; повреждение машины −${damage} п.п. состояния (минимум 35%)`);
  return result;
}
