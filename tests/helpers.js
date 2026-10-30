import {getEvent,sectorAt} from '../src/data.js';
import {createRace,chooseAI,futureSectors,resolveSector} from '../src/engine.js';
export function finishRace(config,weather='mixed',eventId='haruna',actions=null,runId=null) {
  let race=createRace(config,weather,eventId,runId);
  while(!race.finished){
    const action=actions?.[race.index]||chooseAI(config,race.player,
      sectorAt(race.index,weather,eventId),race.player.time-race.opponent.time,futureSectors(race)).card.id;
    race=resolveSector(race,action);
  }
  return race;
}
export function assertState(assert,race) {
  assert.equal(race.history.length,getEvent(race.eventId).sectors.length);
  for(const state of [race.player,race.opponent]){
    assert.ok(Number.isFinite(state.time)&&state.time>=0);
    assert.ok(Number.isFinite(state.velocity)&&state.velocity>=0);
    assert.ok(state.tires>=0&&state.tires<=100);
    assert.ok(state.heat>=35&&state.heat<=200);
    assert.ok(state.focus>=0&&state.focus<=110);
  }
}
export function generator(seed=42){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
