const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function sectionCamera(points,checkpoints,index,width,height,scale,progress=checkpoints[Math.max(0,index)]||0){
 const cursor=clamp(Math.round(progress*800),0,800),visible=points.slice(Math.max(0,cursor-12),Math.min(801,cursor+33));
 const xs=visible.map(p=>p[0]),ys=visible.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 // Cars remain legible on long circuits instead of shrinking to fit two full sectors.
 const carSize=Math.max(1,58*scale),maximum=Math.min(24,126/carSize),minimum=Math.min(maximum,86/carSize);
 const zoom=clamp(Math.min(width*.7/(right-left+60*scale),height*.62/(bottom-top+80*scale)),minimum,maximum);
 const car=points[cursor],look=points[Math.min(800,cursor+8)];
 return {zoom,x:zoom>=1?clamp(width*.48-(car[0]*.75+look[0]*.25)*zoom,width*(1-zoom),0):width*(1-zoom)/2,y:zoom>=1?clamp(height*.52-(car[1]*.75+look[1]*.25)*zoom,height*(1-zoom),0):height*(1-zoom)/2};
}

export function sceneryClear(points,x,y,radius){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
  if(Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<radius)return false;
 }
 return true;
}

export const ZOOM_STEPS=[.5,.75,1,1.25,1.5,2,3,4,6,8,12,16,24];
export function nextZoom(current,direction){
 const z=clamp(Number.isFinite(current)?current:1,ZOOM_STEPS[0],ZOOM_STEPS.at(-1));
 return direction>0?ZOOM_STEPS.find(value=>value>z+1e-6)??ZOOM_STEPS.at(-1):[...ZOOM_STEPS].reverse().find(value=>value<z-1e-6)??ZOOM_STEPS[0];
}
export function zoomAround(camera,zoom,x,y){
 const z=clamp(zoom,ZOOM_STEPS[0],ZOOM_STEPS.at(-1)),ratio=z/camera.zoom;
 return {zoom:z,x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio};
}
