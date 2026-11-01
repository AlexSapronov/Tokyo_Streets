import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS} from '../src/data.js';
import {trackGeometry,SECTOR_ANCHORS} from '../src/track-geometry.js';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('every road straight is visually straight over its actual simulation interval',()=>{
 for(const event of EVENTS.filter(e=>['duel','timeattack'].includes(e.mode))){
  const before=structuredClone(event),geometry=trackGeometry(event);assert.equal(SECTOR_ANCHORS[event.id].length,event.sectors.length+1);
  assert.equal(geometry.route.length,801);assert.deepEqual(event,before);
  for(let i=0;i<event.sectors.length;i++){
   const piece=geometry.pieces[i],a=geometry.at(piece.start),b=geometry.at(piece.end),chord=[b[0]-a[0],b[1]-a[1]],len=distance(a,b);let deviation=0;
   for(let k=0;k<=100;k++){const p=geometry.at(piece.start+(piece.end-piece.start)*k/100);assert.ok(p.every(Number.isFinite));deviation=Math.max(deviation,Math.abs(chord[0]*(p[1]-a[1])-chord[1]*(p[0]-a[0]))/(len||1));}
   if(piece.type==='straight')assert.ok(deviation<1e-6,event.id+' straight '+i+' deviates '+deviation);
   else assert.ok(deviation>.001,event.id+' corner '+i+' must have curvature');
   if(i+1<geometry.pieces.length)assert.ok(distance(piece.at(1),geometry.pieces[i+1].at(0))<1e-8);
  }
 }
});
test('first, tunnel and finish straights in Haruna map to authored endpoints instead of a global spline',()=>{
 const event=EVENTS.find(e=>e.id==='haruna'),g=trackGeometry(event);
 for(const [sector,start,end] of [[0,0,1],[4,7,8],[7,14,15]]){assert.deepEqual(g.pieces[sector].at(0),event.anchors[start]);assert.deepEqual(g.pieces[sector].at(1),event.anchors[end]);}
});
test('shared drift venues retain the same physical map and real circuits keep closure',()=>{
 for(const event of EVENTS){const g=trackGeometry(event);assert.ok(g.route.flat().every(Number.isFinite));assert.deepEqual(g.at(0),event.anchors[0]);assert.ok(distance(g.at(1),event.anchors.at(-1))<1e-8);if(event.mode==='drift'&&event.streetVenue)assert.equal(g,trackGeometry(EVENTS.find(e=>e.id===event.venueId)));}
 for(const id of ['suzuka','fuji','tsukuba']){const g=trackGeometry(EVENTS.find(e=>e.id===id));assert.ok(distance(g.at(0),g.at(1))<1e-8);}
});
test('consecutive highway straights are collinear and corners meet straight tangents smoothly',()=>{
 const event=EVENTS.find(e=>e.id==='wangan'),g=trackGeometry(event),a=g.pieces[0].at(0),b=g.pieces[1].at(1),p=g.pieces[0].at(1);
 assert.ok(Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<1e-6);
 for(const road of EVENTS.filter(e=>['duel','timeattack'].includes(e.mode))){const map=trackGeometry(road);for(let i=1;i<map.pieces.length;i++){const before=map.pieces[i-1],after=map.pieces[i];if(before.type===after.type)continue;const end=before.at(1),from=before.at(1-1e-5),to=after.at(1e-5),v=[end[0]-from[0],end[1]-from[1]],w=[to[0]-end[0],to[1]-end[1]],dot=(v[0]*w[0]+v[1]*w[1])/(Math.hypot(...v)*Math.hypot(...w));assert.ok(dot>.97,road.id+' join '+i+' tangent mismatch '+dot);}}
});

test('new authored roads have a safe straight/curve fallback without changing input data',()=>{
 const event={id:'new-road',mode:'duel',sectors:[{type:'straight',length:100},{type:'corner',length:100}],anchors:[[0,0],[100,0],[200,100]]},before=structuredClone(event),g=trackGeometry(event);assert.deepEqual(event,before);assert.deepEqual(g.at(0),[0,0]);assert.deepEqual(g.at(1),[200,100]);assert.ok(g.route.flat().every(Number.isFinite));
});
