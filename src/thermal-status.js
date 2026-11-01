// The road model and its instruments share the same fade thresholds.
export const ROAD_LIMITS=Object.freeze({brakes:105,oil:125,coolant:105});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function roadHeatEffects(data){return {brakes:clamp(1-Math.max(0,data.brakes-ROAD_LIMITS.brakes)/280,.65,1),power:clamp(1-Math.max(0,data.oil-ROAD_LIMITS.oil)/120-Math.max(0,data.coolant-ROAD_LIMITS.coolant)/100,.65,1)};}
export function thermalStatus(data,mode='duel'){
 const road=['duel','timeattack'].includes(mode),effects=roadHeatEffects(data),lamps={coolant:data.coolant>105,oil:data.oil>(road?125:mode==='drag'?105:115),brakes:road&&data.brakes>105,tireTemp:mode==='drift'?data.tireTemp>95:mode==='drag'&&data.tireTemp>110},messages=[];
 if(road&&effects.brakes<1)messages.push('Нагрев тормозов: осталось '+Math.round(effects.brakes*100)+'% тормозного потенциала. Остуди тормоза; прямая помогает обдуву.');
 if(road&&effects.power<1)messages.push('При текущем нагреве доступно '+Math.round(effects.power*100)+'% мощности. Снизь тепловую нагрузку.');
 if(mode==='drag'&&lamps.oil)messages.push('Мотор выше 105°C: доступная мощность снижена. Выбери бережный режим.');
 if(mode==='drag'&&lamps.tireTemp)messages.push('Шины перегреты для старта: проверь прогрев и покрытие.');
 if(mode==='drift'&&lamps.oil)messages.push('Мотор выше 115°C: растёт риск срыва. Стабилизируй машину.');
 if(mode==='drift'&&lamps.tireTemp)messages.push('Шины выше 95°C: сцепление снижается. Стабилизируй машину для охлаждения.');
 if(data.tires<60)messages.push('Шины изношены: сцепление снижено. Береги ресурс.');
 return {lamps,messages,brakeText:road?'Тормозной потенциал от температуры '+Math.round(effects.brakes*100)+'%':'Температура тормозов',engineText:road?'Доступная мощность '+Math.round(effects.power*100)+'%':mode==='drag'?'Потеря мощности начинается после 105°C':'После 115°C растёт риск срыва',tireText:mode==='drift'?'После 95°C падает сцепление':mode==='drag'?'Температура влияет на стартовое сцепление; рабочее окно зависит от покрытия':'На дороге температура шин — телеметрия; сцепление зависит от состава, покрытия и ресурса'};
}
