// Original vector scenery; no downloaded or generated image assets.
const anchors=[[0,0],[160,0],[260,110],[170,210],[-60,230],[-230,330],[-110,420],[130,430],[310,540],[180,650],[-70,670],[-260,790],[-160,900],[80,950],[250,1070],[100,1190]];
const route=[];
for(let i=0;i<anchors.length-1;i++)for(let j=0;j<32;j++){
 const t=j/32,p0=anchors[Math.max(0,i-1)],p1=anchors[i],p2=anchors[i+1],p3=anchors[Math.min(anchors.length-1,i+2)];
 route.push(p1.map((_,k)=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)));
}
route.push(anchors.at(-1));
export class Scene{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.progress=0;this.other=0;this.from=0;this.target=0;this.started=0;this.duration=0;this.weather='mixed';this.carColor='#eee8d9';this.paused=false;this.speed=1;this.time=0;this.frame=0;this.resize=new ResizeObserver(()=>this.size());this.resize.observe(canvas);this.size();this.loop=this.loop.bind(this);this.frame=requestAnimationFrame(this.loop);}
 destroy(){this.disposed=true;this.resize.disconnect();cancelAnimationFrame(this.frame);}
 size(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=this.w*this.dpr;this.canvas.height=this.h*this.dpr;}
 setWeather(w){this.weather=w;}
 setCar(color){this.carColor=color;}
 animate(index,gap,duration=1800){this.from=this.progress;this.fromOther=this.other;this.target=index/8;this.targetOther=Math.max(0,Math.min(1,this.target+gap/180));this.started=performance.now();this.duration=duration;this.paused=false;}
 reset(){this.progress=0;this.other=0;this.duration=0;}
 setPaused(v){if(v){this.pauseAt=performance.now();}else if(this.paused){this.started+=performance.now()-this.pauseAt;}this.paused=v;}
 project(x,y,z=0){const scale=Math.min(this.w/950,this.h/840);return [this.w*.59+(x-y*.46+240)*scale,this.h*.13+(x*.24+y*.49-z)*scale];}
 line(points,color,width,dash=[]){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.setLineDash(dash);c.stroke();c.setLineDash([]);}
 poly(points,fill){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=fill;c.fill();}
 tree(x,y,seed){const p=this.project(x,y),s=Math.min(this.w/950,this.h/840),h=(22+seed*24)*s,c=this.ctx;c.fillStyle='#091716';c.beginPath();c.ellipse(p[0]+9*s,p[1]+4*s,15*s,6*s,0,0,7);c.fill();this.line([[p[0],p[1]],[p[0],p[1]-h*.5]],'#35413a',2*s);this.poly([[p[0]-14*s,p[1]-7*s],[p[0],p[1]-h],[p[0]+14*s,p[1]-7*s]],seed>.5?'#1b3934':'#23433a');this.poly([[p[0],p[1]-h],[p[0],p[1]-7*s],[p[0]+14*s,p[1]-7*s]],'#102d2a');}
 car(pct,lane,color,label){const n=Math.min(route.length-2,Math.floor(pct*(route.length-1))),p=this.project(...route[n]),q=this.project(...route[n+1]),c=this.ctx,scale=Math.min(this.w/950,this.h/840),a=Math.atan2(q[1]-p[1],q[0]-p[0]);c.save();c.translate(p[0]-Math.sin(a)*lane*scale,p[1]+Math.cos(a)*lane*scale);c.rotate(a);c.shadowBlur=16;c.shadowColor=color;c.fillStyle='#03090b';c.fillRect(-15*scale,-6*scale,32*scale,15*scale);c.shadowBlur=0;c.fillStyle=color;c.fillRect(-16*scale,-8*scale,32*scale,14*scale);c.fillStyle='#223c47';c.fillRect(-6*scale,-7*scale,13*scale,12*scale);c.fillStyle='#a6c1c6';c.fillRect(3*scale,-6*scale,3*scale,10*scale);c.fillStyle='#fa6a50';c.fillRect(-16*scale,-7*scale,2*scale,4*scale);c.fillRect(-16*scale,2*scale,2*scale,4*scale);c.fillStyle='#fcf4cc';c.shadowColor='#fff3b1';c.shadowBlur=12;c.fillRect(14*scale,-7*scale,3*scale,4*scale);c.fillRect(14*scale,2*scale,3*scale,4*scale);const g=c.createLinearGradient(16*scale,0,95*scale,0);g.addColorStop(0,'#fff3ad35');g.addColorStop(1,'#fff3ad00');this.poly([[16*scale,-6*scale],[95*scale,-26*scale],[95*scale,26*scale],[16*scale,6*scale]],g);c.restore();c.save();c.font='bold 10px monospace';c.fillStyle=color;c.textAlign='center';c.fillText(label,p[0],p[1]-22*scale);c.restore();}
 draw(){const c=this.ctx,w=this.w,h=this.h,s=Math.min(w/950,h/840);c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#152628');bg.addColorStop(1,'#0b171b');c.fillStyle=bg;c.fillRect(0,0,w,h);
 // Layered mountain silhouettes and the cliff under the elevated road.
 this.poly([[0,h*.38],[w*.12,h*.18],[w*.23,h*.32],[w*.36,h*.03],[w*.49,h*.25],[w*.6,h*.12],[w*.79,h*.31],[w,h*.1],[w,h],[0,h]],'#1a2e2e');
 this.poly([[0,h*.65],[w*.14,h*.4],[w*.28,h*.53],[w*.4,h*.29],[w*.56,h*.6],[w*.7,h*.38],[w,h*.67],[w,h],[0,h]],'#1c3330');
 const road=route.map(p=>this.project(...p));this.line(road.map(([x,y])=>[x,y+23*s]),'#0a1518',61*s);this.line(road.map(([x,y])=>[x,y+9*s]),'#34433d',56*s);this.line(road,'#82918a',49*s);this.line(road,'#293d40',44*s);this.line(road,'#3a4d4c',39*s);this.line(road,'#cbbf8c70',1.7*s,[9*s,12*s]);
 // Deterministically scatter cedar trees away from the road.
 for(let i=0;i<160;i++){const x=Math.sin(i*127.1)*410,y=((i*173)%1350)-60;let near=false;for(let k=0;k<route.length;k+=6)if(Math.hypot(route[k][0]-x,route[k][1]-y)<55){near=true;break;}if(!near)this.tree(x,y,(Math.sin(i*43)+1)/2);}
 for(let i=0;i<=8;i++){const n=Math.min(route.length-1,Math.floor(i/8*(route.length-1))),p=road[n];c.beginPath();c.arc(p[0],p[1],i===0||i===8?7*s:4*s,0,7);c.fillStyle=i===8?'#f6a66e':'#9baea4';c.fill();if(i>0&&i<8){c.font='10px monospace';c.fillStyle='#95ada8';c.fillText(String(i).padStart(2,'0'),p[0]+15*s,p[1]-12*s);}}
 // Tea house / start shelter.
 const home=this.project(-75,-20);this.poly([[home[0]-26*s,home[1]],[home[0]+20*s,home[1]+10*s],[home[0]+20*s,home[1]-22*s],[home[0]-26*s,home[1]-32*s]],'#424638');this.poly([[home[0]-35*s,home[1]-31*s],[home[0],home[1]-47*s],[home[0]+31*s,home[1]-20*s],[home[0],home[1]-8*s]],'#6c6250');c.fillStyle='#f1bc75';c.fillRect(home[0]-12*s,home[1]-17*s,10*s,10*s);
 this.car(this.other,8,'#c47bfa','RIVAL');this.car(this.progress,-8,this.carColor,'YOU');
 if(this.weather!=='dry'){c.strokeStyle='#bcd3d31b';c.lineWidth=.8;for(let i=0;i<(this.weather==='rain'?120:45);i++){const x=(i*79+this.time*.09)%w,y=(i*97+this.time*.22)%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-5,y+13);c.stroke();}}
 const fog=c.createLinearGradient(0,h*.65,0,h);fog.addColorStop(0,'#12232800');fog.addColorStop(1,'#102125c9');c.fillStyle=fog;c.fillRect(0,0,w,h);
 c.save();c.translate(w-100,h-52);c.strokeStyle='#a6b7ac';c.lineWidth=1;c.beginPath();c.moveTo(0,-18);c.lineTo(0,12);c.moveTo(-15,0);c.lineTo(15,0);c.stroke();c.font='10px monospace';c.fillStyle='#a6b7ac';c.fillText('N',-3,-24);c.restore();
 }
 loop(now){if(this.disposed)return;this.time=now;if(this.duration&&!this.paused){const t=Math.min(1,(now-this.started)/this.duration);const ease=t*t*(3-2*t);this.progress=this.from+(this.target-this.from)*ease;this.other=this.fromOther+(this.targetOther-this.fromOther)*ease;if(t===1){this.duration=0;this.onComplete?.();}}if(this.disposed)return;this.draw();this.frame=requestAnimationFrame(this.loop);}
}
