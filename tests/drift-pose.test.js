import test from 'node:test';import assert from 'node:assert/strict';import {driftVisualYaw} from '../src/drift-pose.js';import {driftFrame} from '../src/replay.js';import {EVENTS} from '../src/data.js';import {trackGeometry} from '../src/track-geometry.js';
test('healthy drifts on every venue retain a forward component regardless of stored scoring direction',()=>{
 for(const event of EVENTS.filter(e=>e.mode==='drift')){const route=trackGeometry(event).route;for(let i=0;i<=800;i++){const a=driftVisualYaw(route,i/800,{driftAngle:86*Math.PI/180,spinYaw:0}),b=driftVisualYaw(route,i/800,{driftAngle:-86*Math.PI/180,spinYaw:0});assert.equal(a,b);assert.ok(Math.cos(a)>.25,event.id+' '+i);if(i)assert.ok(Math.abs(a-driftVisualYaw(route,(i-1)/800,{driftAngle:86*Math.PI/180}))<.34);}}
});
test('nose turns into the actual bend, keeps that side through the connector and changes smoothly at the opposite turn',()=>{
 const route=Array.from({length:801},(_,i)=>{const t=i/800*Math.PI*3;return [t,Math.sin(t)];});
 const clips={sectorTimes:[10,10],drift:{clips:[{phase:'hold',direction:1,angleDegrees:60,valid:true,spin:false,points:0},{phase:'transition',direction:-1,angleDegrees:60,valid:true,spin:false,points:0}]}};assert.ok(Math.abs(driftFrame(clips,11.25).driftAngle-Math.PI/3)<1e-9);
 const frame={driftAngle:.8};assert.ok(driftVisualYaw(route,.17,frame)<0);assert.ok(driftVisualYaw(route,.5,frame)>0);assert.ok(driftVisualYaw(route,.83,frame)<0);
});
test('a recorded spin is a short incident, not a backwards drive for the rest of the sector',()=>{
 const record={sectorTimes:[20],drift:{clips:[{phase:'init',direction:1,angleDegrees:80,valid:false,spin:true,points:0}]}},snapshot=structuredClone(record);
 assert.equal(driftFrame(record,.3).spinYaw,0);assert.ok(driftFrame(record,1).spinYaw>0);assert.equal(driftFrame(record,3).spinYaw,0);assert.equal(driftFrame(record,10).yaw,0);assert.equal(driftFrame(record,20).yaw,0);assert.deepEqual(record,snapshot);
 const valid={sectorTimes:[10],drift:{clips:[{phase:'exit',direction:-1,angleDegrees:25,valid:true,spin:false,points:10}]}};assert.equal(driftFrame(valid,10).yaw,0);
});
