import {getEvent,sectorAt} from './data.js';
import {RACING_LINES,lineReason,roadMode} from './racing-lines.js';
export function racingLinesHTML(race,selected,busy){
 if(!roadMode(race.mode))return '';
 const sector=sectorAt(race.index,race.weather,race.eventId,race.routeVersion),event=getEvent(race.eventId,race.routeVersion);
 return `<section class="racing-plan" aria-label="План связки"><div class="upcoming-sectors">${event.sectors.slice(race.index,race.index+3).map((_,offset)=>{
 const s=sectorAt(race.index+offset,race.weather,race.eventId,race.routeVersion);
 return `<div class="${offset===0?'current':''}"><span class="micro">${offset===0?'СЕЙЧАС · '+(race.index+1)+'/'+event.sectors.length:'ДАЛЕЕ +'+offset} · ${s.type==='corner'?'ПОВОРОТ':'ПРЯМАЯ'}</span><strong>${s.name}</strong><span>${s.label} · ${Math.round(s.length)} м${s.radius?' · R '+s.radius+' м':''}${s.nextRadius?' · следующий поворот R '+s.nextRadius+' м':''} · влажность ${Math.round(s.wet*100)}%</span></div>`;
 }).join('')}</div><fieldset class="line-options"><legend>1. Траектория · ${sector.type==='corner'?'выбери линию поворота; она влияет и на следующий участок':'на прямой — классическая линия'}</legend>${RACING_LINES.map(line=>{
 const reason=lineReason(line.id,sector);
 return `<button class="secondary ${selected===line.id?'selected':''}" data-line="${line.id}" aria-pressed="${selected===line.id}" ${busy||reason?'disabled':''} title="${reason||line.description}"><strong>${line.name}</strong><span>${line.description}</span></button>`;
 }).join('')}</fieldset></section>`;
}
