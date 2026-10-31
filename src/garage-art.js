import {vehicleSVG} from './vehicles.js';
import {escapeHTML} from './career-view.js';

// The first atlas (2×3) contains AE86, MX-5, S13, RX-7, Evo VI and R34.
// The second atlas (2×2) contains Chaser, Supra, EK9 and NSX.
// R32 intentionally retains its own silhouette: the R34 image is not an R32.
export const GARAGE_ART_IDS = Object.freeze(['ae86','mx5','s13','rx7','evo','chaser','supra','ek9','nsx','r34']);

export function garageArtworkHTML(car) {
  if (!GARAGE_ART_IDS.includes(car.id)) return vehicleSVG(car);
  return '<span class="garage-render garage-render-'+car.id+'" role="img" aria-label="'+escapeHTML(car.name)+'"></span>';
}

export function garageCarsByPrice(cars) {
  return [...cars].sort((a,b)=>a.price-b.price||a.name.localeCompare(b.name));
}
