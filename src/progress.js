import {settleCup} from './championship.js';
import {setupKey} from './setup.js';
import {teamAfterRace} from './team.js';
import {getEvent} from './data.js';
import {raceOutcome} from './engine.js';

export const MODEL_VERSION = 4;
export function recordKey(config, eventId, weather) {
  // Condition is shown alongside the record rather than fragmenting each service
  // interval into a leaderboard with no opportunity to race one's own ghost.
  return [getEvent(eventId).mode==='drift'?'drift-2':getEvent(eventId).mode==='drag'?'drag-2':MODEL_VERSION, eventId, weather, config.car.id, config.pilot.id,
    ([...config.parts].sort().join(',') || 'stock')+(setupKey(config.setup)?';setup='+setupKey(config.setup):'')].join('|');
}
export function unlocked(event, career) {
  return career.street >= event.unlockStreet && career.races >= event.unlockRaces;
}
export function unlockText(event) {
  return event.unlockStreet ? `Street Cred ${event.unlockStreet}` : `${event.unlockRaces} завершённых заезда`;
}
export function bestFor(career, config, eventId, weather) {
  const key = recordKey(config, eventId, weather);
  return career.bests.find(best => best.key === key) || null;
}
export function raceRecord(race) {
  return {key: recordKey(race.config, race.eventId, race.weather),...(setupKey(race.config.setup)?{setup:{...race.config.setup}}:{}),
    ...(race.player.dnf?{dnf:{...race.player.dnf}}:{}),
    ...(Number.isInteger(race.seed)?{seed:race.seed,executionVersion:1}:{}),
    eventId: race.eventId, weather: race.weather, carId: race.config.car.id,
    pilotId: race.config.pilot.id, parts: [...race.config.parts],
    condition: race.config.condition, time: race.player.time,
    sectorTimes: race.history.map(row => row.playerTime),
    actions: race.history.map(row => row.cardId),
    ...(race.history.every(row=>row.telemetry)?{telemetry:race.history.map(row=>({...row.telemetry}))}:{}),
    ...(race.manager?{manager:{pilotId:race.config.pilot.id,level:race.manager.level||0,trust:race.manager.trust,fee:race.manager.fee,log:structuredClone(race.manager.log)}}:{}),
    ...(race.mode==='drag'?{drag:structuredClone(race.player.drag)}:race.mode==='drift'?{drift:structuredClone(race.player.drift)}:{})};
}
export function awardRace(career, race) {
  if (!race.finished || race.awarded || race.runId && career.awardedRuns.includes(race.runId)) throw new Error('Этот заезд нельзя наградить повторно');
  const outcome = raceOutcome(race);
  const record = raceRecord(race);
  const previous = bestFor(career, race.config, race.eventId, race.weather);
  const improved=!previous||(race.mode==='drift'?record.drift.score>previous.drift.score||record.drift.score===previous.drift.score&&record.time<previous.time:record.time<previous.time);
  const isBest = !race.player.dnf && !race.player.drag?.falseStart && improved;
  let next = structuredClone(career);
  const debtPaid=Math.min(next.repairDebt||0,Math.floor(outcome.reward*.5));
  next.repairDebt=(next.repairDebt||0)-debtPaid;
  next.money += outcome.reward-debtPaid;
  if(!race.player.dnf){next.races++;next.eventCompletions={...next.eventCompletions,[race.eventId]:(next.eventCompletions?.[race.eventId]||0)+1};}
  if(race.runId)next.awardedRuns=[...next.awardedRuns,race.runId].slice(-256);
  if (outcome.won) next.wins++;
  next.street += outcome.street;
  next.official += outcome.official;
  next.condition[race.config.car.id] = Math.max(35,
    race.config.condition - (race.player.dnf?.damage||0) - (100 - race.player.tires) * .55
    - race.history.reduce((sum, row) => sum + row.slip, 0) * .5);
  if (isBest) next.bests = [record, ...next.bests.filter(best => best.key !== record.key)].slice(0, 120);
  next.records.unshift({car: race.config.car.name, time: record.time, won: outcome.won,
    eventId: race.eventId, weather: race.weather, medal: outcome.medal,...(race.player.dnf?{dnf:true}:{}),
    ...(race.mode==='drag'?{falseStart:race.player.drag.falseStart}:race.mode==='drift'?{score:race.player.drift.score}:{})});
  next.records = next.records.slice(0, 30);
  // Preserve the legacy all-build Haruna statistic for old saves.
  if (!race.player.dnf && race.eventId === 'haruna') next.best = next.best === null ? record.time : Math.min(next.best, record.time);
  const teamResult=teamAfterRace(next.team,race,outcome);next.team=teamResult.team;
  const season=settleCup(next,race);next=season.career;
  return {career: next, race: {...race, awarded: true, outcome, debtPaid, isBest,...(season.report?{seasonReport:season.report}:{}),...(teamResult.feedback?{teamFeedback:teamResult.feedback}:{})}, isBest};
}
export function checkpointFractions(eventId) {
  const sectors = getEvent(eventId).sectors;
  const total = sectors.reduce((sum, sector) => sum + sector.length, 0);
  let distance = 0;
  return [0, ...sectors.map(sector => (distance += sector.length) / total)];
}
export function progressAtTime(sectorTimes, elapsed, eventId) {
  if (!sectorTimes?.length || elapsed <= 0) return 0;
  const checkpoints = checkpointFractions(eventId);
  let time = 0;
  for (let i = 0; i < sectorTimes.length; i++) {
    if (elapsed <= time + sectorTimes[i]) {
      const fraction = (elapsed - time) / sectorTimes[i];
      return checkpoints[i] + fraction * (checkpoints[i + 1] - checkpoints[i]);
    }
    time += sectorTimes[i];
  }
  return checkpoints[sectorTimes.length];
}
export function cumulativeTimes(times) {
  let elapsed = 0;
  return times.map(time => elapsed += time);
}
