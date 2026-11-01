// Strict presentation-only metadata. Never re-awards a prize or simulates a race.
export function validateGridReplay(raw,count,lapSectors){
 if(raw?.version!==1||!Number.isInteger(raw.rank)||raw.rank<1||raw.rank>4||!Array.isArray(raw.pits)||raw.pits.length>2||raw.pits.some((n,i)=>![lapSectors,lapSectors*2].includes(n)||raw.pits.indexOf(n)!==i)||raw.rivals?.length!==3)return null;
 const ids=['kei','rika','daichi'],cars=['evo','rx7','nsx'],rivals=[];
 for(let i=0;i<3;i++){
  const e=raw.rivals[i],n=e?.sectorTimes?.length;if(!Array.isArray(e?.pits)||e.pits.length>2||e.pits.some((p,j)=>![lapSectors,lapSectors*2].includes(p)||p>=n||e.pits.indexOf(p)!==j))return null;
  if(e?.id!==ids[i]||e.carId!==cars[i]||!n||n>count||(!e.dnf&&n!==count)||e.sectorTimes.some(t=>!Number.isFinite(t)||t<=0||t>1000)||!Array.isArray(e.actions)||e.actions.length!==n||!Array.isArray(e.lines)||e.lines.length!==n||e.actions.some(x=>typeof x!=='string'||x.length>60)||e.lines.some(x=>!['neutral','inside','late-apex','wide-exit'].includes(x))||!Array.isArray(e.slips)||e.slips.length!==n||e.slips.some(x=>!Number.isFinite(x)||x<0||x>50))return null;
  rivals.push({id:e.id,carId:e.carId,pits:[...e.pits],sectorTimes:[...e.sectorTimes],actions:[...e.actions],lines:[...e.lines],slips:[...e.slips],...(e.dnf?{dnf:true}:{})});
 }
 return {version:1,pits:[...raw.pits],rank:raw.rank,rivals};
}
