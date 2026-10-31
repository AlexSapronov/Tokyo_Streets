import {driftFrame} from './replay.js';
import {CARS, getEvent} from './data.js';
import {checkpointFractions, progressAtTime} from './progress.js';
import {topVehicleSVG} from './vehicles.js';

function routePoints(anchors) {
  const points = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    for (let j = 0; j < 32; j++) {
      const t = j / 32;
      const [a,b,c,d] = [anchors[Math.max(0,i-1)], anchors[i], anchors[i+1], anchors[Math.min(anchors.length-1,i+2)]];
      points.push(b.map((_,k) => .5 * (2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));
    }
  }
  points.push(anchors.at(-1));
  let length = 0;
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
    lengths.push(length);
  }
  // Uniform arc-length lookup: markers and ghosts do not jump at spline joints.
  return Array.from({length: 801}, (_, n) => {
    const distance = n / 800 * length;
    let i = lengths.findIndex(value => value >= distance);
    if (i <= 0) return points[0];
    const t = (distance-lengths[i-1])/(lengths[i]-lengths[i-1] || 1);
    return points[i].map((value,k) => points[i-1][k] + (value-points[i-1][k])*t);
  });
}
export class Scene {
  constructor(canvas, race, ghost = null, showGhost = true) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.event = getEvent(race.eventId);
    this.route = routePoints(this.event.anchors);
    this.checkpoints = checkpointFractions(this.event.id);
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
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }
  destroy() {
    this.disposed = true;
    this.resize.disconnect();
    cancelAnimationFrame(this.frame);
  }
  size() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1,rect.width);
    this.h = Math.max(1,rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1,2);
    this.canvas.width = this.w*this.dpr;
    this.canvas.height = this.h*this.dpr;
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    const flat = this.route.map(([x,y]) => [x-y*.46,x*.24+y*.49]);
    this.bounds = [Math.min(...flat.map(p=>p[0])),Math.max(...flat.map(p=>p[0])),
      Math.min(...flat.map(p=>p[1])),Math.max(...flat.map(p=>p[1]))];
    this.scale = Math.min(this.w*.67/(this.bounds[1]-this.bounds[0]),this.h*.69/(this.bounds[3]-this.bounds[2]));
    this.renderBackground();
  }
  project(x,y,z=0) {
    const b=this.bounds,s=this.scale;
    return [this.w*.61+(x-y*.46-(b[0]+b[1])/2)*s,
      this.h*.56+(x*.24+y*.49-(b[2]+b[3])/2-z)*s];
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
    const [px,py]=this.project(x,y),s=this.scale,h=(24+seed*24)*s;
    ctx.fillStyle='#071a1688';ctx.beginPath();ctx.ellipse(px+9*s,py+3*s,15*s,6*s,0,0,7);ctx.fill();
    this.path(ctx,[[px,py],[px,py-h*.5]],'#4c5140',2*s);
    this.polygon(ctx,[[px-14*s,py-7*s],[px,py-h],[px+14*s,py-7*s]],seed>.5?'#264c3b':'#1f4037');
    this.polygon(ctx,[[px,py-h],[px,py-7*s],[px+14*s,py-7*s]],'#15312d');
  }
  renderBackground() {
    const c=this.background.getContext('2d'),w=this.w,h=this.h,s=this.scale;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    const circuit=['circuit','dragstrip','driftpark'].includes(this.event.theme),ridge=this.event.theme==='ridge',highway=this.event.theme==='highway';
    const bg=c.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,circuit?'#263338':ridge?'#2b2939':'#152d2c');bg.addColorStop(1,'#101d23');
    c.fillStyle=bg;c.fillRect(0,0,w,h);
    if (!circuit&&!highway) {
      this.polygon(c,[[0,h*.4],[w*.1,h*.18],[w*.25,h*.3],[w*.39,h*.04],[w*.52,h*.32],[w*.65,h*.11],[w*.8,h*.3],[w,h*.15],[w,h],[0,h]],ridge?'#383647':'#213d35');
      this.polygon(c,[[0,h*.7],[w*.15,h*.44],[w*.31,h*.59],[w*.44,h*.31],[w*.58,h*.6],[w*.75,h*.38],[w,h*.7],[w,h],[0,h]],ridge?'#2c333c':'#1c3630');
    }
    const road=this.route.map(point=>this.project(...point));
    if (!circuit) this.path(c,road.map(([x,y])=>[x,y+18*s]),'#081419',62*s);
    this.path(c,road,circuit?'#ddd7be':'#71887b',54*s);
    this.path(c,road,circuit?'#90494a':'#a0a38d',49*s,circuit?[9*s,9*s]:[]);
    this.path(c,road,'#263a3e',44*s);
    this.path(c,road,'#3c5050',37*s);
    this.path(c,road,circuit?'#d4d9bd55':'#cbbf8c80',1.5*s,[9*s,12*s]);
    if (!circuit&&!highway) {
      for(let i=0;i<135;i++) {
        const x=Math.sin(i*127.1)*430,y=((i*173)%1350)-60;
        const near=this.route.some((point,k)=>k%10===0&&Math.hypot(point[0]-x,point[1]-y)<60);
        if(!near)this.tree(c,x,y,(Math.sin(i*43)+1)/2);
      }
    } else if(!highway&&this.event.theme!=='dragstrip') {
      // Paddock scenery belongs to circuit layouts, not the drag racing lanes.
      for(let i=0;i<6;i++) {
        const [x,y]=this.project(-160+i*50,500);
        this.polygon(c,[[x,y],[x+45*s,y+11*s],[x+45*s,y-30*s],[x,y-41*s]],'#64716c');
        this.polygon(c,[[x-7*s,y-43*s],[x+38*s,y-32*s],[x+58*s,y-45*s],[x+12*s,y-56*s]],'#8a9a8b');
        c.fillStyle='#f5c784';c.fillRect(x+12*s,y-19*s,17*s,8*s);
      }
    }
    if(highway){
      // Buildings stay beside the road, never across a racing lane.
      for(let i=0;i<12;i++){const y=i*280+60,x=(i%2?1:-1)*(130+i%3*35),near=this.route.some((p,k)=>k%10===0&&Math.hypot(p[0]-x,p[1]-y)<80);if(near)continue;const [px,py]=this.project(x,y);this.polygon(c,[[px,py],[px+35*s,py+9*s],[px+35*s,py-55*s],[px,py-64*s]],'#263b48');for(let j=0;j<4;j++){c.fillStyle='#d9c68a';c.fillRect(px+8*s,py-(12+j*11)*s,6*s,4*s);}}
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
      const point=road[Math.min(800,Math.floor(this.checkpoints[i]*800))];
      c.beginPath();c.arc(point[0],point[1],i===0||i===this.checkpoints.length-1?6*s:3*s,0,7);
      c.fillStyle=i===this.checkpoints.length-1?'#ffac77':'#b6c6ad';c.fill();
      if(i>0&&i<this.checkpoints.length-1){c.font='10px monospace';c.fillStyle='#b0c1b0';c.fillText(String(i).padStart(2,'0'),point[0]+15*s,point[1]-12*s);}
    }
    const fog=c.createLinearGradient(0,h*.68,0,h);fog.addColorStop(0,'#10212500');fog.addColorStop(1,'#102125e6');
    c.fillStyle=fog;c.fillRect(0,0,w,h);
  }
  animateSector(race,ghost,duration) {
    this.fromState=this.race.player;this.race=race;this.ghost=ghost;
    this.motion={from:this.elapsed,to:race.player.time,started:performance.now(),duration};
    this.paused=false;
  }
  replay(record,duration=12000) {
    this.replayRecord=record;
    this.elapsed=0;
    this.motion={from:0,to:record.time,started:performance.now(),duration};
  }
  setPaused(value) {
    if(value&&!this.paused)this.pauseAt=performance.now();
    if(!value&&this.paused&&this.motion)this.motion.started+=performance.now()-this.pauseAt;
    this.paused=value;
  }
  setSpeed(multiplier) {
    if(!this.motion)return;
    const now=this.paused?this.pauseAt:performance.now();
    const fraction=Math.min(1,(now-this.motion.started)/this.motion.duration);
    const duration=this.motion.duration/(multiplier/this.speed);
    this.motion.started=now-fraction*duration;this.motion.duration=duration;this.speed=multiplier;
  }
  drawCar(progress,lane,carId,label,ghost=false,yaw=0) {
    const n=Math.max(0,Math.min(799,Math.floor(progress*800))),point=this.project(...this.route[n]),next=this.project(...this.route[n+1]);
    const c=this.ctx,s=this.scale,a=Math.atan2(next[1]-point[1],next[0]-point[0]);
    c.save();c.translate(point[0]-Math.sin(a)*lane*s,point[1]+Math.cos(a)*lane*s);c.rotate(a+yaw);
    c.globalAlpha=ghost?.4:1;
    if(!ghost){c.fillStyle='#050b1280';c.beginPath();c.ellipse(0,4*s,23*s,10*s,0,0,7);c.fill();}
    const sprite=this.sprites.get(carId);
    if(sprite?.complete&&sprite.naturalWidth)c.drawImage(sprite,-29*s,-14*s,58*s,28*s);
    if(!ghost){
      const beam=c.createLinearGradient(22*s,0,85*s,0);beam.addColorStop(0,'#fff3b23b');beam.addColorStop(1,'#fff3b200');
      this.polygon(c,[[22*s,-8*s],[85*s,-26*s],[85*s,26*s],[22*s,8*s]],beam);
      if(this.motion&&(this.race.history.at(-1)?.slip>.05||this.race.history.at(-1)?.cardId==='drag-burnout'||Math.abs(yaw)>.15)){c.fillStyle='#b1c3ba50';c.beginPath();c.ellipse(-32*s,0,13*s,7*s,0,0,7);c.fill();}
    }
    c.restore();c.save();c.font='bold 9px monospace';c.fillStyle=ghost?'#b0e1d5':label==='YOU'?'#ffe0b0':'#cab1e8';c.textAlign='center';c.fillText(label,point[0],point[1]-(ghost?35:24)*s);c.restore();
  }
  draw() {
    const c=this.ctx,w=this.w,h=this.h;
    c.setTransform(1,0,0,1,0,0);c.drawImage(this.background,0,0);c.setTransform(this.dpr,0,0,this.dpr,0,0);
    if(this.replayRecord){
      const pose=driftFrame(this.replayRecord,this.elapsed);
      this.drawCar(progressAtTime(this.replayRecord.sectorTimes,this.elapsed,this.event.id),-4,this.replayRecord.carId,'REPLAY',false,pose?.yaw||0);
    }else{
      const playerTimes=this.race.history.map(row=>row.playerTime);
      if(this.ghost&&this.showGhost)this.drawCar(progressAtTime(this.ghost.sectorTimes,this.elapsed,this.event.id),0,this.ghost.carId,'BEST',true,driftFrame(this.ghost,this.elapsed)?.yaw||0);
      if(['duel','drag'].includes(this.race.mode)){
        const aiTimes=this.race.history.map(row=>row.aiTime).filter(time=>time!==null);
        let progress=progressAtTime(aiTimes,this.elapsed,this.event.id);
        const total=aiTimes.reduce((sum,time)=>sum+time,0);
        if(!this.race.opponent.dnf&&aiTimes.length&&this.elapsed>total&&aiTimes.length<this.event.sectors.length){
          progress+=(this.elapsed-total)/aiTimes.at(-1)*(this.checkpoints[aiTimes.length+1]-this.checkpoints[aiTimes.length]);
        }
        this.drawCar(Math.min(this.race.opponent.dnf?this.checkpoints[aiTimes.length]:1,progress),this.race.opponent.dnf?38:9,this.race.rival.car.id,this.race.opponent.dnf?'RIVAL DNF':'RIVAL',false,this.race.opponent.dnf?.7:0);
      }
      const pose=driftFrame({sectorTimes:playerTimes,drift:this.race.player.drift},this.elapsed);
      this.drawCar(Math.min(this.race.player.dnf?this.checkpoints[playerTimes.length]:1,progressAtTime(playerTimes,this.elapsed,this.event.id)),this.race.player.dnf?-38:-9,this.race.config.car.id,this.race.player.dnf?'YOU DNF':'YOU',false,this.race.player.dnf?.7:pose?.yaw||0);
    }
    if(this.race.weather!=='dry'){
      c.strokeStyle='#c0d9dc24';c.lineWidth=.8;
      for(let i=0;i<(this.race.weather==='rain'?100:35);i++){
        const x=(i*79+this.time*.09)%w,y=(i*97+this.time*.22)%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-5,y+13);c.stroke();
      }
    }
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
