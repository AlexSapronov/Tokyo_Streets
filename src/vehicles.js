// Distinct vector bodies, projected from small 3D meshes. No bitmap assets.
const profiles = {
  ae86: {length: 420, width: 163, roof: 119, nose: 143, tail: -180, cabinFront: 90, cabinRear: -193, color: '#f0ebd9', shade: '#b5baaf'},
  chaser: {length: 472, width: 175, roof: 123, nose: 166, tail: -185, cabinFront: 100, cabinRear: -150, color: '#9772d3', shade: '#5b437d'},
  evo: {length: 435, width: 177, roof: 127, nose: 151, tail: -170, cabinFront: 95, cabinRear: -140, color: '#df554b', shade: '#983b36'}
};
const project = ([x, y, z]) => [310 + x * .84 - y * .78, 212 + x * .31 + y * .34 - z];
const points = vertices => vertices.map(vertex => project(vertex).map(n => n.toFixed(1)).join(',')).join(' ');
const polygon = (vertices, fill, extra = '') => `<polygon points="${points(vertices)}" fill="${fill}" ${extra}/>`;
const line = (a, b, color = '#152126', width = 1.5) => {
  const p = project(a), q = project(b);
  return `<path d="M${p.join(',')}L${q.join(',')}" stroke="${color}" stroke-width="${width}" fill="none"/>`;
};
function wheel(x, y, radius = 29) {
  const ring = (r, fill) => polygon(Array.from({length: 28}, (_, i) => {
    const a = i / 28 * Math.PI * 2; return [x + Math.cos(a) * r, y, 31 + Math.sin(a) * r];
  }), fill);
  let svg = ring(radius, '#0a1116') + ring(radius - 6, '#2e393e') + ring(radius - 9, '#a3b0ad') + ring(7, '#2b373a');
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    svg += line([x + Math.cos(a) * 6, y + 1, 31 + Math.sin(a) * 6],
      [x + Math.cos(a) * 18, y + 1, 31 + Math.sin(a) * 18], '#3b494c', 3);
  }
  return svg;
}
export function vehicleSVG(car) {
  const p = profiles[car.id] || profiles.ae86;
  const L = p.length / 2, W = p.width / 2, z = 65;
  const outline = [[-L+9,-W+7,z],[-L,-W+24,z],[L-15,-W,z],[L,-W+18,z],
    [L,W-18,z],[L-15,W,z],[-L,W-8,z],[-L-4,W-25,z]];
  let body = `<ellipse cx="300" cy="246" rx="230" ry="38" fill="#000" opacity=".23"/>`;
  body += wheel(-L + 75, -W) + wheel(L - 75, -W);
  body += polygon(outline.map(v => [v[0],v[1],28]), '#172329');
  body += polygon([outline[5],outline[6],[-L,W-8,31],[L-15,W,31]], p.shade);
  body += polygon([outline[3],outline[4],[L,W-18,29],[L,-W+18,29]], p.shade);
  body += polygon(outline, p.color);
  // Flat hood, trunk and raised cabin: the AE86 has a long sloping hatch;
  // the sedans have a separate rear window and a visible trunk.
  const roofFront = p.cabinFront - 76, roofRear = car.id === 'ae86' ? -105 : -95;
  const cabinWidth = W - 10;
  body += polygon([[p.cabinRear,-cabinWidth,z],[p.cabinRear,cabinWidth,z],
    [roofRear,cabinWidth-10,p.roof],[roofRear,-cabinWidth+10,p.roof]], '#263e44');
  body += polygon([[p.cabinFront,-cabinWidth,z],[p.cabinFront,cabinWidth,z],
    [roofFront,cabinWidth-10,p.roof],[roofFront,-cabinWidth+10,p.roof]], '#35525b');
  body += polygon([[roofRear,-cabinWidth+10,p.roof],[roofFront,-cabinWidth+10,p.roof],
    [roofFront,cabinWidth-10,p.roof],[roofRear,cabinWidth-10,p.roof]], p.color);
  body += polygon([[p.cabinRear,cabinWidth,z],[p.cabinFront,cabinWidth,z],
    [roofFront,cabinWidth-10,p.roof],[roofRear,cabinWidth-10,p.roof]], p.shade);
  body += polygon([[p.cabinRear+13,cabinWidth+1,z+6],[p.cabinFront-13,cabinWidth+1,z+6],
    [roofFront-6,cabinWidth-9,p.roof-7],[roofRear+6,cabinWidth-9,p.roof-7]], '#203a43');
  const pillar = car.id === 'ae86' ? -45 : -20;
  body += line([pillar,cabinWidth+2,z+5],[pillar-4,cabinWidth-8,p.roof-5],p.shade,5);
  body += line([p.cabinFront-8,cabinWidth,69],[p.cabinRear+10,cabinWidth,69],p.color,3);
  // Panel gaps, door handles and side skirts.
  const doorXs = car.id === 'ae86' ? [-87,65] : [-133,-20,80];
  for (const x of doorXs) body += line([x,W,60],[x,W,34],p.shade,1.2);
  for (const x of car.id === 'ae86' ? [-69] : [-114,-3]) body += line([x,W+1,58],[x+16,W+1,58],'#27323a',3);
  body += line([-L+12,W,37],[L-24,W,37],car.id === 'ae86' ? '#182326' : p.shade,car.id === 'ae86' ? 12 : 5);
  body += wheel(-L+75,W+4) + wheel(L-75,W+4);
  // Nose: lamps, grille, number plate and bumper opening.
  body += polygon([[L,-W+25,57],[L,W-25,57],[L,W-25,43],[L,-W+25,43]], '#17252c');
  for (const side of [-1,1]) {
    const a = side < 0 ? -W+17 : 26, b = side < 0 ? -26 : W-17;
    body += polygon([[L+1,a,61],[L+1,b,61],[L+1,b,51],[L+1,a,51]], car.id === 'ae86' ? '#d0d8c5' : '#d6e8e4');
  }
  body += polygon([[L+2,-19,43],[L+2,19,43],[L+2,19,33],[L+2,-19,33]], '#d6dece');
  if (car.id === 'ae86') {
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
  if (car.id === 'chaser') body += line([-L+20,-W+10,67],[-L+20,W-10,67],p.shade,3);
  body += line([L-18,-W+12,67],[p.cabinFront+8,-W+12,67],'#ffffff35',2);
  return `<svg viewBox="15 -15 580 350" role="img" aria-label="${car.name}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
export function topVehicleSVG(car) {
  const p = profiles[car.id] || profiles.ae86;
  const length = car.id === 'chaser' ? 108 : car.id === 'ae86' ? 96 : 100;
  const width = car.id === 'ae86' ? 39 : 43;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 64">
    <g transform="translate(65 32)"><rect x="-${length/2-17}" y="-${width/2+3}" width="13" height="${width+6}" rx="3" fill="#070e12"/><rect x="${length/2-28}" y="-${width/2+3}" width="13" height="${width+6}" rx="3" fill="#070e12"/>
    <path d="M${-length/2},${-width/2+5} Q${-length/2-3},0 ${-length/2},${width/2-5} L${length/2-6},${width/2} Q${length/2+2},0 ${length/2-6},${-width/2}Z" fill="${p.color}" stroke="${p.shade}" stroke-width="2"/>
    <path d="M-27,-16 -4,-17 14,-13 14,13 -4,17 -27,16Z" fill="#233e49"/><path d="M-22,-13 -4,-14 -4,14 -22,13Z" fill="${p.color}"/>
    <path d="M-1,-15 8,-12 8,12 -1,15Z" fill="#73959d"/>
    <path d="M${length/2-5},-17v9m0,16v9" stroke="#fff2b4" stroke-width="5"/>
    <path d="M${-length/2+1},-16v8m0,16v8" stroke="#f46155" stroke-width="4"/>
    ${car.id === 'ae86' ? '<path d="M-45,-19H39M-45,19H39" stroke="#182126" stroke-width="4"/><path d="M30,-16v10m0,12v10" stroke="#eeecc9" stroke-width="6"/>' : ''}
    ${car.id === 'chaser' ? '<path d="M-32,-18H27M-32,18H27M-13,-20v6m0,28v6" stroke="#5b437d" stroke-width="2"/>' : ''}
    ${car.id === 'evo' ? '<path d="M-41,-24v48" stroke="#a62f30" stroke-width="7"/><path d="M25,-12h12v6H25zm0,18h12v6H25z" fill="#273035"/>' : ''}
    </g></svg>`;
}
