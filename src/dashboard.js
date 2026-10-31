import {transmission} from './telemetry.js';
const speedLimit=config=>config.car.power>600?480:config.car.power>350?360:240;
function dial(kind,max,label,unit,redline=null){
  const ticks=Array.from({length:kind==='rpm'?10:13},(_,index)=>{
    const value=index/(kind==='rpm'?9:12)*max,angle=(-130+value/max*260)*Math.PI/180;
    const point=radius=>[90+Math.sin(angle)*radius,90-Math.cos(angle)*radius];
    const a=point(66),b=point(72),n=point(54);
    const red=redline&&value>=redline;
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${red?'#fb785f':'#a8b5a7'}" stroke-width="2"/><text x="${n[0]}" y="${n[1]+3}" text-anchor="middle" fill="${red?'#fb785f':'#a8b5a7'}">${kind==='rpm'?index:Math.round(value)}</text>`;
  }).join('');
  return `<div class="dash-dial" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="0" data-meter="${kind}"><svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="78" fill="#101819" stroke="#3b4b46" stroke-width="2"/><circle cx="90" cy="90" r="73" fill="none" stroke="#22342d"/>${ticks}<g data-needle="${kind}" style="transform:rotate(-130deg);transform-origin:90px 90px"><path d="M87 100 90 26 93 100Z" fill="#ff9865"/></g><circle cx="90" cy="90" r="7" fill="#d8dbbc"/></svg><div class="dash-digital"><strong data-value="${kind}">0</strong><span>${unit}</span></div></div>`;
}
export function dashboardHTML(config){
  return `<section class="dashboard" aria-label="Приборная панель"><div class="dash-car"><strong>${config.car.name}</strong><span>${config.car.drive} / ${config.pilot.name}</span><span class="dash-engine">${config.car.engine} · ${config.car.power} л.с.</span></div>
    <div class="dash-cluster">${dial('speed',speedLimit(config),'Скорость, км/ч','KM/H')}${dial('rpm',9000,'Обороты двигателя','RPM ×1000',transmission(config,0).redline)}<div class="dash-gear" aria-label="Передача"><small>GEAR</small><strong data-value="gear">N</strong></div></div>
    <div class="dash-sensors"><div><span>ВОДА</span><strong data-value="coolant">82°</strong><i data-temp="coolant"></i></div><div><span>МАСЛО</span><strong data-value="oil">88°</strong><i data-temp="oil"></i></div><div><span>ТОРМОЗА</span><strong data-value="brakes">55°</strong><i data-temp="brakes"></i></div><div><span>ШИНЫ °C</span><strong data-value="tireTemp">60°</strong><i data-temp="tireTemp"></i></div></div>
    <div class="dash-aux"><span>ШИНЫ <b data-value="tires">100%</b></span><span data-value="warning" role="status">● READY</span></div><div class="dash-focus"><div class="dash-focus-head"><strong>ФОКУС</strong><b data-value="focus">100</b></div><div class="focus-track" data-value="focusTrack" role="meter" aria-label="Фокус пилота" aria-valuemin="0" aria-valuemax="${config.pilot.focus}" aria-valuenow="${config.pilot.focus}"><i data-value="focusFill"></i></div><span data-value="focusStatus">Стабильное исполнение</span></div></section>`;
}
export function bindDashboard(root,config){
  const values=Object.fromEntries([...root.querySelectorAll('[data-value]')].map(node=>[node.dataset.value,node]));
  const needles=Object.fromEntries([...root.querySelectorAll('[data-needle]')].map(node=>[node.dataset.needle,node]));
  const meters=Object.fromEntries([...root.querySelectorAll('[data-meter]')].map(node=>[node.dataset.meter,node]));
  const lamps=Object.fromEntries([...root.querySelectorAll('[data-temp]')].map(node=>[node.dataset.temp,node]));
  const redline=transmission(config,0).redline;
  return data=>{
    for(const key of ['speed','rpm']){
      values[key].textContent=key==='rpm'?(data.rpm/1000).toFixed(1):Math.round(data.speed);
      needles[key].style.transform=`rotate(${-130+Math.min(1,data[key]/(key==='rpm'?9000:speedLimit(config)))*260}deg)`;
      meters[key].setAttribute('aria-valuenow',Math.round(data[key]));
    }
    values.gear.textContent=data.gear||'N';
    const limits={coolant:105,oil:130,brakes:145,tireTemp:110};let hot=false;
    for(const [key,limit] of Object.entries(limits)){
      values[key].textContent=Math.round(data[key])+'°';const active=data[key]>limit;lamps[key].classList.toggle('hot',active);values[key].classList.toggle('negative',active);hot||=active;
    }
    values.tires.textContent=Math.round(data.tires)+'%';values.focus.textContent=Math.round(data.focus)+' / '+config.pilot.focus;
    values.focusTrack.setAttribute('aria-valuenow',Math.round(data.focus));
    values.focusFill.style.width=Math.max(0,Math.min(100,data.focus/config.pilot.focus*100))+'%';
    values.focusTrack.classList.toggle('low',data.focus<40);values.focusTrack.classList.toggle('critical',data.focus<20);
    values.focusStatus.textContent=data.focus<20?'КРИТИЧНО · восстанови фокус':data.focus<40?'НИЗКИЙ ФОКУС · выше разброс и риск вылета':data.focus<75?'Повышенный разброс исполнения':'Стабильное исполнение';
    values.warning.textContent=hot?'● TEMP':data.rpm>redline*.94?'● SHIFT':'● RUN';values.warning.classList.toggle('negative',hot);
  };
}
