import {driftVisualYaw} from './drift-pose.js';
import {trackGeometry} from './track-geometry.js';
import {sectionCamera,sceneryClear,nextZoom,zoomAround,ZOOM_STEPS} from './scene-camera.js';
import {sceneLayout} from './scene-layout.js';
import {presentationRecord,presentationFrame,racingLane} from './presentation.js';
import {lineFrame,SECTOR_COLORS} from './racing-lines.js';
import {CARS, getEvent} from './data.js';
import {checkpointFractions, progressAtTime} from './progress.js';
import {topVehicleSVG} from './vehicles.js';

// Four simulated seconds per wall-clock second. Tiny sectors stay readable;
// untimed drag preparation still has a visible execution interval.
export function playbackDuration(seconds,speed=1){
  return (seconds>0?Math.max(350,seconds*250):900)/speed;
}
export class Scene {
  constructor(canvas, race, ghost = null, showGhost = true, sound = null) {
    this.canvas = canvas;this.sound=sound;this.follow=false;this.cameraState=null;this.pointer=null;this.inputHandlers=[];
    this.ctx = canvas.getContext('2d');
    this.event = getEvent(race.eventId,race.routeVersion);
    this.geometry=trackGeometry(this.event);this.route=this.geometry.route;
    this.checkpoints = checkpointFractions(this.event.id,race.routeVersion);
    this.race = race;
    this.ghost = ghost;
    this.showGhost = showGhost;
    this.elapsed = race.player.time;
    this.paused = false;
    this.motion = null;
    this.time = 0;
    this.speed = 1;
    this.sprites = new Map();
    for (const car of CARS) {
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(topVehicleSVG(car));
      this.sprites.set(car.id,image);
    }
    this.background = document.createElement('canvas');
    this.resize = new ResizeObserver(() => this.size());
    this.resize.observe(canvas);
    this.size();
    this.bindCameraInput();
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }
  get viewState(){
    if(this.pendingView)return this.pendingView;
    if(!this.cameraState||!this.layout)return null;
    const c=this.cameraState,b=this.bounds;
    return {center:[(this.w/2-c.x)/c.zoom-this.layout.center[0],(this.h/2-c.y)/c.zoom-this.layout.center[1]].map((v,i)=>v/this.scale+(b[i*2]+b[i*2+1])/2),worldZoom:c.zoom*this.scale};
  }
  restoreView(view){
    if(!view||!view.center?.every(Number.isFinite)||!Number.isFinite(view.worldZoom)||view.worldZoom<=0)return;
    if(this.w<10||this.h<10){this.pendingView=view;return;}
    const b=this.bounds,z=Math.max(ZOOM_STEPS[0],Math.min(ZOOM_STEPS.at(-1),view.worldZoom/this.scale));
    const p=view.center.map((v,i)=>this.layout.center[i]+(v-(b[i*2]+b[i*2+1])/2)*this.scale);
    this.cameraState={zoom:z,x:this.w/2-p[0]*z,y:this.h/2-p[1]*z};this.pendingView=null;
  }
  ensureCamera(){
    if(!this.cameraState){const record=this.replayRecord||presentationRecord(this.race),progress=progressAtTime(record.sectorTimes,this.elapsed,this.event.id,this.race.routeVersion);this.cameraState=sectionCamera(this.route.map(p=>this.project(...p)),this.checkpoints,0,this.w,this.h,this.scale,progress);}
    return this.cameraState;
  }
  zoomBy(direction,x=this.w/2,y=this.h/2){
    const camera=this.ensureCamera();this.follow=false;this.pendingView=null;this.cameraState=zoomAround(camera,nextZoom(camera.zoom,direction),x,y);this.onCameraChange?.();
  }
  panBy(x,y){const camera=this.ensureCamera();this.follow=false;this.pendingView=null;camera.x+=x;camera.y+=y;this.onCameraChange?.();}
  showAll(){this.follow=false;this.pendingView=null;this.cameraState={zoom:1,x:0,y:0};this.onCameraChange?.();}
  focusCar(){this.follow=false;this.cameraState=null;this.pendingView=null;this.ensureCamera();this.onCameraChange?.();}
  focusSector(index){
    if(this.motion||!Number.isInteger(index)||index<this.race.index||index>=Math.min(this.event.sectors.length,this.race.index+3))return;
    const start=this.checkpoints[index],end=this.checkpoints[index+1],points=Array.from({length:49},(_,i)=>this.project(...this.geometry.at(start+(end-start)*i/48))),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const zoom=Math.max(.5,Math.min(24,this.w*.8/(right-left+90*this.scale),this.h*.65/(bottom-top+90*this.scale)));
    this.previewSector=index;this.follow=false;this.pendingView=null;this.cameraState={zoom,x:this.w/2-(left+right)/2*zoom,y:this.h*.53-(top+bottom)/2*zoom};this.onCameraChange?.();
  }
  drawDecisionGuide(index){
    const c=this.ctx,zoom=this.cameraState?.zoom||1;
    for(let offset=0;offset<3&&index+offset<this.event.sectors.length;offset++){
      const n=index+offset,start=this.checkpoints[n],end=this.checkpoints[n+1],points=Array.from({length:49},(_,j)=>this.project(...this.geometry.at(start+(end-start)*j/48))),color=SECTOR_COLORS[offset];
      this.path(c,points,color,Math.max(2/zoom,(this.previewSector===n?5:3)*this.scale));
      for(const [f,label] of [[start,'ВХОД '+(n+1)],[end,'ВЫХОД '+(n+1)]]){const p=this.project(...this.geometry.at(f));c.strokeStyle=color;c.lineWidth=1.5/zoom;c.beginPath();c.arc(p[0],p[1],5/zoom,0,Math.PI*2);c.stroke();if(this.previewSector===n){c.font='bold '+10/zoom+'px monospace';c.fillStyle=color;c.fillText(label,p[0]+8/zoom,p[1]-10/zoom);}}
      const a=points[19],b=points[25],d=Math.atan2(b[1]-a[1],b[0]-a[0]),size=7/zoom;
      this.path(c,[[b[0]-Math.cos(d-.6)*size,b[1]-Math.sin(d-.6)*size],b,[b[0]-Math.cos(d+.6)*size,b[1]-Math.sin(d+.6)*size]],color,1.8/zoom);
      const p=points[24];c.font='bold '+11/zoom+'px monospace';c.fillStyle=color;c.fillText(String(n+1),p[0]+9/zoom,p[1]-7/zoom);
    }
  }
  bindCameraInput(){
    const listen=(name,handler,options)=>{this.canvas.addEventListener?.(name,handler,options);this.inputHandlers.push([name,handler,options]);};
    listen('wheel',event=>{if(!event.deltaY||event.ctrlKey||event.metaKey)return;event.preventDefault();const rect=this.canvas.getBoundingClientRect();this.zoomBy(event.deltaY<0?1:-1,event.clientX-(rect.left||0),event.clientY-(rect.top||0));},{passive:false});
    listen('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();this.canvas.focus?.({preventScroll:true});this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY};this.canvas.setPointerCapture?.(event.pointerId);});
    listen('pointermove',event=>{if(!this.pointer||this.pointer.id!==event.pointerId)return;const x=event.clientX-this.pointer.x,y=event.clientY-this.pointer.y;this.pointer.x=event.clientX;this.pointer.y=event.clientY;if(!x&&!y)return;this.panBy(x,y);this.canvas.classList?.add('map-dragging');});
    const release=event=>{if(this.pointer?.id!==event.pointerId)return;this.pointer=null;this.canvas.classList?.remove('map-dragging');if(this.canvas.hasPointerCapture?.(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);};
    listen('pointerup',release);listen('pointercancel',release);listen('lostpointercapture',release);
    listen('keydown',event=>{const moves={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]};if(moves[event.key]){event.preventDefault();this.panBy(...moves[event.key]);}else if(['+','=','-','Home'].includes(event.key)){event.preventDefault();if(event.key==='Home')this.showAll();else this.zoomBy(event.key==='-'?-1:1);}});
  }
  destroy() {
    this.disposed = true;this.sound?.stop();
    this.resize.disconnect();
    for(const [name,handler,options] of this.inputHandlers)this.canvas.removeEventListener?.(name,handler,options);
    this.inputHandlers=[];this.pointer=null;
    cancelAnimationFrame(this.frame);
  }
  size() {
    const saved=this.viewState;
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1,rect.width);
    this.h = Math.max(1,rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1,2);
    this.canvas.width = this.w*this.dpr;
    this.canvas.height = this.h*this.dpr;
    this.backgroundDpr=Math.min(3,this.dpr*2);
    this.background.width = this.w*this.backgroundDpr;
    this.background.height = this.h*this.backgroundDpr;
    this.layout=sceneLayout(this.route,this.w,this.h);
    this.bounds=this.layout.bounds;this.scale=this.layout.scale;
    this.cameraState=null;
    this.renderBackground();
    if(saved)this.restoreView(saved);
    this.onCameraChange?.();
  }
  project(x,y,z=0) {
    const b=this.bounds,s=this.scale;
    const [px,py]=this.layout.transform(x,y);
    return [this.layout.center[0]+(px-(b[0]+b[1])/2)*s,
      this.layout.center[1]+(py-(b[2]+b[3])/2-z)*s];
  }
  path(ctx,points,color,width,dash=[]) {
    ctx.beginPath();points.forEach((point,i)=>i?ctx.lineTo(...point):ctx.moveTo(...point));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
  }
  polygon(ctx,points,color) {
    ctx.beginPath();points.forEach((point,i)=>i?ctx.lineTo(...point):ctx.moveTo(...point));
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  tree(ctx,x,y,seed) {
    const [px,py]=this.project(x,y),s=this.scale,h=(14+seed*14)*s;
    ctx.fillStyle='#071a1688';ctx.beginPath();ctx.ellipse(px+9*s,py+3*s,15*s,6*s,0,0,7);ctx.fill();
    this.path(ctx,[[px,py],[px,py-h*.5]],'#4c5140',2*s);
    this.polygon(ctx,[[px-14*s,py-7*s],[px,py-h],[px+14*s,py-7*s]],seed>.5?'#264c3b':'#1f4037');
    this.polygon(ctx,[[px,py-h],[px,py-7*s],[px+14*s,py-7*s]],'#15312d');
  }
  groundGradient(ctx,x0,y0,x1,y1) {
    const circuit=['circuit','dragstrip','driftpark'].includes(this.event.theme),ridge=this.event.theme==='ridge';
    const gradient=ctx.createLinearGradient(x0,y0,x1,y1);
    gradient.addColorStop(0,circuit?'#263338':ridge?'#2b2939':'#152d2c');gradient.addColorStop(1,'#101d23');
    return gradient;
  }
  renderBackground() {
    const c=this.background.getContext('2d'),w=this.w,h=this.h,s=this.scale;
    c.setTransform(this.backgroundDpr,0,0,this.backgroundDpr,0,0);
    const circuit=['circuit','dragstrip','driftpark'].includes(this.event.theme),ridge=this.event.theme==='ridge',highway=this.event.theme==='highway';
    c.fillStyle=this.groundGradient(c,0,0,w,h);c.fillRect(0,0,w,h);
    if (!circuit&&!highway) {
      this.polygon(c,[[0,h*.4],[w*.1,h*.18],[w*.25,h*.3],[w*.39,h*.04],[w*.52,h*.32],[w*.65,h*.11],[w*.8,h*.3],[w,h*.15],[w,h],[0,h]],ridge?'#383647':'#213d35');
      this.polygon(c,[[0,h*.7],[w*.15,h*.44],[w*.31,h*.59],[w*.44,h*.31],[w*.58,h*.6],[w*.75,h*.38],[w,h*.7],[w,h],[0,h]],ridge?'#2c333c':'#1c3630');
    }
    const road=this.route.map(point=>this.project(...point));
    if (!circuit) this.path(c,road.map(([x,y])=>[x,y+18*s]),'#081419',62*s);
    if(circuit)this.path(c,road,'#45604e',88*s);
    this.path(c,road,circuit?'#ddd7be':'#71887b',54*s);
    this.path(c,road,circuit?'#90494a':'#a0a38d',49*s,circuit?[9*s,9*s]:[]);
    this.path(c,road,'#263a3e',44*s);
    this.path(c,road,'#3c5050',37*s);
    this.path(c,road,circuit?'#d4d9bd55':'#cbbf8c80',1.5*s,[9*s,12*s]);
    if(this.event.crossing){
      const target=this.project(...this.event.crossing);let index=450,distance=Infinity;
      for(let i=450;i<road.length-10;i++){const d=Math.hypot(road[i][0]-target[0],road[i][1]-target[1]);if(d<distance){index=i;distance=d;}}
      const bridge=road.slice(index-12,index+13);this.path(c,bridge,'#101b1c',70*s);this.path(c,bridge,'#afbaa7',54*s);this.path(c,bridge,'#3c5050',44*s);this.path(c,bridge,'#d4d9bd55',1.5*s,[9*s,12*s]);
    }
    if (!circuit&&!highway) {
      for(let i=0;i<80;i++) {
        const x=Math.sin(i*127.1)*430,y=((i*173)%1350)-60;
        const point=this.project(x,y),near=!sceneryClear(road,point[0],point[1]-10*s,65*s);
        if(!near)this.tree(c,x,y,(Math.sin(i*43)+1)/2);
      }
    } else if(!highway&&this.event.theme!=='dragstrip') {
      // Paddock scenery belongs to circuit layouts, not the drag racing lanes.
      for(let i=0,placed=0;i<36&&placed<6;i++) {
        const [x,y]=this.project(-400+(i%9)*110,150+Math.floor(i/9)*230);
        if(!sceneryClear(road,x+24*s,y-20*s,90*s))continue;placed++;
        this.polygon(c,[[x,y],[x+45*s,y+11*s],[x+45*s,y-30*s],[x,y-41*s]],'#64716c');
        this.polygon(c,[[x-7*s,y-43*s],[x+38*s,y-32*s],[x+58*s,y-45*s],[x+12*s,y-56*s]],'#8a9a8b');
        c.fillStyle='#f5c784';c.fillRect(x+12*s,y-19*s,17*s,8*s);
      }
    }
    if(highway){
      // Buildings stay beside the road, never across a racing lane.
      for(let i=0;i<12;i++){const y=i*280+60,x=(i%2?1:-1)*(130+i%3*35),near=this.route.some((p,k)=>k%10===0&&Math.hypot(p[0]-x,p[1]-y)<80);if(near)continue;const [px,py]=this.project(x,y);if(!sceneryClear(road,px+18*s,py-28*s,95*s))continue;this.polygon(c,[[px,py],[px+35*s,py+9*s],[px+35*s,py-55*s],[px,py-64*s]],'#263b48');for(let j=0;j<4;j++){c.fillStyle='#d9c68a';c.fillRect(px+8*s,py-(12+j*11)*s,6*s,4*s);}}
    }
    if(this.event.mode==='drift'){
      for(let i=0;i<this.event.sectors.length;i++){
        const t=(this.checkpoints[i]+this.checkpoints[i+1])/2;
        const [x,y]=road[Math.floor(t*800)];
        c.strokeStyle='#ffbe7777';c.lineWidth=3*s;c.beginPath();c.arc(x,y,16*s,0,Math.PI*2);c.stroke();
        this.polygon(c,[[x+24*s,y],[x+29*s,y-13*s],[x+34*s,y]],'#ec995c');
        c.font='9px monospace';c.fillStyle='#dfbf8b';c.fillText('CLIP '+(i+1),x+37*s,y-5*s);
      }
    }
    if(this.event.theme==='dragstrip'){
      const [x,y]=this.project(-115,20);
      this.path(c,[[x,y],[x,y-85*s]],'#85948c',5*s);
      for(let i=0;i<5;i++){c.beginPath();c.arc(x,y-(70-i*12)*s,4*s,0,7);c.fillStyle=i<3?'#efc979':i===3?'#92d6a1':'#c67066';c.fill();}
      c.font='bold 10px monospace';c.fillStyle='#c0cbb8';c.fillText((this.event.longDrag?this.event.distance.toFixed(3):'402.336')+' m / DRAG',x-45*s,y+25*s);
    }
    for(let i=0;i<this.checkpoints.length;i++) {
      const point=this.project(...this.geometry.at(this.checkpoints[i]));
      c.beginPath();c.arc(point[0],point[1],i===0||i===this.checkpoints.length-1?6*s:3*s,0,7);
      c.fillStyle=i===this.checkpoints.length-1?'#ffac77':'#b6c6ad';c.fill();
      if(i<this.checkpoints.length-1){c.font='10px monospace';c.fillStyle='#b0c1b0';c.fillText(String(i+1).padStart(2,'0'),point[0]+15*s,point[1]-12*s);}
    }

  }
  animateSector(race,ghost,duration) {
    this.previewSector=null;this.fromState=this.race.player;this.race=race;this.ghost=ghost;
    this.motion={from:this.elapsed,to:race.player.time,started:performance.now(),duration:duration??playbackDuration(race.player.time-this.elapsed,this.speed)};
    this.paused=false;
  }
  replay(record,duration) {
    this.replayRecord=record;
    this.elapsed=0;
    this.motion={from:0,to:record.time,started:performance.now(),duration:duration??playbackDuration(record.time,this.speed)};
  }
  setPaused(value) {
    if(value)this.sound?.stop();
    if(value&&!this.paused)this.pauseAt=performance.now();
    if(!value&&this.paused&&this.motion)this.motion.started+=performance.now()-this.pauseAt;
    this.paused=value;
  }
  setSpeed(multiplier) {
    if(!this.motion){this.speed=multiplier;return;}
    const now=this.paused?this.pauseAt:performance.now();
    const fraction=Math.min(1,(now-this.motion.started)/this.motion.duration);
    const duration=this.motion.duration/(multiplier/this.speed);
    this.motion.started=now-fraction*duration;this.motion.duration=duration;this.speed=multiplier;
  }
  drawCar(progress,lane,carId,label,ghost=false,yaw=0,lineOffset=0,effects={}) {
    lane+=lineOffset;
    const f=Math.max(0,Math.min(1,progress)),point=this.project(...this.geometry.at(f)),next=this.project(...this.geometry.at(Math.min(1,f+.0005))),previous=this.project(...this.geometry.at(Math.max(0,f-.0005)));
    const c=this.ctx,s=this.scale,a=f<1?Math.atan2(next[1]-point[1],next[0]-point[0]):Math.atan2(point[1]-previous[1],point[0]-previous[0]);
    c.save();c.translate(point[0]-Math.sin(a)*lane*s,point[1]+Math.cos(a)*lane*s);c.rotate(a+yaw);
    c.globalAlpha=ghost?.4:1;
    if(!ghost){c.fillStyle='#050b1280';c.beginPath();c.ellipse(0,4*s,23*s,10*s,0,0,7);c.fill();}
    if(!ghost&&this.motion&&effects.marks>.03){
      this.path(c,[[-45*s,-8*s],[-24*s,-8*s]],'#08101199',2*s);
      this.path(c,[[-45*s,8*s],[-24*s,8*s]],'#08101199',2*s);
    }
    const sprite=this.sprites.get(carId);
    if(sprite?.complete&&sprite.naturalWidth)c.drawImage(sprite,-29*s,-14*s,58*s,28*s);
    if(!ghost){
      const beam=c.createLinearGradient(22*s,0,85*s,0);beam.addColorStop(0,'#fff3b23b');beam.addColorStop(1,'#fff3b200');
      this.polygon(c,[[22*s,-8*s],[85*s,-26*s],[85*s,26*s],[22*s,8*s]],beam);
      if(this.motion&&effects.braking){
        c.fillStyle='#ff4b41';c.shadowColor='#ff3029';c.shadowBlur=10*s;c.fillRect(-26*s,-11*s,4*s,5*s);c.fillRect(-26*s,6*s,4*s,5*s);c.shadowBlur=0;
      }
      if(this.motion&&effects.smoke>.02){
        c.fillStyle='#b1c3ba50';for(let i=0;i<3;i++){c.globalAlpha=(1-i*.25)*effects.smoke;c.beginPath();c.ellipse((-30-i*12)*s,Math.sin((effects.fraction||0)*5+i)*4*s,(10+i*3)*s,(5+i*2)*s,0,0,7);c.fill();}c.globalAlpha=1;
      }
    }
    c.restore();c.save();c.font='bold '+(12/(this.cameraState?.zoom||1))+'px monospace';c.fillStyle=ghost?'#b0e1d5':label.startsWith('YOU')?'#ffe0b0':'#cab1e8';c.textAlign='center';c.fillText(label,point[0]-Math.sin(a)*lane*s,point[1]+Math.cos(a)*lane*s-(ghost?35:24)*s);c.restore();
  }
  draw() {
    const c=this.ctx,w=this.w,h=this.h;
    const cameraRecord=this.replayRecord||presentationRecord(this.race),cameraProgress=progressAtTime(cameraRecord.sectorTimes,this.elapsed,this.event.id,this.race.routeVersion);
    const points=this.route.map(p=>this.project(...p));
    const index=this.replayRecord?presentationFrame(this.replayRecord,this.elapsed,this.event.id).index:Math.min(this.event.sectors.length-1,Math.max(0,this.race.index-(this.motion?1:0)));
    const target=this.follow||!this.cameraState?sectionCamera(points,this.checkpoints,index||0,w,h,this.scale,cameraProgress):this.cameraState;
    if(!this.cameraState)this.cameraState={...target};
    if(this.follow&&!this.paused)for(const key of ['zoom','x','y'])this.cameraState[key]+=(target[key]-this.cameraState[key])*.12;
    if(this.follow&&!this.paused){
      const car=points[Math.min(800,Math.floor(cameraProgress*800))],z=this.cameraState.zoom;
      this.cameraState.x=Math.max(w*.15-car[0]*z,Math.min(w*.85-car[0]*z,this.cameraState.x));
      this.cameraState.y=Math.max(h*.15-car[1]*z,Math.min(h*.85-car[1]*z,this.cameraState.y));
    }
    // Keep the view inside the cached world: tracking near the start/finish
    // must not expose a second, unzoomed copy of the track underneath.
    const {zoom}=this.cameraState;
    const tx=this.cameraState.x=this.follow?(zoom>=1?Math.max(w*(1-zoom),Math.min(0,this.cameraState.x)):w*(1-zoom)/2):Math.max(80-w*zoom,Math.min(w-80,this.cameraState.x));
    const ty=this.cameraState.y=this.follow?(zoom>=1?Math.max(h*(1-zoom),Math.min(0,this.cameraState.y)):h*(1-zoom)/2):Math.max(60-h*zoom,Math.min(h-60,this.cameraState.y));
    this.onCameraChange?.();
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.fillStyle=this.groundGradient(c,tx,ty,tx+w*zoom,ty+h*zoom);c.fillRect(0,0,w,h);
    c.drawImage(this.background,tx,ty,w*zoom,h*zoom);
    const fog=c.createLinearGradient(0,ty+h*.68*zoom,0,ty+h*zoom);fog.addColorStop(0,'#10212500');fog.addColorStop(1,'#102125e6');
    c.fillStyle=fog;c.fillRect(0,0,w,h);
    c.setTransform(this.dpr*zoom,0,0,this.dpr*zoom,this.dpr*tx,this.dpr*ty);
    if(!this.replayRecord&&!this.race.finished&&['duel','timeattack'].includes(this.event.mode))this.drawDecisionGuide(index);
    const visualRecord=this.replayRecord||presentationRecord(this.race),frame=presentationFrame(visualRecord,this.elapsed,this.event.id);
    const moving=!!this.motion&&!this.paused&&!this.race.player.dnf;
    this.sound?.update(frame,moving&&document.visibilityState!=='hidden');
    this.onPresentation?.(frame,moving);
    const direction=progress=>{
      const n=Math.max(10,Math.min(790,Math.floor(progress*800))),a=this.route[n-10],b=this.route[n],d=this.route[n+10];
      return Math.sign((b[0]-a[0])*(d[1]-b[1])-(b[1]-a[1])*(d[0]-b[0]))||1;
    };
    const visualYaw=(frame,progress)=>this.event.mode==='drift'?driftVisualYaw(this.route,progress,frame):frame.yaw*direction(progress);
    if(['duel','timeattack'].includes(this.event.mode)&&!this.motion&&!this.replayRecord&&!this.race.finished&&this.event.sectors[this.race.index]){
      const start=this.checkpoints[this.race.index],end=this.checkpoints[this.race.index+1],trace=[];
      for(let j=0;j<=48;j++){
        const fraction=j/48,progress=start+(end-start)*fraction,point=this.project(...this.geometry.at(progress)),next=this.project(...this.geometry.at(Math.min(1,progress+.0005))),previous=this.project(...this.geometry.at(Math.max(0,progress-.0005))),angle=progress<1?Math.atan2(next[1]-point[1],next[0]-point[0]):Math.atan2(point[1]-previous[1],point[0]-previous[0]);
        const pose=lineFrame({sectorTimes:[1],lines:[this.previewLine||'neutral']},fraction),lane=racingLane(-9,{fraction,lineId:this.previewLine||'neutral',lineOffset:pose.offset,position:0},direction(progress),this.event.mode)*this.scale;
        trace.push([point[0]-Math.sin(angle)*lane,point[1]+Math.cos(angle)*lane]);
      }
      this.path(c,trace,'#ffb477bb',Math.max(1.3/(this.cameraState?.zoom||1),2*this.scale),[6*this.scale,4*this.scale]);
    }
    if(this.replayRecord){
      const progress=progressAtTime(visualRecord.sectorTimes,this.elapsed,this.event.id,this.race.routeVersion),sign=direction(progress);
      this.drawCar(progress,-4,this.replayRecord.carId,'REPLAY',false,visualYaw(frame,progress),racingLane(-4,frame,sign,this.event.mode)+4,frame);
    }else{
      const playerTimes=visualRecord.sectorTimes;
      if(this.ghost&&this.showGhost){
        const progress=progressAtTime(this.ghost.sectorTimes,this.elapsed,this.event.id,this.ghost.routeVersion),ghost=presentationFrame(this.ghost,this.elapsed,this.event.id);
        this.drawCar(progress,0,this.ghost.carId,'BEST',true,visualYaw(ghost,progress),racingLane(0,ghost,direction(progress),this.event.mode));
      }
      if(['duel','drag'].includes(this.race.mode)){
        const aiRecord=presentationRecord(this.race,true),aiTimes=aiRecord.sectorTimes;
        let progress=progressAtTime(aiTimes,this.elapsed,this.event.id,this.race.routeVersion);
        const ai=presentationFrame(aiRecord,this.elapsed,this.event.id);
        this.drawCar(Math.min(this.race.opponent.dnf?this.checkpoints[aiTimes.length]:1,progress),this.race.opponent.dnf?38:9,this.race.rival.car.id,this.race.opponent.dnf?'RIVAL DNF':this.event.mode==='duel'&&aiTimes.length?'RIVAL · '+aiTimes.at(-1).toFixed(2)+' с':'RIVAL',false,this.race.opponent.dnf?.7:ai.yaw*direction(progress),this.race.opponent.dnf?0:racingLane(9,ai,direction(progress),this.event.mode)-9,ai);
      }
      const progress=Math.min(this.race.player.dnf?this.checkpoints[playerTimes.length]:1,progressAtTime(playerTimes,this.elapsed,this.event.id,this.race.routeVersion));
      this.drawCar(progress,this.race.player.dnf?-38:-9,this.race.config.car.id,this.race.player.dnf?'YOU DNF':['duel','timeattack'].includes(this.event.mode)&&playerTimes.length?'YOU · '+playerTimes.at(-1).toFixed(2)+' с':'YOU',false,this.race.player.dnf?.7:visualYaw(frame,progress),this.race.player.dnf?0:racingLane(-9,frame,direction(progress),this.event.mode)+9,frame);
    }
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.drawMinimap(cameraProgress);
    if(this.race.weather!=='dry'){
      c.strokeStyle='#c0d9dc24';c.lineWidth=.8;
      for(let i=0;i<(this.race.weather==='rain'?100:35);i++){
        const x=(i*79+this.time*.09)%w,y=(i*97+this.time*.22)%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-5,y+13);c.stroke();
      }
    }
  }
  drawMinimap(progress){
    const c=this.ctx,w=Math.min(190,this.w*.22),h=105,x=this.w-w-12,y=12,b=this.bounds;
    const scale=Math.min((w-24)/(b[1]-b[0]||1),(h-28)/(b[3]-b[2]||1));
    const points=this.route.map(([a,d])=>{const [px,py]=this.layout.transform(a,d);return [x+w/2+(px-(b[0]+b[1])/2)*scale,y+h/2+7+(py-(b[2]+b[3])/2)*scale];});
    c.save();c.fillStyle='#101b1cee';c.beginPath();c.rect(x,y,w,h);c.fill();c.font='10px monospace';c.fillStyle='#b7c9bc';c.fillText('MAP',x+10,y+15);
    this.path(c,points,'#6e8b81',2);
    const index=Math.min(this.event.sectors.length-1,this.replayRecord?presentationFrame(this.replayRecord,this.elapsed,this.event.id).index:Math.max(0,this.race.index-(this.motion?1:0))),start=Math.floor(this.checkpoints[index]*800),end=Math.ceil(this.checkpoints[index+1]*800);
    this.path(c,points.slice(start,end+1),'#ffab78',3);
    const dot=(fraction,color)=>{const p=points[Math.max(0,Math.min(800,Math.floor(fraction*800)))];c.fillStyle=color;c.beginPath();c.arc(p[0],p[1],3,0,7);c.fill();};
    dot(1,'#9dc6ac');dot(progress,'#ffab78');
    if(!this.replayRecord&&['duel','drag'].includes(this.race.mode))dot(progressAtTime(this.race.history.map(r=>r.aiTime).filter(t=>t!==null),this.elapsed,this.event.id,this.race.routeVersion),'#b9a1df');
    if(this.cameraState){
      const camera=this.cameraState,convert=(px,py)=>[x+w/2+(px-this.layout.center[0])/this.scale*scale,y+h/2+7+(py-this.layout.center[1])/this.scale*scale];
      const a=convert(-camera.x/camera.zoom,-camera.y/camera.zoom),b=convert((this.w-camera.x)/camera.zoom,(this.h-camera.y)/camera.zoom);
      const left=Math.max(x+4,Math.min(x+w-4,a[0])),top=Math.max(y+20,Math.min(y+h-4,a[1])),right=Math.max(left,Math.min(x+w-4,b[0])),bottom=Math.max(top,Math.min(y+h-4,b[1]));
      c.strokeStyle='#f2d2a788';c.lineWidth=1;c.strokeRect(left,top,right-left,bottom-top);
    }
    c.restore();
  }
  loop(now) {
    if(this.disposed)return;
    if(!this.paused)this.time=now;
    if(this.motion&&!this.paused){
      const t=Math.min(1,(now-this.motion.started)/this.motion.duration);
      this.elapsed=this.motion.from+(this.motion.to-this.motion.from)*t;
      this.onTick?.(this.elapsed,{fraction:t,from:this.fromState,to:this.race.player});
      if(t===1){this.motion=null;this.onComplete?.();}
    }
    if(this.disposed)return;
    this.draw();this.frame=requestAnimationFrame(this.loop);
  }
}
