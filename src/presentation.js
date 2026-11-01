import {CARDS,getEvent} from './data.js';
import {ALL_DRAG_CARDS} from './drag-data.js';
import {DRIFT_CARDS} from './drift-data.js';
import {SKILL_CARDS} from './player.js';
import {replayIndex,driftFrame} from './replay.js';
import {lineFrame,lineName} from './racing-lines.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const actions=[...CARDS,...ALL_DRAG_CARDS,...DRIFT_CARDS,...SKILL_CARDS];
export function presentationRecord(race,opponent=false){
 const rows=opponent?race.history.filter(row=>row.aiTime!==null):race.history;
 return {routeVersion:race.routeVersion,sectorTimes:rows.map(row=>opponent?row.aiTime:row.playerTime),actions:rows.map(row=>opponent?row.aiCardId:row.cardId),lines:rows.map(row=>opponent?row.aiLineId:row.lineId),slips:rows.map(row=>opponent?row.aiSlip:row.slip),telemetry:opponent?null:rows.map(row=>row.telemetry),drift:opponent?null:race.player.drift};
}
// Read recorded outcomes only. Presentation never calls physics or chooses an action.
export function presentationFrame(record,elapsed,eventId){
 const idle={offset:0,lineOffset:0,position:0,yaw:0,braking:false,smoke:0,marks:0,throttle:0,rpm:900,gear:0,cue:'',actionName:'',lineName:''};
 if(!record?.sectorTimes?.length)return idle;
 const index=replayIndex(record.sectorTimes,elapsed),sector=getEvent(eventId,record.routeVersion).sectors[index];if(!sector)return idle;
 const start=record.sectorTimes.slice(0,index).reduce((n,t)=>n+t,0),fraction=clamp((elapsed-start)/Math.max(.001,record.sectorTimes[index]),0,1),phase=Math.sin(Math.PI*fraction);
 const card=actions.find(c=>c.id===record.actions?.[index]),id=card?.id||'',line=lineFrame(record,elapsed),drift=driftFrame(record,elapsed);
 const slip=record.slips?.[index]||0,to=record.telemetry?.[index],from=record.telemetry?.[Math.max(0,index-1)];
 const braking=fraction<.32&&(id==='late'||id==='defend'||card?.method==='brake'||sector.type==='corner'&&(from?.speed||0)>(to?.speed||0)+3);
 const positional=id==='draft'?18:id==='defend'?7:['dive','skill-feint'].includes(id)?-6:0;
 const release=['power','skill-release','drift-exitpower'].includes(id);
 const yaw=drift?.yaw??line.yaw+(id==='weight'?Math.sin(fraction*Math.PI*2)*.11:0);
 const smoke=clamp((slip>.05?slip*.8:0)+(drift?.clip.valid?Math.abs(yaw)*.45:0)+(id==='drag-burnout'?.8:0),0,1);
 const gearFrom=index?from?.gear||0:0,gearTo=to?.gear||gearFrom;
 const gear=gearTo>=gearFrom?gearFrom+Math.floor((gearTo-gearFrom)*fraction):fraction<.5?gearFrom:gearTo;
 const rpm=to?clamp((from?.rpm||900)+((to.rpm||900)-(from?.rpm||900))*fraction,0,10000):900;
 const cue=slip>.05?'Потеря сцепления':drift?.clip.spin?'Разворот':braking?'Торможение':id==='defend'?'Защита линии':id==='draft'?'В слипстриме':['dive','skill-feint'].includes(id)?'Попытка обгона':release&&fraction>.5?'Выход на тяге':drift?.clip.valid?'Контроль заноса':id==='drag-burnout'?'Прогрев шин':'Исполнение приёма';
 return {index,fraction,lineId:record.lines?.[index]||'neutral',offset:line.offset+positional*phase,lineOffset:line.offset,position:positional*phase,yaw,braking,smoke,marks:smoke*phase,throttle:braking?.2:release?.95:card?.focus<0?.35:.7,rpm,gear,cue,actionName:card?.name||'Сохранённый приём',lineName:record.lines?.[index]?lineName(record.lines[index]):'',slip,wet:sector.wet||0};
}

// Positive normal points into a positive turn. Keep explicit inside/outside choices
// independent of the permanent separation used to distinguish the two cars.
export function racingLane(base,frame,turn,mode='duel'){
 if(!['duel','timeattack'].includes(mode))return base+(frame.lineOffset||0)*turn+(frame.position||0)*-Math.sign(base||-1);
 const phase=Math.sin(Math.PI*(frame.fraction||0)),chosen=frame.lineId?frame.lineId!=='neutral':Math.abs(frame.lineOffset||0)>.001;
 const separation=base*(chosen?1-.75*phase:1);
 return separation-(frame.lineOffset||0)*turn*2.4+(frame.position||0)*-Math.sign(base||-1);
}
