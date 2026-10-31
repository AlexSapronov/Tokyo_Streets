import {CARS,PILOTS,EVENTS,sectorAt} from '../src/data.js';
import {configuration,createRace,chooseAI,resolveSector,futureSectors,raceOutcome} from '../src/engine.js';
import {SERVICE_RATE} from '../src/balance.js';
const rows=[];
for(const event of EVENTS){
 let runs=0,dnf=0,wins=0,gold=0,time=0,points=0,focus=0,repair=0,payout=0;
 for(const car of CARS)for(const pilot of PILOTS)for(const weather of ['dry','rain'])for(const seed of [0,42,173,921]){
  let race=createRace(configuration(car.id,pilot.id),weather,event.id,null,seed);
  while(!race.finished){const card=chooseAI(race.config,race.player,sectorAt(race.index,weather,event.id),race.opponent.dnf?Infinity:race.player.time-race.opponent.time,futureSectors(race)).card;race=resolveSector(race,card.id);}
  const outcome=raceOutcome(race);runs++;dnf+=!!race.player.dnf;wins+=!!outcome.won;gold+=outcome.medal==='gold';time+=race.player.time;points+=race.player.drift?.score||0;focus+=race.player.focus;payout+=outcome.reward;
  repair+=Math.min(65,(race.player.dnf?.damage||0)+(100-race.player.tires)*.55+race.history.reduce((sum,row)=>sum+row.slip,0)*.5)*SERVICE_RATE;
 }
 rows.push({event:event.id,runs,dnf,wins,gold,meanSeconds:+(time/runs).toFixed(2),meanPoints:+(points/runs).toFixed(1),meanFocus:+(focus/runs).toFixed(1),meanPrize:Math.round(payout/runs),meanRepair:Math.round(repair/runs)});
}
console.table(rows);
console.log('Fresh stock cars, all pilots, dry/rain, 4 shared seeds per scenario. No repeat-payout reduction, manager salary or upgrades. Descriptive paired comparison, insufficient to estimate rare DNF rates.');
