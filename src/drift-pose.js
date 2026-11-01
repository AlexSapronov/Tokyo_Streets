// Recorded clip directions describe scoring chains, not the physical side of
// every bend traversed by that clip. Orient the sprite from the road itself.
const cache=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function directions(route){
 if(cache.has(route))return cache.get(route);
 const signs=route.map((b,i)=>{const a=route[Math.max(0,i-3)],c=route[Math.min(route.length-1,i+3)],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];const angle=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]);return Math.abs(angle)>.012?Math.sign(angle):0;});
 let held=signs.find(s=>s)||1,filtered=held;const values=signs.map(s=>{if(s)held=s;filtered+=clamp(held-filtered,-.25,.25);return filtered;});
 cache.set(route,values);return values;
}
export function driftVisualYaw(route,progress,frame){
 const values=directions(route),position=clamp(progress,0,1)*(values.length-1),index=Math.floor(position),weight=values[index]+((values[Math.min(index+1,values.length-1)]||0)-values[index])*(position-index);
 // A healthy drift always keeps a forward component. Only a recorded spin
 // may rotate the car backwards, briefly at the incident rather than all sector.
 return Math.min(75*Math.PI/180,Math.abs(frame.driftAngle||0))*weight+(frame.spinYaw||0);
}
