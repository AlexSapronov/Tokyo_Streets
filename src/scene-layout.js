// Rotate the display plane, never the simulation route or checkpoint distances.
export function sceneLayout(route,width,height){
 const iso=([x,y])=>[x-y*.46,x*.24+y*.49],points=route.map(iso),count=points.length;
 const mean=points.reduce((a,p)=>[a[0]+p[0]/count,a[1]+p[1]/count],[0,0]);
 let xx=0,yy=0,xy=0;
 for(const [x,y] of points){xx+=(x-mean[0])**2;yy+=(y-mean[1])**2;xy+=(x-mean[0])*(y-mean[1]);}
 let angle=-Math.atan2(2*xy,xx-yy)/2;
 const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
 const first=rotate(points[0],angle),last=rotate(points.at(-1),angle);
 if(last[0]<first[0])angle+=Math.PI;
 const rotated=points.map(p=>rotate(p,angle));
 const bounds=[Math.min(...rotated.map(p=>p[0])),Math.max(...rotated.map(p=>p[0])),Math.min(...rotated.map(p=>p[1])),Math.max(...rotated.map(p=>p[1]))];
 const margin=42,top=66,bottom=70;
 const scale=Math.max(.0001,Math.min(Math.max(1,width-48)/(bounds[1]-bounds[0]+margin*2),Math.max(1,height-top-bottom)/(bounds[3]-bounds[2]+margin*2)));
 return {bounds,scale,angle,center:[width/2,top+Math.max(1,height-top-bottom)/2],transform(x,y){return rotate(iso([x,y]),angle);}};
}
