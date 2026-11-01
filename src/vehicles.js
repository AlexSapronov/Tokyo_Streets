// Model-specific silhouettes and front details, projected from vector geometry.
// Long sedans, upright hatches, open cabins and low mid-engine coupes share no bitmap assets.
const profiles = {
  supraGT4:{length:446,width:188,roof:108,nose:169,tail:-186,cabinFront:57,cabinRear:-145,color:'#eee9df',shade:'#a6aaa9',doors:2,wing:true},
  ae86: {length: 420, width: 163, roof: 119, nose: 143, tail: -180, cabinFront: 90, cabinRear: -193, color: '#f0ebd9', shade: '#b5baaf'},
  chaser: {length: 472, width: 175, roof: 123, nose: 166, tail: -185, cabinFront: 100, cabinRear: -150, color: '#9772d3', shade: '#5b437d'},
  evo: {length: 435, width: 177, roof: 127, nose: 151, tail: -170, cabinFront: 95, cabinRear: -140, color: '#df554b', shade: '#983b36'},
  mx5:{length:397,width:168,roof:105,nose:145,tail:-170,cabinFront:45,cabinRear:-100,color:'#37956c',shade:'#205d4b',body:'roadster',doors:2,popups:true},
  s13:{length:447,width:169,roof:117,nose:155,tail:-180,cabinFront:88,cabinRear:-144,color:'#89bcb2',shade:'#527b78',doors:2},
  rx7:{length:429,width:176,roof:110,nose:159,tail:-176,cabinFront:63,cabinRear:-165,color:'#eec64d',shade:'#9b7f34',doors:2,popups:true,wing:true},
  r32:{length:455,width:176,roof:119,nose:160,tail:-180,cabinFront:88,cabinRear:-142,color:'#7d8ba4',shade:'#4d5a73',doors:2,wing:true},
  supra:{length:452,width:181,roof:115,nose:169,tail:-186,cabinFront:57,cabinRear:-164,color:'#d5dce0',shade:'#89959d',doors:2,wing:true},
  ek9:{length:418,width:169,roof:130,nose:152,tail:-172,cabinFront:100,cabinRear:-180,color:'#ececd7',shade:'#b7b9a4',doors:2},
  nsx:{length:443,width:181,roof:103,nose:175,tail:-185,cabinFront:68,cabinRear:-117,color:'#e9674c',shade:'#983f36',doors:2,popups:true,wing:true},
  r34:{length:460,width:178,roof:119,nose:161,tail:-182,cabinFront:90,cabinRear:-143,color:'#356dbb',shade:'#214678',doors:2,wing:true}

};
const bodyStyles={supraGT4:{roofFront:15,roofRear:-100,round:9,spokes:10,feature:'gt4-widebody-splitter'},ae86:{roofFront:28,roofRear:-100,round:3,spokes:8,feature:'panda-popups'},chaser:{roofFront:40,roofRear:-125,round:5,spokes:6,feature:'four-door-quad-lamps'},evo:{roofFront:40,roofRear:-115,round:4,spokes:6,feature:'vented-hood-rally-wing'},mx5:{roofFront:-12,roofRear:-90,round:10,spokes:8,feature:'open-roadster'},s13:{roofFront:35,roofRear:-105,round:5,spokes:5,feature:'slim-projector-nose'},rx7:{roofFront:14,roofRear:-105,round:14,spokes:5,feature:'rounded-rotary-coupe'},r32:{roofFront:36,roofRear:-110,round:5,spokes:5,feature:'boxy-gtr-grille'},supra:{roofFront:15,roofRear:-105,round:14,spokes:5,feature:'oval-lamps-hoop-wing'},ek9:{roofFront:35,roofRear:-140,round:6,spokes:7,feature:'upright-hatch'},nsx:{roofFront:25,roofRear:-83,round:7,spokes:5,feature:'low-mid-engine-black-roof'},r34:{roofFront:37,roofRear:-112,round:5,spokes:6,feature:'boxy-gtr-grille'}};
const project = ([x, y, z]) => [310 + x * .84 - y * .78, 212 + x * .31 + y * .34 - z];
const points = vertices => vertices.map(vertex => project(vertex).map(n => n.toFixed(1)).join(',')).join(' ');
const polygon = (vertices, fill, extra = '') => `<polygon points="${points(vertices)}" fill="${fill}" ${extra}/>`;
const line = (a, b, color = '#152126', width = 1.5) => {
  const p = project(a), q = project(b);
  return `<path d="M${p.join(',')}L${q.join(',')}" stroke="${color}" stroke-width="${width}" fill="none"/>`;
};
function roundedShape(vertices,fill,radius=5){
 const pts=vertices.map(project),lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const edges=pts.map((p,i)=>{const prev=pts[(i+pts.length-1)%pts.length],next=pts[(i+1)%pts.length],a=Math.min(.25,radius/Math.hypot(p[0]-prev[0],p[1]-prev[1])),b=Math.min(.25,radius/Math.hypot(p[0]-next[0],p[1]-next[1]));return {p,start:lerp(p,prev,a),end:lerp(p,next,b)};});
 return `<path d="M${edges[0].start.join(',')}${edges.map(e=>'Q'+e.p.join(',')+' '+e.end.join(',')+'L'+edges[(edges.indexOf(e)+1)%edges.length].start.join(',')).join('')}Z" fill="${fill}"/>`;
}
function frontDetails(id,p,L,W){
 const face=(a,b,low,high,color)=>polygon([[L+3,a,low],[L+3,b,low],[L+3,b,high],[L+3,a,high]],color);
 let out='';
 const dark='#142229',light='#e0e7da';
 if(id==='ae86'){
  out+=face(-W+8,W-8,30,43,dark)+face(-27,27,48,60,dark);out+=face(-15,15,32,40,'#e5e3cf');
  for(const y of [-W+16,W-29])out+=face(y,y+13,44,48,'#e7a55d');
 }else if(id==='chaser'){
  out+=face(-25,25,45,63,dark);for(const y of [-18,-9,0,9,18])out+=line([L+4,y,46],[L+4,y,61],'#aabbb4',1.5);
  for(const side of [-1,1])for(const n of [0,1]){const a=side<0?-W+13+n*24:27+n*24;out+=face(a,a+20,53,63,light);}
  out+=face(-W+12,W-12,30,36,dark);
 }else if(id==='evo'){
  out+=face(-43,43,27,45,dark);for(let z=29;z<42;z+=4)out+=line([L+4,-34,z],[L+4,34,z],'#7d999c',1.2);
  for(const y of [-W+18,W-34])out+=roundedShape([[L+4,y,36],[L+4,y+16,36],[L+4,y+16,49],[L+4,y,49]],'#e4d9ab',5);
  out+=polygon([[L+4,-6,54],[L+4,0,63],[L+4,6,54]],'#cececa');
 }else if(id==='s13'||id==='r32'||id==='ek9'){
  out+=face(-27,27,49,61,dark)+face(-W+11,W-11,29,39,dark);
  for(const side of [-1,1]){const a=side<0?-W+13:31;out+=face(a,a+W-44,52,id==='ek9'?65:62,light);out+=line([L+4,a+12,53],[L+4,a+12,61],'#789397',2);}
  if(id==='r32')out+=face(-8,9,52,59,'#bd4541');
  if(id==='ek9')out+=face(-5,5,53,61,'#cf4d43');
 }else if(id==='supraGT4'||id==='supra'||id==='rx7'||id==='mx5'||id==='nsx'){
  out+=roundedShape([[L+4,-39,29],[L+4,39,29],[L+4,34,46],[L+4,-34,46]],dark,8);
  if(id==='supra')for(const side of [-1,1]){const y=side<0?-W+12:30;out+=roundedShape([[L+4,y,51],[L+4,y+43,51],[L+4,y+40,64],[L+4,y+7,66]],'#8caaa9',7);for(const d of [10,23,34])out+=line([L+5,y+d,55],[L+5,y+d,61],light,5);}
  if(id==='rx7')for(const y of [-W+16,W-31])out+=face(y,y+15,36,43,'#dedcbd');
  if(id==='nsx')out+=face(-W+8,W-8,45,49,dark);
 }
 // Mirrors and a clean hood edge make the viewing angle unambiguous.
 for(const side of [-1,1]){out+=line([p.cabinFront-8,side*(W-8),72],[p.cabinFront+3,side*(W+8),78],p.shade,4);out+=polygon([[p.cabinFront-8,side*(W-5),77],[p.cabinFront-4,side*(W+13),77],[p.cabinFront+12,side*(W+13),80],[p.cabinFront+10,side*(W-5),82]],p.shade);}
 return out;
}
function wheel(x, y, radius = 29, spokes=6) {
  const ring = (r, fill) => polygon(Array.from({length: 28}, (_, i) => {
    const a = i / 28 * Math.PI * 2; return [x + Math.cos(a) * r, y, 31 + Math.sin(a) * r];
  }), fill);
  let svg = ring(radius, '#0a1116') + ring(radius - 6, '#2e393e') + ring(radius - 9, '#a3b0ad') + ring(7, '#2b373a');
  for (let i = 0; i < spokes; i++) {
    const a = i * Math.PI * 2 / spokes;
    svg += line([x + Math.cos(a) * 6, y + 1, 31 + Math.sin(a) * 6],
      [x + Math.cos(a) * 18, y + 1, 31 + Math.sin(a) * 18], '#3b494c', 3);
  }
  return svg;
}
export function vehicleSVG(car) {
  const p = profiles[car.id] || profiles.ae86,style=bodyStyles[car.id]||bodyStyles.ae86;
  const L = p.length / 2, W = p.width / 2, z = 65;
  const outline = [[-L+9,-W+7,z],[-L,-W+24,z],[L-15,-W,z],[L,-W+18,z],
    [L,W-18,z],[L-15,W,z],[-L,W-8,z],[-L-4,W-25,z]];
  let body = `<ellipse cx="300" cy="246" rx="230" ry="38" fill="#000" opacity=".23"/>`;
  body += wheel(-L + 75, -W) + wheel(L - 75, -W);
  body += polygon(outline.map(v => [v[0],v[1],28]), '#172329');
  body += polygon([outline[5],outline[6],[-L,W-8,31],[L-15,W,31]], p.shade);
  body += polygon([outline[3],outline[4],[L,W-18,29],[L,-W+18,29]], p.shade);
  body += roundedShape(outline,p.color,style.round);
  // Flat hood, trunk and raised cabin: the AE86 has a long sloping hatch;
  // the sedans have a separate rear window and a visible trunk.
  const roofFront=style.roofFront,roofRear=style.roofRear;
  const cabinWidth=W-(['rx7','supra'].includes(car.id)?18:10);
  if(p.body!=='roadster')body += polygon([[p.cabinRear,-cabinWidth,z],[p.cabinRear,cabinWidth,z],
    [roofRear,cabinWidth-10,p.roof],[roofRear,-cabinWidth+10,p.roof]], '#263e44');
  body += polygon([[p.cabinFront,-cabinWidth,z],[p.cabinFront,cabinWidth,z],
    [roofFront,cabinWidth-10,p.roof],[roofFront,-cabinWidth+10,p.roof]], '#35525b');
  if(p.body!=='roadster')body += roundedShape([[roofRear,-cabinWidth+10,p.roof],[roofFront,-cabinWidth+10,p.roof],
    [roofFront,cabinWidth-10,p.roof],[roofRear,cabinWidth-10,p.roof]],p.color,style.round);
  if(p.body!=='roadster')body += polygon([[p.cabinRear,cabinWidth,z],[p.cabinFront,cabinWidth,z],
    [roofFront,cabinWidth-10,p.roof],[roofRear,cabinWidth-10,p.roof]], p.shade);
  if(p.body!=='roadster')body += roundedShape([[p.cabinRear+13,cabinWidth+1,z+6],[p.cabinFront-13,cabinWidth+1,z+6],
    [roofFront-6,cabinWidth-9,p.roof-7],[roofRear+6,cabinWidth-9,p.roof-7]],'#203a43',style.round/2);
  const pillar = car.id === 'ae86' ? -45 : -20;
  if(p.body!=='roadster')body += line([pillar,cabinWidth+2,z+5],[pillar-4,cabinWidth-8,p.roof-5],p.shade,5);
  body += line([p.cabinFront-8,cabinWidth,69],[p.cabinRear+10,cabinWidth,69],p.color,3);
  // Panel gaps, door handles and side skirts.
  const doorXs = car.id === 'ae86'||p.doors===2 ? [-87,65] : [-133,-20,80];
  for (const x of doorXs) body += line([x,W,60],[x,W,34],p.shade,1.2);
  for (const x of car.id === 'ae86'||p.doors===2 ? [-69] : [-114,-3]) body += line([x,W+1,58],[x+16,W+1,58],'#27323a',3);
  body += line([-L+12,W,37],[L-24,W,37],car.id === 'ae86' ? '#182326' : p.shade,car.id === 'ae86' ? 12 : 5);
  // Wheel arches sit in the body, with model-specific alloy patterns.
  for(const x of [-L+75,L-75]){
    body+=polygon(Array.from({length:19},(_,i)=>{const a=i/18*Math.PI;return [x+Math.cos(a)*34,W+3,31+Math.sin(a)*34];}),'#101719');
    body+=wheel(x,W+5,29,style.spokes);
    body+=line([x-35,W+5,32],[x-34,W+5,49],p.shade,2)+line([x+34,W+5,49],[x+35,W+5,32],p.shade,2);
  }
  // Sills and two distinct panel reflections give the body depth at garage scale.
  body+=line([-L+110,W+2,32],[L-110,W+2,32],'#111c21',3);
  body+=line([-L+26,W+2,62],[L-25,W+2,62],'#ffffff45',1.5);
  // Nose: lamps, grille, number plate and bumper opening.
  body += polygon([[L,-W+25,57],[L,W-25,57],[L,W-25,43],[L,-W+25,43]], '#17252c');
  if(!['supra','rx7','mx5'].includes(car.id))for (const side of [-1,1]) {
    const a = side < 0 ? -W+17 : 26, b = side < 0 ? -26 : W-17;
    body += polygon([[L+1,a,61],[L+1,b,61],[L+1,b,51],[L+1,a,51]], car.id === 'ae86' ? '#d0d8c5' : '#d6e8e4');
  }
  body += polygon([[L+2,-19,43],[L+2,19,43],[L+2,19,33],[L+2,-19,33]], '#d6dece');
  if (car.id === 'ae86'||p.popups) {
    // Pop-up headlamps, raised above the hood.
    for (const y of [-W+17,W-48]) {
      body += polygon([[L-48,y,z],[L-20,y,z],[L-20,y,z+23],[L-48,y,z+23]], p.shade);
      body += polygon([[L-20,y,z+23],[L-20,y+30,z+23],[L-20,y+30,z+8],[L-20,y,z+8]], '#e9efcf');
      body += polygon([[L-48,y,z+23],[L-20,y,z+23],[L-20,y+30,z+23],[L-48,y+30,z+23]], p.color);
    }
  }
  if (car.id === 'evo') {
    // Twin hood vents, large intercooler opening and tall rear wing.
    for (const y of [-42,14]) body += polygon([[80,y,66],[130,y,66],[130,y+24,66],[80,y+24,66]], '#253035');
    for (const y of [-W+15,W-38]) body += polygon([[L+2,y,43],[L+2,y+23,43],[L+2,y+23,29],[L+2,y,29]], '#16262b');
    for (const y of [-W+13,W-22]) body += polygon([[-L+16,y,65],[-L+26,y,65],[-L+26,y,113],[-L+16,y,113]], p.shade);
    body += polygon([[-L-1,-W-8,113],[-L+46,-W-8,113],[-L+46,W+8,113],[-L-1,W+8,113]], p.color);
  }
  if(p.wing){
    const wingHeight=car.id==='supraGT4'?113:car.id==='supra'?106:car.id==='nsx'?82:91;
    for(const y of [-W+13,W-23])body+=polygon([[-L+18,y,64],[-L+28,y,64],[-L+28,y,wingHeight],[-L+18,y,wingHeight]],p.shade);
    body+=roundedShape([[-L+8,-W-5,wingHeight],[-L+38,-W-5,wingHeight],[-L+38,W+5,wingHeight],[-L+8,W+5,wingHeight]],p.color,car.id==='supra'?9:2);
  }
  body+=frontDetails(car.id,p,L,W);
  if(p.body==='roadster'){
    body+=polygon([[-87,-48,72],[-15,-48,72],[-15,48,72],[-87,48,72]],'#131e23');
    for(const y of [-42,10]){body+=roundedShape([[-77,y,77],[-56,y,77],[-56,y+29,77],[-77,y+29,77]],'#624b39',3);body+=polygon([[-82,y,77],[-82,y+29,77],[-82,y+29,99],[-82,y,99]],'#27383c');}
  }
  if(car.id==='nsx'){body+=polygon([[roofRear,-cabinWidth+10,p.roof+1],[roofFront,-cabinWidth+10,p.roof+1],[roofFront,cabinWidth-10,p.roof+1],[roofRear,cabinWidth-10,p.roof+1]],'#16242b');body+=polygon([[-125,W+2,44],[-84,W+2,44],[-70,W+2,61],[-120,W+2,61]],'#15292f');}
  if(car.id==='ek9')body+=line([p.cabinRear,W-8,69],[roofRear,W-20,p.roof],p.color,8);
  if (car.id === 'chaser') body += line([-L+20,-W+10,67],[-L+20,W-10,67],p.shade,3);
  body += line([L-18,-W+12,67],[p.cabinFront+8,-W+12,67],'#ffffff35',2);
  return `<svg viewBox="15 -15 580 350" data-model="${car.id}" data-body-detail="${style.feature}" role="img" aria-label="${car.name}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
export function topVehicleSVG(car) {
  const p = profiles[car.id] || profiles.ae86;
  const length = p.length/4.37;
  const width = p.width/4.18;
  return `<svg xmlns="http://www.w3.org/2000/svg" data-model="${car.id}" viewBox="0 0 130 64">
    <g transform="translate(65 32)"><rect x="-${length/2-17}" y="-${width/2+3}" width="13" height="${width+6}" rx="3" fill="#070e12"/><rect x="${length/2-28}" y="-${width/2+3}" width="13" height="${width+6}" rx="3" fill="#070e12"/>
    <path d="M${-length/2},${-width/2+5} Q${-length/2-3},0 ${-length/2},${width/2-5} L${length/2-6},${width/2} Q${length/2+2},0 ${length/2-6},${-width/2}Z" fill="${p.color}" stroke="${p.shade}" stroke-width="2"/>
    <path d="M-27,-16 -4,-17 14,-13 14,13 -4,17 -27,16Z" fill="#233e49"/><path d="M-22,-13 -4,-14 -4,14 -22,13Z" fill="${p.color}"/>
    <path d="M-1,-15 8,-12 8,12 -1,15Z" fill="#73959d"/>
    <path d="M${length/2-5},-17v9m0,16v9" stroke="#fff2b4" stroke-width="5"/>
    <path d="M${-length/2+1},-16v8m0,16v8" stroke="#f46155" stroke-width="4"/>
    ${car.id==='supraGT4'?'<path d="M-46,-25v50M22,-20L39,-20L39,20L22,20Z" fill="#bf342c"/><path d="M-51,-27v54" stroke="#121b20" stroke-width="6"/><path d="M15,-12L31,0L15,12Z" fill="#171f22"/>':''}
    ${car.id === 'ae86' ? '<path d="M-45,-19H39M-45,19H39" stroke="#182126" stroke-width="4"/><path d="M30,-16v10m0,12v10" stroke="#eeecc9" stroke-width="6"/>' : ''}
    ${p.popups?'<path d="M30,-16v10m0,12v10" stroke="#fff4c8" stroke-width="6"/>':''}
    ${p.wing?'<path d="M-42,-24v48" stroke="'+p.shade+'" stroke-width="5"/>':''}
    ${car.id==='nsx'?'<path d="M-33,-15v30m5,-30v30m5,-30v30" stroke="#23383e" stroke-width="2"/><path d="M-22,-13H-4V13H-22Z" fill="#17252b"/>':''}
    ${car.id==='r32'?'<path d="M-49,-15v5m0,4v5m0,7v5m0,4v5" stroke="#f56c5c" stroke-width="4"/>':''}
    ${car.id==='ek9'?'<path d="M-36,-17H-10V17H-36Z" fill="#273e45"/><path d="M-26,-14H-9V14H-26Z" fill="#ececd7"/>':''}
    ${p.body==='roadster'?'<rect x="-20" y="-13" width="18" height="26" rx="4" fill="#101a20"/>':''}
    ${car.id === 'chaser' ? '<path d="M-32,-18H27M-32,18H27M-13,-20v6m0,28v6" stroke="#5b437d" stroke-width="2"/>' : ''}
    ${car.id === 'evo' ? '<path d="M-41,-24v48" stroke="#a62f30" stroke-width="7"/><path d="M25,-12h12v6H25zm0,18h12v6H25z" fill="#273035"/>' : ''}
    </g></svg>`;
}
