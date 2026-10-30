import {CARS,PILOTS,CARDS,sectorAt} from './data.js';
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function configuration(carId,pilotId,parts=[],condition=100){
 const car=CARS.find(c=>c.id===carId)||CARS[0],pilot=PILOTS.find(p=>p.id===pilotId)||PILOTS[0];
 return {car,pilot,parts:[...parts],condition:clamp(condition,35,100)};
}
export function freshState(config){return {time:0,tires:100,heat:55,focus:config.pilot.focus,study:false,velocity:16,cooldowns:{}};}
export function availableCards(config){return CARDS.filter(c=>(!c.pilot||c.pilot===config.pilot.id)&&(!c.part||config.parts.includes(c.part)));}
export function disabledReason(card,sector,state,config,gap=0){
 if(card.only==='corner'&&sector.type!=='corner')return 'Нужен поворот';
 if(card.only==='straight'&&sector.type!=='straight')return 'Нужна прямая';
 if(card.only==='wet'&&sector.wet<.35)return 'Нужно мокрое покрытие';
 if(card.gap==='behind'&&!(gap>0&&gap<2.5))return 'Нужно отставание от 0 до 2.5 с';
 if(card.gap==='ahead'&&!(gap<0&&gap> -2.5))return 'Нужно лидерство до 2.5 с';
 if(card.gap==='close'&&Math.abs(gap)>2.5)return 'Соперник дальше 2.5 с';
 if((state.cooldowns[card.id]||0)>0)return `Откат: ${state.cooldowns[card.id]} сектор`;
 if(card.focus>state.focus)return `Нужно ${card.focus} концентрации`;
 if(card.id==='late'&&state.heat>155)return 'Тормоза перегреты (>155°C)';
 return '';
}
export function simulate(config,state,sector,card){
 const {car,pilot,parts}=config,has=id=>parts.includes(id),corner=sector.type==='corner';
 // SI units: metric hp -> watts, kg, m/s. A bounded sector approximation,
 // not a wheel-level simulator. Both drivers use exactly this function.
 const mass=car.mass-(has('weight')?65:0)+(has('suspension')?8:0);
 const grip=car.grip*(1-sector.wet*(car.drive==='AWD'?.28:.4))*(has('tires')?(sector.wet>.35?.93:1.12):1)*(has('suspension')?1.05:1)*(.7+.3*state.tires/100)*(.88+.12*config.condition/100);
 const brakeFade=clamp(1-Math.max(0,state.heat-105)/280,.65,1);
 const brake=car.brakes*(has('brakes')?1.18:1)*brakeFade;
 const power=car.power*735.5*.78*(.9+.1*config.condition/100);
 const terminal=Math.cbrt(power/.43);
 const traction=(car.drive==='AWD'?1.09:1)*(has('lsd')?1.05:1);
 const cornerSpeed=corner?Math.sqrt(grip*9.81*sector.radius):terminal;
 const accel=Math.min(grip*9.81*traction,power/(mass*Math.max(state.velocity,18)))-9.81*sector.slope;
 const exit=corner?Math.min(terminal,cornerSpeed+accel*1.5):Math.min(terminal,Math.sqrt(state.velocity**2+2*accel*sector.length));
 const average=corner?cornerSpeed*.87+exit*.13:Math.max(18,(state.velocity+exit)*.5);
 const braking=corner?Math.max(0,state.velocity-cornerSpeed)/(grip*9.81*brake)*.45:0;
 const baseTime=sector.length/average+braking;
 let gain=card.gain*pilot.aggression*(.7+.3*pilot.skill)+(state.study?.015:0);
 if(card.id==='late')gain*=has('brakes')?1.15:brakeFade;
 if(card.id==='weight')gain*=has('suspension')?1.18:1;
 if(card.id==='apexEarly')gain*=sector.radius<50?1.25:-.5;
 if(card.id==='power')gain*=traction*(sector.wet>.35&&car.drive==='FR'&&!has('lsd')?.45:1);
 if(card.id==='safe'&&sector.wet>.35)gain+=.015;
 const risk=clamp(card.risk+sector.wet*.22+(1-pilot.skill)*.3+Math.max(0,65-state.focus)/250+Math.max(0,60-state.tires)/160+Math.max(0,state.heat-110)/320-(has('lsd')&&card.id==='power'?.1:0),0,.85);
 // No dice rolls. Above the safety margin, tire slip causes a visible time loss.
 const slip=Math.max(0,risk-.28)*(corner?5:2.5);
 const time=baseTime*(1-clamp(gain,-.09,.08))+slip;
 const wear=(corner?2.1:1.05)*card.wear*(has('tires')?1.25:1)*(car.drive==='AWD'?1.12:1)*(mass/1100);
 const heat=(corner?12: -10)*(mass/1100)+card.heat;
 const cooled=heat>0?heat*(has('brakes')?.7:1):heat*car.cooling*(has('cooling')?1.3:1);
 const focusCost=card.focus*(pilot.id==='ren'&&card.focus>0?.88:1)*(has('weight')?1.1:1);
 const cooldowns=Object.fromEntries(Object.entries(state.cooldowns).map(([k,v])=>[k,Math.max(0,v-1)]));
 if(['attack','dive','study','thermal'].includes(card.id))cooldowns[card.id]=1;
 const next={time:state.time+time,tires:clamp(state.tires-wear,0,100),heat:clamp(state.heat+cooled,35,200),focus:clamp(state.focus-focusCost,0,pilot.focus),study:card.id==='study',velocity:exit*(slip>0?.92:1),cooldowns};
 const reasons=[corner?`Радиус ${sector.radius} м: предел дуги ${Math.round(cornerSpeed*3.6)} км/ч`:`${car.power} л.с. / ${mass} кг: разгон до ${Math.round(exit*3.6)} км/ч`];
 if(sector.wet>.35)reasons.push(`Мокрое покрытие ${Math.round(sector.wet*100)}%: сцепление снижено`);
 if(brakeFade<1)reasons.push(`Перегрев: эффективность тормозов ${Math.round(brakeFade*100)}%`);
 if(slip>.001)reasons.push(`Предел сцепления превышен: +${slip.toFixed(2)} с`);
 if(state.study)reasons.push('Изучение соперника: +1.5% реализации темпа');
 if(has('brakes')&&card.id==='late')reasons.push('Brembo: эффективнее поздний вход и меньше нагрев');
 if(has('lsd')&&card.id==='power')reasons.push('CUSCO LSD: лучше реализация тяги');
 return {time,next,risk,slip,speed:exit*3.6,gain:baseTime-time,reasons};
}
export function chooseAI(config,state,sector,gap=0){
 return availableCards(config).filter(c=>!disabledReason(c,sector,state,config,gap)).map(card=>{
  const result=simulate(config,state,sector,card);
  const score=result.time+Math.max(0,70-result.next.focus)*.025+Math.max(0,result.next.heat-100)*.018+(100-result.next.tires)*.013;
  return {card,result,score};
 }).sort((a,b)=>a.score-b.score)[0];
}
export function createRace(config,weather='mixed'){
 const rival=configuration('chaser','aki',[],100);
 return {config,rival,weather,index:0,player:freshState(config),opponent:freshState(rival),history:[],finished:false};
}
export function resolveSector(race,cardId){
 if(race.finished)throw new Error('Заезд уже завершён');
 const sector=sectorAt(race.index,race.weather),card=availableCards(race.config).find(c=>c.id===cardId);
 if(!card)throw new Error('Карта недоступна');
 const gap=race.player.time-race.opponent.time,reason=disabledReason(card,sector,race.player,race.config,gap);
 if(reason)throw new Error(reason);
 const ai=chooseAI(race.rival,race.opponent,sector,-gap),player=simulate(race.config,race.player,sector,card);
 // Defending costs the leader time and also delays a nearby pursuer, symmetrically.
 if(card.id==='defend'){ai.result.time+=.35;ai.result.next.time+=.35;}
 if(ai.card.id==='defend'){player.time+=.35;player.next.time+=.35;}
 const row={index:race.index,sector:sector.name,card:card.name,aiCard:ai.card.name,playerTime:player.time,aiTime:ai.result.time,gap:player.next.time-ai.result.next.time,risk:player.risk,speed:player.speed,slip:player.slip,reasons:player.reasons,tires:player.next.tires,heat:player.next.heat,focus:player.next.focus};
 return {...race,index:race.index+1,player:player.next,opponent:ai.result.next,history:[...race.history,row],finished:race.index===7};
}
