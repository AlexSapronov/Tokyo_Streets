// Paired deterministic resource audit; no execution RNG or incidents.
import {CARS,CARDS,EVENTS,sectorAt} from '../src/data.js';
import {configuration,freshState,simulate,disabledReason} from '../src/engine.js';
export function resourceAudit(){
 const rows=[];
 for(const event of EVENTS.filter(e=>['duel','timeattack'].includes(e.mode)))
 for(const car of CARS)for(const tire of ['stock','streetTires','tires','slicks','wetTires'])
 for(const weather of ['dry','rain'])for(const policy of ['balanced','varied','preserve']){
  const config=configuration(car.id,'ren',tire==='stock'?[]:[tire]);
  let state=freshState(config),peakHeat=state.heat;
  for(let i=0;i<event.sectors.length;i++){
   const sector=sectorAt(i,weather,event.id);
   const id=policy==='varied'?['attack','apexEarly','breathe','power','balanced','apex','safe','weight'][i%8]:policy;
   let card=CARDS.find(c=>c.id===id);
   if(disabledReason(card,sector,state,config,Infinity))card=CARDS[0];
   state=simulate(config,state,sector,card).next;peakHeat=Math.max(peakHeat,state.heat);
  }
  rows.push({event:event.id,car:car.id,tire,weather,policy,wear:100-state.tires,peakHeat,time:state.time});
 }
 return rows;
}
const rows=resourceAudit();
if(process.argv.includes('--json'))console.log(JSON.stringify(rows));
else{
 console.table(EVENTS.filter(e=>['duel','timeattack'].includes(e.mode)).map(event=>{
  const runs=rows.filter(r=>r.event===event.id&&r.tire==='slicks'&&r.weather==='dry'&&r.policy==='varied');
  return {event:event.id,runs:runs.length,minWear:+Math.min(...runs.map(r=>r.wear)).toFixed(1),maxWear:+Math.max(...runs.map(r=>r.wear)).toFixed(1),maxBrakeIndex:+Math.max(...runs.map(r=>r.peakHeat)).toFixed(1)};
 }));
 console.log(`${rows.length} paired runs: all road tracks/cars, five compounds, dry/rain, neutral/varied/repeated preservation. Fresh hardware, Ren, neutral line, no incidents. Wear is percentage points; temperatures are gameplay indices, not measured disc temperatures. --json exports every run.`);
}
