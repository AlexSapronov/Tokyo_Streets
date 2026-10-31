// Repeatable comparison, not a win-rate model: no rival, fresh stock cars/Ren.
import {configuration,createRace,simulate,availableCards,disabledReason} from '../src/engine.js';
import {sectorAt,getEvent} from '../src/data.js';
import {SERVICE_RATE} from '../src/balance.js';
import {executionRoll} from '../src/execution.js';
const rows=[];
for(const car of ['ae86','chaser','evo'])for(const weather of ['dry','rain'])for(const strategy of ['full','thermal']){
 let total=0,finishes=0,dnf=0,heat=0,focus=0,wear=0;
 for(let seed=0;seed<128;seed++){
  const config=configuration(car,'ren');let state=createRace(config,weather,'yokohama-mile',null,seed).player;
  for(let i=0;i<getEvent('yokohama-mile').sectors.length;i++){
   const sector=sectorAt(i,weather,'yokohama-mile');
   const intended={prep:'drag-burnout',launch:'drag-soft',shifts:'drag-band',pull:strategy==='thermal'&&i===4?'drag-cooling':'drag-sustain',finish:'drag-push'}[sector.phase];
   const cards=availableCards(config,'drag','yokohama-mile');
   const card=cards.find(c=>c.id===intended&&!disabledReason(c,sector,state,config))||cards.find(c=>!disabledReason(c,sector,state,config));
   state=simulate(config,state,sector,card,executionRoll(seed,i,'player',state.focus)).next;
   if(state.dnf)break;
  }
  if(state.dnf){dnf++;continue;}
  finishes++;total+=state.time;heat+=state.heat;focus+=state.focus;wear+=100-state.tires;
 }
 rows.push({car,weather,strategy,finishes,dnf,seconds:+(total/finishes).toFixed(3),heat:+(heat/finishes).toFixed(1),focus:+(focus/finishes).toFixed(1),serviceYen:+(wear/finishes*.55*SERVICE_RATE).toFixed(0)});
}
console.table(rows);
console.log('1536 runs; 128 shared seeds per scenario, fresh stock cars/Ren, no rival. Resource restrictions can replace an unavailable action with the first legal card.');
