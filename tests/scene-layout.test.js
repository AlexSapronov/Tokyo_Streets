import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneLayout} from '../src/scene-layout.js';
import {EVENTS} from '../src/data.js';
test('natural route projection fits with uniform scale and road margins',()=>{
 for(const event of EVENTS)for(const [width,height] of [[1700,500],[2400,540],[950,420]]){
  const before=structuredClone(event.anchors),layout=sceneLayout(event.anchors,width,height),points=event.anchors.map(([x,y])=>layout.transform(x,y));
  assert.ok(layout.bounds[1]-layout.bounds[0]>=layout.bounds[3]-layout.bounds[2],event.id);
  assert.ok(points.at(-1)[0]>=points[0][0]-.001,event.id);
  for(const [x,y] of points){const px=layout.center[0]+(x-(layout.bounds[0]+layout.bounds[1])/2)*layout.scale,py=layout.center[1]+(y-(layout.bounds[2]+layout.bounds[3])/2)*layout.scale;assert.ok(px>0&&px<width);assert.ok(py>0&&py<height);}
  const other=sceneLayout(event.anchors,width*2,height);
  assert.deepEqual(layout.transform(123,456),other.transform(123,456),'viewport must never deform the road');
  assert.deepEqual(event.anchors,before);
 }
});

test('zoom steps are bounded and anchored at the cursor',async()=>{
 const {ZOOM_STEPS,nextZoom,zoomAround}=await import('../src/scene-camera.js');assert.ok(ZOOM_STEPS.length>8);assert.equal(nextZoom(1,1),1.25);assert.equal(nextZoom(1.5,-1),1.25);assert.equal(nextZoom(24,1),24);assert.equal(nextZoom(.5,-1),.5);
 const c={zoom:2,x:-120,y:-80},n=zoomAround(c,3,400,250);assert.equal((400-n.x)/n.zoom,(400-c.x)/c.zoom);assert.equal((250-n.y)/n.zoom,(250-c.y)/c.zoom);assert.equal(zoomAround(c,99,0,0).zoom,24);
});
