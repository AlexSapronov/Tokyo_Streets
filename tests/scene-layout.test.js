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
