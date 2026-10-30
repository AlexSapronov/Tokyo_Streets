import {CARS, PILOTS, PARTS, CARDS, EVENTS, getEvent} from './data.js';
import {configuration} from './engine.js';
import {recordKey} from './progress.js';

// Keep the storage key: v0.1 players migrate in place without losing purchases.
export const SAVE_KEY = 'tokyo-streets-v1';
export function newCareer() {
  return {version: 2, money: 80000, car: 'ae86', pilot: 'ren', ownedCars: ['ae86'],
    builds: {ae86: [], chaser: [], evo: []}, purchased: {ae86: [], chaser: [], evo: []},
    condition: {ae86: 100, chaser: 100, evo: 100}, races: 0, wins: 0,
    street: 0, official: 0, best: null, weather: 'mixed', eventId: 'haruna',
    helpSeen: false, records: [], bests: [], ghostEnabled: true};
}
const validCar = id => CARS.some(car => car.id === id);
const validPart = id => PARTS.some(part => part.id === id);
const validPilot = id => PILOTS.some(pilot => pilot.id === id);
const validWeather = value => ['dry', 'mixed', 'rain'].includes(value);
const validEvent = id => EVENTS.some(event => event.id === id);
const finite = value => Number.isFinite(value);
const list = value => Array.isArray(value) ? value : [];
const unique = values => [...new Set(values)];
function validateRecord(record) {
  if (!record || !validEvent(record.eventId) || !validCar(record.carId)
      || !validPilot(record.pilotId) || !validWeather(record.weather)) return null;
  const count = getEvent(record.eventId).sectors.length;
  if (!Array.isArray(record.sectorTimes) || record.sectorTimes.length !== count
      || record.sectorTimes.some(time => !finite(time) || time <= 0 || time > 1000)) return null;
  if (!Array.isArray(record.actions) || record.actions.length !== count
      || record.actions.some(id => !CARDS.some(card => card.id === id))) return null;
  const total = record.sectorTimes.reduce((sum, time) => sum + time, 0);
  if (!finite(record.time) || Math.abs(total - record.time) > .001) return null;
  const parts = unique(list(record.parts).filter(validPart));
  const config = configuration(record.carId, record.pilotId, parts, finite(record.condition) ? record.condition : 100);
  return {key: recordKey(config, record.eventId, record.weather), eventId: record.eventId,
    weather: record.weather, carId: record.carId, pilotId: record.pilotId, parts,
    condition: config.condition, time: total, sectorTimes: [...record.sectorTimes], actions: [...record.actions]};
}
export function validateSave(raw) {
  if (!raw || ![1, 2].includes(raw.version)) throw new Error('Неподдерживаемое сохранение');
  const out = newCareer();
  out.money = finite(raw.money) ? Math.max(0, Math.min(1e9, raw.money)) : 80000;
  out.ownedCars = unique(['ae86', ...list(raw.ownedCars).filter(validCar)]);
  out.car = out.ownedCars.includes(raw.car) ? raw.car : 'ae86';
  out.pilot = validPilot(raw.pilot) ? raw.pilot : 'ren';
  for (const car of CARS) {
    out.purchased[car.id] = unique(list(raw.purchased?.[car.id]).filter(validPart));
    out.builds[car.id] = unique(list(raw.builds?.[car.id]).filter(id => out.purchased[car.id].includes(id)));
    out.condition[car.id] = finite(raw.condition?.[car.id])
      ? Math.max(35, Math.min(100, raw.condition[car.id])) : 100;
  }
  for (const key of ['races', 'wins', 'street', 'official']) {
    out[key] = finite(raw[key]) ? Math.max(0, Math.floor(raw[key])) : 0;
  }
  out.best = finite(raw.best) && raw.best > 0 ? raw.best : null;
  out.weather = validWeather(raw.weather) ? raw.weather : 'mixed';
  out.eventId = validEvent(raw.eventId) ? raw.eventId : 'haruna';
  out.helpSeen = raw.helpSeen === true;
  out.ghostEnabled = raw.ghostEnabled !== false;
  out.records = list(raw.records).slice(0, 30)
    .filter(record => record && finite(record.time) && record.time > 0 && typeof record.won === 'boolean')
    .map(record => ({car: CARS.find(car => car.name === record.car)?.name || CARS[0].name,
      time: record.time, won: record.won, eventId: validEvent(record.eventId) ? record.eventId : 'haruna',
      weather: validWeather(record.weather) ? record.weather : 'mixed',
      medal: ['gold', 'silver', 'bronze'].includes(record.medal) ? record.medal : null}));
  // v1 records have no trace. Keep their history, but do not invent ghosts.
  const valid = list(raw.bests).slice(0, 120).map(validateRecord).filter(Boolean);
  const bestByKey = new Map();
  for (const record of valid) {
    if (!bestByKey.has(record.key) || bestByKey.get(record.key).time > record.time) bestByKey.set(record.key, record);
  }
  out.bests = [...bestByKey.values()];
  return out;
}
export function loadCareer(storage) {
  try { const data = storage.getItem(SAVE_KEY); return data ? validateSave(JSON.parse(data)) : newCareer(); }
  catch { return newCareer(); }
}
export function storeCareer(storage, career) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(career)); return true; }
  catch { return false; }
}
