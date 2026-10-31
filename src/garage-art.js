import {vehicleSVG} from './vehicles.js';
import {escapeHTML} from './career-view.js';

// Full-resolution individual 960×720 WebP portraits. No low-resolution texture atlas.
export const GARAGE_ART_IDS = Object.freeze(["ae86","mx5","s13","rx7","evo","chaser","r32","r34","supra","ek9","nsx"]);

export function garageArtworkHTML(car) {
  if (!GARAGE_ART_IDS.includes(car.id)) return vehicleSVG(car);
  return '<span class="garage-render garage-render-'+car.id+'" role="img" aria-label="'+escapeHTML(car.name)+'"></span>';
}

export function garageCarsByPrice(cars) {
  return [...cars].sort((a,b)=>a.price-b.price||a.name.localeCompare(b.name));
}
