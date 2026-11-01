export const SECTOR_COLORS=['#ffab78','#8cc9f0','#a6c8b5'];
// Lines change geometry and exit speed, not the execution roll. Neutral preserves legacy physics.
export const RACING_LINES=[
 {id:'neutral',name:'Классическая',description:'Ровная дуга. Базовая длина и скорость выхода.'},
 {id:'late-apex',name:'Поздний апекс',description:'Дольше в повороте, быстрее выход. Полезно перед прямой; на мокром нужна тяга.'},
 {id:'inside',name:'Короткая внутренняя',description:'Меньше путь, теснее дуга и медленнее выход. Полезна в тесной связке.'},
 {id:'wide-exit',name:'Широкая дуга',description:'Больше радиус и путь, выше нагрузка на шины. Полезна в быстрых поворотах.'}
];
export const roadMode=mode=>['duel','timeattack'].includes(mode);
export function lineReason(id,sector){
 if(!RACING_LINES.some(line=>line.id===id))return 'Неизвестная траектория';
 if(id!=='neutral'&&(!roadMode(sector.mode)||sector.type!=='corner'))return 'Траектория выбирается только в дорожном повороте';
 return '';
}
export function lineGeometry(id,sector,car){
 if(!id||id==='neutral')return {length:1,radius:1,exit:1,risk:0,wear:1};
 const powerWeight=car.power/car.mass;
 if(id==='late-apex')return {length:1.025,radius:1,exit:1.18+Math.min(.06,powerWeight*.2),risk:.025+sector.wet*.025,wear:1.04};
 if(id==='inside')return {length:sector.radius<50?.88:.97,radius:.86,exit:.88,risk:.015,wear:1.08};
 if(id==='wide-exit')return {length:1.045,radius:1.14,exit:1.025,risk:.04+sector.wet*.045,wear:1.2};
 throw new Error('Неизвестная траектория');
}
export function lineCard(card,id='neutral'){return {...card,lineId:id};}
export function lineName(id){return RACING_LINES.find(line=>line.id===id)?.name||'Классическая';}
export function lineFrame(record,elapsed){
 if(!record.lines?.length)return {offset:0,yaw:0};
 let total=0;
 for(let i=0;i<record.sectorTimes.length;i++){
  const duration=record.sectorTimes[i];
  if(elapsed<=total+duration){
   const t=Math.max(0,Math.min(1,(elapsed-total)/Math.max(.001,duration)));
   const phase=Math.sin(Math.PI*t),id=record.lines[i];
   return {offset:(id==='inside'?-5:id==='wide-exit'?6:id==='late-apex'?Math.cos(Math.PI*t)*5:0)*phase,yaw:(id==='late-apex'?.1:id==='inside'?-.07:0)*phase};
  }
  total+=duration;
 }
 return {offset:0,yaw:0};
}
