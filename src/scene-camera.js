const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function sectionCamera(points,checkpoints,index,width,height,scale){
 const start=Math.floor((checkpoints[Math.max(0,index)]||0)*800),end=Math.min(800,Math.ceil((checkpoints[Math.min(checkpoints.length-1,index+2)]??1)*800));
 const visible=points.slice(Math.max(0,start-12),Math.max(start+2,end+1));
 const xs=visible.map(p=>p[0]),ys=visible.map(p=>p[1]);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 const zoom=clamp(Math.min(width*.78/(right-left+60*scale),height*.65/(bottom-top+80*scale)),1,Math.min(6,52/Math.max(1,58*scale)));
 return {zoom,x:clamp(width*.48-(left+right)/2*zoom,width*(1-zoom),0),y:clamp(height*.52-(top+bottom)/2*zoom,height*(1-zoom),0)};
}
export function sceneryClear(points,x,y,radius){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
  if(Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<radius)return false;
 }
 return true;
}
