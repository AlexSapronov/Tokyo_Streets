import {trackGeometry} from './track-geometry.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function segmentRoad(event){
 const geometry=trackGeometry(event),total=event.sectors.reduce((n,s)=>n+s.length,0),n=Math.max(1000,Math.ceil(total/2)),step=total/n;
 const points=Array.from({length:n+1},(_,i)=>geometry.at(i/n));
 const heading=points.map((_,i)=>{const a=points[Math.max(0,i-2)],b=points[Math.min(n,i+2)];return Math.atan2(b[1]-a[1],b[0]-a[0]);});
 const half=Math.max(2,Math.round(10/step)),curvature=heading.map((_,i)=>Math.abs(delta(heading[Math.max(0,i-half)],heading[Math.min(n,i+half)]))/(Math.max(1,Math.min(n,i+half)-Math.max(0,i-half))*step));
 const peaks=geometry.pieces.map(p=>Math.max(...curvature.slice(Math.floor(p.start*n),Math.ceil(p.end*n)+1)));
 const corner=curvature.map((value,i)=>{const k=geometry.pieces.findIndex(p=>i/n<p.end-1e-12),index=k<0?geometry.pieces.length-1:k;return value>Math.min(1/120,peaks[index]*.3)&&peaks[index]>1e-5;});
 const runs=()=>{const result=[];let start=0;for(let i=1;i<=n+1;i++)if(i===n+1||corner[i]!==corner[start]){result.push({start,end:i-1,corner:corner[start]});start=i;}return result;};
 for(let pass=0;pass<4;pass++)for(const r of runs()){const length=(r.end-r.start+1)*step;if(length<(r.corner?24:60)&&(r.start>0||r.end<n))for(let i=r.start;i<=r.end;i++)corner[i]=!r.corner;}
 // A broad arc can have low local curvature while still being visibly curved.
 // Keep its silhouette instead of cutting a straight chord across the infield.
 for(const r of runs())if(!r.corner){
  const a=points[r.start],b=points[r.end],chord=Math.hypot(b[0]-a[0],b[1]-a[1]);let travel=0;
  for(let i=r.start+1;i<=r.end;i++)travel+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  if(chord/Math.max(.001,travel)<.98)for(let i=r.start;i<=r.end;i++)corner[i]=true;
 }
 const chunks=runs(),visualSegments=[],sectors=[];let previous=0;
 for(let i=0;i<chunks.length;i++){
  const chunk=chunks[i],start=i?previous:0,end=i===chunks.length-1?1:(chunk.end+.5)/n;previous=end;
  const middle=(start+end)/2,sourceIndex=Math.max(0,geometry.pieces.findIndex(p=>middle>=p.start&&middle<=p.end)),source=event.sectors[sourceIndex],length=(end-start)*total;
  let angle=0;for(let j=chunk.start+1;j<=chunk.end;j++)angle+=Math.abs(delta(heading[j-1],heading[j]));
  const radius=chunk.corner?Math.round(clamp(length/Math.max(.04,angle),18,650)):0;
  const samples=Array.from({length:65},(_,j)=>geometry.at(start+(end-start)*j/64));
  const type=chunk.corner?'corner':'straight',name=chunk.corner?source.name+' · дуга':'Разгон · '+Math.round(length)+' м';
  sectors.push({...source,type,name,label:radius?(radius<35?'Шпилька':radius<70?'Крутой поворот':radius<140?'Средний поворот':'Пологая дуга'):'Прямая',length,radius,sourceIndex,decisionScale:geometry.pieces.reduce((sum,p,j)=>sum+Math.max(0,Math.min(end,p.end)-Math.max(start,p.start))*total/event.sectors[j].length,0),turnDegrees:Math.round(angle*180/Math.PI)});
  visualSegments.push({start,end,type,points:chunk.corner?samples:[samples[0],samples.at(-1)]});
 }
 for(let i=0;i<sectors.length;i++)if(sectors[i].type==='straight')sectors[i].nextRadius=sectors.slice(i+1).find(s=>s.type==='corner')?.radius||0;
 return {...event,routeVersion:2,sectors,visualSegments,description:event.description.replace(/\d+ игровых участков/,sectors.length+' игровых участков')};
}
