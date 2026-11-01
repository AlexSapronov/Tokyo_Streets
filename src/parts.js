import {PARTS} from './data.js';
const byId=new Map(PARTS.map(p=>[p.id,p]));
export const partFamily=id=>byId.get(id)?.family||id;
export function partFor(parts,family){
 if(parts.includes(family))return byId.get(family);
 for(const id of parts){const part=byId.get(id);if(part?.family===family)return part;}
}
export const hasPart=(parts,family)=>parts.includes(family)||parts.some(id=>byId.get(id)?.family===family);
// Physics capabilities are temporary aliases; inventory, prices and wear keep actual IDs.
export const partCapabilities=parts=>[...new Set(parts.flatMap(id=>[id,partFamily(id)]))];
export const SLOT_LABELS={tires:'ШИНЫ',final:'ГЛАВНАЯ ПАРА',ecu:'ЭБУ',turbo:'ТУРБОКОМПЛЕКТ',cooling:'МАСЛОКУЛЕР',aero:'ЗАДНЕЕ КРЫЛО',splitter:'ПЕРЕДНИЙ ОБВЕС'};
