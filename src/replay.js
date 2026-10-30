// Shared replay sampling; consumes recorded timings and poses, never simulation
// or economy functions. In particular, a drag prep interval may have zero time.
export function replayIndex(times,elapsed){
  if(!times?.length)return 0;
  let end=0;
  for(let i=0;i<times.length;i++){
    end+=times[i];
    if(times[i]>0&&elapsed<end-1e-8)return i;
  }
  return times.length-1;
}
export function driftFrame(record,elapsed){
  const clips=record?.drift?.clips,times=record?.sectorTimes;
  if(!clips?.length||!times?.length)return null;
  const index=Math.min(clips.length-1,replayIndex(times,elapsed)),clip=clips[index];
  const start=times.slice(0,index).reduce((sum,time)=>sum+time,0);
  const fraction=Math.max(0,Math.min(1,(elapsed-start)/Math.max(.001,times[index])));
  const previous=index>0?clips[index-1]:null;
  const priorAngle=previous&&previous.phase!=='exit'&&previous.valid?previous.angleDegrees*previous.direction:0;
  const current=clip.valid?clip.angleDegrees*clip.direction:0;
  const interpolate=Math.min(1,fraction*4);
  const yaw=(priorAngle+(current-priorAngle)*interpolate)*Math.PI/180+(clip.spin?fraction*Math.PI*2:0);
  const score=clips.slice(0,index).reduce((sum,clip)=>sum+clip.points,0)+(fraction>=1?clip.points:0);
  return {index,fraction,yaw,score,clip};
}
