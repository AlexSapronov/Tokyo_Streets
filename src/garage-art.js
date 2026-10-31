import {vehicleSVG} from './vehicles.js';
import {escapeHTML} from './career-view.js';

// Each image in the WebP atlas occupies one cell of a 2 × 3 grid.
// The final R34 render is retained in the atlas for future use, but not
// displayed for BNR32: those are different vehicles.
export const GARAGE_ART_IDS = Object.freeze(['ae86','mx5','s13','rx7','evo']);

export function garageArtworkHTML(car) {
  if (!GARAGE_ART_IDS.includes(car.id)) return vehicleSVG(car);
  return '<span class="garage-render garage-render-'+car.id+'" role="img" aria-label="'+escapeHTML(car.name)+'"></span>';
}

export function garageCarsByPrice(cars) {
  return [...cars].sort((a,b)=>a.price-b.price||a.name.localeCompare(b.name));
}
