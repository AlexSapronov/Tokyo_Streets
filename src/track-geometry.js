import {getEvent} from './data.js';
// Authored sector boundaries in the existing venue anchors. Distances remain
// simulation distances; they determine travel within a piece, never its shape.
export const SECTOR_ANCHORS={
 haruna:[0,1,3,5,7,8,11,14,15],akagi:[0,1,3,4,6,7,8,10,12,14,15],
 tsukuba:[0,1,3,5,7,8,13],irohazaka:[0,1,3,4,5,6,7,8,9,11,12],
 hakone:[0,1,3,4,5,6,7,9,10],wangan:[0,1,2,4,5,6,7,8,9],nikko:[0,1,3,4,5,7,9,11,12],
 suzuka:[0,2,5,11,14,19,24,29,33,36,40,44,46],fuji:[0,2,5,6,8,11,15,20,23,26,29,32,36]
};
const cache=new WeakMap(),clamp=n=>Math.max(0,Math.min(1,n));
const lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const length=v=>Math.hypot(...v),unit=v=>{const d=length(v)||1;return v.map(n=>n/d);};
function sampler(points){
 let total=0;const distances=[0];for(let i=1;i<points.length;i++)distances.push(total+=length(sub(points[i],points[i-1])));
 return t=>{const distance=clamp(t)*total;let lo=1,hi=distances.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(distances[mid]<distance)lo=mid+1;else hi=mid;}const i=Math.max(1,lo);return lerp(points[i-1],points[i],(distance-distances[i-1])/(distances[i]-distances[i-1]||1));};
}
function hermite(a,b,ta,tb,t){const t2=t*t,t3=t2*t;return a.map((v,k)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*ta[k]+(-2*t3+3*t2)*b[k]+(t3-t2)*tb[k]);}
function legacy(anchors){
 const p=[];for(let i=0;i<anchors.length-1;i++)for(let j=0;j<32;j++){
  const a=anchors[i],b=anchors[i+1],ta=sub(b,anchors[Math.max(0,i-1)]).map(n=>n/2),tb=sub(anchors[Math.min(anchors.length-1,i+2)],a).map(n=>n/2);p.push(hermite(a,b,ta,tb,j/32));
 }p.push(anchors.at(-1));return sampler(p);
}
export function trackGeometry(event){
 if(event.mode==='drift'&&event.streetVenue)return trackGeometry(getEvent(event.venueId));
 if(cache.has(event))return cache.get(event);
 let at,pieces=[];
 if(event.geometrySource){
  const source=trackGeometry(event.geometrySource);at=source.at;pieces=event.sectors.map(s=>({start:s.entry,end:s.exit,type:s.type,at:t=>at(s.entry+(s.exit-s.entry)*clamp(t))}));
 }
 else if(event.visualSegments){pieces=event.visualSegments.map(p=>({...p,at:sampler(p.points)}));at=f=>{const p=pieces.find(p=>clamp(f)<p.end-1e-12)||pieces.at(-1);return p.at((clamp(f)-p.start)/(p.end-p.start));};}
 else if(!['duel','timeattack'].includes(event.mode))at=legacy(event.anchors);
 else{
  const anchors=event.anchors,bounds=SECTOR_ANCHORS[event.id]||event.sectors.map((_,i)=>i*(anchors.length-1)/event.sectors.length).concat(anchors.length-1);
  const anchor=i=>{const lo=Math.floor(i);return lerp(anchors[lo],anchors[Math.min(anchors.length-1,lo+1)],i-lo);};
  const ends=bounds.map(anchor),closed=length(sub(ends[0],ends.at(-1)))<.001;
  // Adjacent straight sectors are one line, with their boundary placed by distance.
  for(let i=0;i<event.sectors.length;i++)if(event.sectors[i].type==='straight'){
   let end=i;while(event.sectors[end+1]?.type==='straight')end++;
   const total=event.sectors.slice(i,end+1).reduce((n,s)=>n+s.length,0);let done=0;
   for(let j=i+1;j<=end;j++){done+=event.sectors[j-1].length;ends[j]=lerp(ends[i],ends[end+1],done/total);}i=end;
  }
  const tangent=i=>{
   const prev=event.sectors[i-1]||(closed?event.sectors.at(-1):null),next=event.sectors[i]||(closed?event.sectors[0]:null);
   if(prev?.type==='straight'){const k=i||event.sectors.length;return sub(ends[k],ends[k-1]);}
   if(next?.type==='straight'){const k=i===event.sectors.length?0:i;return sub(ends[k+1],ends[k]);}
   const k=Math.round(bounds[i]);return sub(anchors[Math.min(anchors.length-1,k+1)],anchors[Math.max(0,k-1)]);
  };
  const total=event.sectors.reduce((n,s)=>n+s.length,0);let distance=0;
  for(let i=0;i<event.sectors.length;i++){
   const sector=event.sectors[i],a=ends[i],b=ends[i+1];let sample;
   if(sector.type==='straight')sample=t=>lerp(a,b,clamp(t));
   else{
    let knots=[a,...anchors.filter((_,j)=>j>bounds[i]&&j<bounds[i+1]),b];
    const chord=sub(b,a),d=length(chord),deviation=Math.max(...knots.map(p=>Math.abs(chord[0]*(p[1]-a[1])-chord[1]*(p[0]-a[0]))/(d||1)));
    if(knots.length===2&&deviation<.001){const mid=lerp(a,b,.5),v=unit(chord);knots=[a,[mid[0]-v[1]*d*.12,mid[1]+v[0]*d*.12],b];}
    const points=[];
    for(let j=0;j<knots.length-1;j++){
     const p=knots[j],q=knots[j+1],span=length(sub(q,p));
     const ta=j===0?unit(tangent(i)).map(n=>n*span):sub(q,knots[j-1]).map(n=>n/2);
     const tb=j===knots.length-2?unit(tangent(i+1)).map(n=>n*span):sub(knots[j+2],p).map(n=>n/2);
     for(let n=0;n<32;n++)points.push(hermite(p,q,ta,tb,n/32));
    }points.push(b);sample=sampler(points);
   }
   const start=distance/total;distance+=sector.length;pieces.push({start,end:distance/total,type:sector.type,at:sample});
  }
  at=progress=>{const f=clamp(progress),piece=pieces.find(p=>f<p.end-1e-12)||pieces.at(-1);return piece.at((f-piece.start)/(piece.end-piece.start||1));};
 }
 const result={at,pieces,route:Array.from({length:801},(_,i)=>at(i/800))};cache.set(event,result);return result;
}
