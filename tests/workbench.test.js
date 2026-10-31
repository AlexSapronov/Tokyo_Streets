// Real HTML parsing and DOM interaction through linkedom; no browser layout engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {newCareer,SAVE_KEY} from '../src/storage.js';
import {unlockEverything} from '../src/balance.js';
import {mountWorkbench,contextHTML,tabKey,fitWorkspace} from '../src/workbench.js';
import {vehicleSVG,topVehicleSVG} from '../src/vehicles.js';
import {CARS} from '../src/data.js';
function root(html){const {document}=parseHTML('<html><body><main>'+html+'</main></body></html>');return document.querySelector('main');}
test('tabs move existing nodes, preserve edits and handlers, and provide keyboard selection',()=>{
 const r=root('<div class="page-heading"></div><section class="panel">summary</section><section class="setup-panel"><input id="edit"></section><section class="preset-panel"><button id="action">save</button></section><section class="operations-panel">advice</section><nav class="tuning-nav"></nav><section class="tuning-group" id="engine"><h3>Engine</h3></section>');let calls=0;const input=r.querySelector('input'),button=r.querySelector('#action');input.value='unsaved';button.onclick=()=>calls++;
 mountWorkbench(r,'tuning',newCareer(),null);assert.equal(r.querySelectorAll('[role=tabpanel]').length,4);r.querySelector('[data-pane=presets]').click();assert.equal(input.value,'unsaved');r.querySelector('#action').click();assert.equal(calls,1);assert.ok(r.querySelector('#pane-tuning-setup').hidden);assert.equal(r.querySelector('[data-pane=presets]').getAttribute('aria-selected'),'true');
 for(const n of r.querySelectorAll('[role=tab]'))n.focus=()=>{};let prevented=false;r.querySelector('[data-pane=presets]').onkeydown({key:'ArrowRight',preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(r.querySelector('[role=tab][aria-selected=true]').dataset.pane,'engine');
 r.querySelector('[data-pane=engine]').onkeydown({key:'Enter'});assert.equal(input.value,'unsaved');
});
test('tab keys wrap, support Home/End and keep unrelated keys unchanged',()=>{const keys=['a','b','c'];for(const [current,key,expected] of [['a','ArrowLeft','c'],['c','ArrowRight','a'],['b','Home','a'],['a','End','c'],['b','Tab','b']])assert.equal(tabKey(current,keys,key),expected);});
test('global context exposes condition, pilot, reputation and startup costs with escaped text',()=>{
 const c=newCareer();c.condition.ae86=40;const html=contextHTML(c,'garage',null);assert.match(html,/40%/);assert.match(html,/negative/);assert.match(html,/ПЕРСОНАЛ/);assert.match(html,/Street/);
 const race={eventId:'haruna',index:2,config:{car:{id:'ae86',name:'<img>',drive:'FR'},pilot:{name:'<pilot>'}},finished:false};assert.ok(contextHTML(c,'race',race).includes('&lt;img&gt;'));assert.match(contextHTML(c,'race',{...race,finished:true}),/Финиш/);
});
test('organizer, history and current season are independent panels, not one long page',()=>{
 const c=newCareer();c.championships.active={cupId:'club'};const r=root('<div class="page-heading"></div><nav><a href="#organizer">Create</a></nav><section class="panel">current</section><div class="section-grid">cups</div><section class="panel">history</section><section class="organizer-panel panel"><h2>editor</h2><input id="project"><h3>projects</h3><div>saved</div></section>');mountWorkbench(r,'seasons',c,null);
 assert.equal(r.querySelectorAll('[role=tabpanel]').length,4);assert.match(r.querySelector('.series-editor').textContent,/editor/);assert.match(r.querySelector('.series-projects').textContent,/saved/);r.querySelector('[data-pane=organizer]').focus=()=>{};r.querySelector('a').onclick({preventDefault(){}});assert.equal(r.querySelector('[role=tab][aria-selected=true]').dataset.pane,'organizer');
});
test('race report toggle keeps the race instruments mounted and can return to final track',()=>{
 const r=root('<div class="page-heading"></div><div class="race-layout"><aside class="sidebar">instruments</aside></div><button id="show-report">report</button><div id="report"><section>result</section></div>');mountWorkbench(r,'race',newCareer(),null);assert.equal(r.dataset.racePanel,'report');r.querySelector('.race-report-toggle').click();assert.equal(r.dataset.racePanel,'track');r.querySelector('#show-report').click();assert.equal(r.dataset.racePanel,'report');assert.match(r.querySelector('.sidebar').textContent,/instruments/);
 const other=root('<div id="report"></div>');mountWorkbench(other,'race',newCareer(),null);assert.equal(other.dataset.racePanel,undefined);
});
test('car assets have distinct model details, finite coordinates and supported standalone SVG',()=>{
 const details=new Set();for(const car of CARS){const s=vehicleSVG(car),svg=parseHTML(s).document.querySelector('svg');details.add(svg.getAttribute('data-body-detail'));assert.equal(svg.getAttribute('data-model'),car.id);assert.ok(!/NaN|Infinity|undefined/.test(s));assert.ok(svg.querySelectorAll('path').length>8);assert.equal(parseHTML(topVehicleSVG(car)).document.querySelector('svg').getAttribute('data-model'),car.id);}
 assert.equal(details.size,10);assert.match(vehicleSVG({id:'unknown',name:'Unknown'}),/panda-popups/);
});
async function boot(t,initial){
 const {document,HTMLElement,HTMLCanvasElement,HTMLSelectElement,HTMLInputElement}=parseHTML(readFileSync(new URL('../index.html',import.meta.url),'utf8'));
 // Supply browser-only facilities and the form properties linkedom doesn't model.
 Object.defineProperty(HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(n=>n.hasAttribute('selected'))?.getAttribute('value')||this.querySelector('option')?.getAttribute('value')||'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.getAttribute('value')===String(v));}});
 Object.defineProperty(HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',!!v);}});
 HTMLCanvasElement.prototype.getContext=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});HTMLElement.prototype.getBoundingClientRect=()=>({width:1600,height:430});HTMLElement.prototype.focus=function(){document.testFocus=this;};HTMLElement.prototype.scrollIntoView=()=>{};HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLElement.prototype.close=function(){this.removeAttribute('open');};
 const c=initial||unlockEverything(newCareer());c.helpSeen=true;const values=new Map([[SAVE_KEY,JSON.stringify(c)]]),frames=new Map();let seq=0;
 const stubs={document,window:{devicePixelRatio:1,addEventListener(){},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}},Image:class{complete=true;naturalWidth=130;},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:cb=>{frames.set(++seq,cb);return seq;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:()=>0,clearTimeout:()=>{}};
 for(const [key,value] of Object.entries(stubs)){const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});}
 await import('../src/app.js?dom='+Math.random());return {document,values,frames};
}
test('actual app boots and all page navigation, garage preview and tuning tabs remain interactive',async t=>{
 const {document:d,values}=await boot(t),q=s=>d.querySelector(s),go=view=>q('[data-view='+view+']').click();assert.ok(q('#start'));go('garage');assert.equal(q('#app').dataset.page,'garage');
 const before=JSON.parse(values.get(SAVE_KEY));q('[data-garage-preview=supra]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).car,before.car);assert.match(q('.garage-car-detail').textContent,/Supra/);q('[data-car=supra]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).car,'supra');assert.match(q('.context-bar').textContent,/Supra/);
 go('tuning');const input=q('#setup-pressure');input.value='2.4';q('[data-pane=presets]').click();q('[data-pane=setup]').click();assert.equal(input.value,'2.4');q('#setup-save').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).setups.supra.pressure,2.4);
 for(const page of ['world','seasons','team','race']){go(page);assert.equal(q('#app').dataset.page,page);assert.ok(q('.context-bar'));assert.ok(q('#debug-unlock'));}
 go('team');q('[data-pane=staff]').click();q('[data-staff-hire=mechanic]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).operations.staff.mechanic,1);assert.equal(q('[role=tab][aria-selected=true]').dataset.pane,'staff');
 go('seasons');q('[data-pane=organizer]').click();q('#series-name').value='DOM Series';q('#series-save').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).organizer.series[0].name,'DOM Series');assert.equal(q('[role=tab][aria-selected=true]').dataset.pane,'organizer');
 q('[data-series-enter]').click();assert.equal(q('[role=tab][aria-selected=true]').dataset.pane,'current');assert.ok(q('#season-prepare'));
 go('team');q('[data-pane=staff]').click();q('[data-staff-hire=engineer]').click();q('[data-staff-hire=engineer]').click();go('tuning');q('[data-pane=engines]').click();q('#engine-catalog-select').value='w16';q('#engine-catalog-select').onchange();assert.equal(q('[data-engine-buy=w16]').closest('.engine-row').hidden,false);q('#engine-catalog-select').value='1uz';q('#engine-catalog-select').onchange();q('[data-engine-buy=1uz]').click();q('[data-engine-install]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).engines.installed.supra.engineId,'1uz');assert.match(q('.page-overview').textContent,/1UZ/);
 go('race');q('#discipline-select').value='drift';q('#discipline-select').onchange({target:q('#discipline-select')});assert.ok([...q('#event-select').querySelectorAll('option')].every(o=>o.value==='ebisu'||o.value==='meihan'||o.value.endsWith('-drift')));
 go('world');q('#world-discipline').value='drag';q('#world-discipline').onchange({target:q('#world-discipline')});assert.equal(q('.event-grid').querySelectorAll('[data-event]').length,3);
 go('seasons');q('[data-pane=organizer]').click();q('[data-series-discipline]').value='drift';q('[data-series-discipline]').onchange();assert.ok([...q('[data-series-event]').querySelectorAll('option')].every(o=>o.value==='ebisu'||o.value==='meihan'||o.value.endsWith('-drift')));
});

test('pane height accounts for the real header offset without hiding overflowing content',()=>{
 const r=root('<div class="workspace-body"></div>');r.querySelector('div').getBoundingClientRect=()=>({top:315.4});fitWorkspace(r);assert.equal(r.querySelector('div').style.getPropertyValue('--workspace-top'),'315px');fitWorkspace(root(''));
});
test('actual race actions finish into an accessible report and can retry without page scrolling',async t=>{
 const {document:d,frames}=await boot(t),q=s=>d.querySelector(s);q('#start').click();assert.ok(q('#execute'));let turns=0;
 while(q('#execute')&&turns++<12){const balanced=q('[data-card=balanced]');if(balanced&&!balanced.disabled)balanced.click();q('#execute').click();const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(performance.now()+20000);}
 assert.ok(turns<=12);assert.ok(q('.report'));assert.equal(q('#app').dataset.racePanel,'report');q('.race-report-toggle').click();assert.equal(q('#app').dataset.racePanel,'track');q('#show-report').click();assert.equal(q('#app').dataset.racePanel,'report');q('#retry').click();assert.ok(q('#execute'));assert.equal(q('#app').dataset.racePanel,undefined);
});

test('new career goals navigate to real routes, lock during racing and report paid progress',async t=>{
 const {document:d,values,frames}=await boot(t,newCareer()),q=s=>d.querySelector(s);
 assert.match(q('.journey-focus').textContent,/Ночные смены/);
 q('[data-journey-view]').click();assert.equal(q('#app').dataset.page,'seasons');
 q('[data-view=world]').click();q('[data-pane=journey]').click();assert.equal(q('#pane-world-journey').hidden,false);
 q('[data-journey-event]').click();assert.equal(q('#app').dataset.page,'race');assert.equal(JSON.parse(values.get(SAVE_KEY)).eventId,'haruna');
 q('#start').click();assert.ok(q('[data-journey-view]').disabled);assert.ok(q('[data-journey-event]').disabled);
 let turns=0;while(q('#execute')&&turns++<12){const balanced=q('[data-card=balanced]');if(balanced&&!balanced.disabled)balanced.click();q('#execute').click();const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(performance.now()+20000);}
 assert.ok(q('.journey-report'));const saved=JSON.parse(values.get(SAVE_KEY));assert.ok(saved.journey.routes.haruna>=1);assert.ok(saved.journey.claimed.includes('debut'));assert.match(q('.journey-report').textContent,/премии/);
 assert.ok(!q('[data-journey-view]').disabled);
 q('[data-journey-view]').click();assert.equal(q('#app').dataset.page,q('[data-journey-view]').dataset.journeyView);
});
test('free-race opponent choice persists and is frozen after start; championships expose five cups',async t=>{
 const c=newCareer();c.money=100000;const {document:d,values}=await boot(t,c),q=s=>d.querySelector(s);
 assert.equal(d.querySelectorAll('[data-rival-level]').length,3);q('[data-rival-level=hard]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).rivalLevel,'hard');assert.equal(q('[data-rival-level=hard]').getAttribute('aria-pressed'),'true');
 q('#start').click();assert.equal(d.querySelectorAll('[data-rival-level]').length,0);assert.ok(q('.event-controls').classList.contains('session-active'));assert.equal(q('#control'),null);assert.equal(q('[data-pilot]'),null);
 q('[data-view=garage]').click();q('[data-garage-preview=mx5]').click();assert.ok(q('#trade-in').disabled);
 q('[data-view=race]').click();q('#abandon').click();q('#confirm-abandon').click();
 q('[data-view=seasons]').click();assert.equal(d.querySelectorAll('[data-cup-enter]').length,5);assert.match(q('#app').textContent,/Japan All Stars/);assert.match(q('#app').textContent,/Tokyo Legends/);
});
test('garage trade-in shows the quote before confirmation and replaces inventory only once',async t=>{
 const c=newCareer();c.money=50000;c.purchased.ae86=['cooling'];c.builds.ae86=['cooling'];
 const {document:d,values}=await boot(t,c),q=s=>d.querySelector(s);q('[data-view=garage]').click();q('[data-garage-preview=mx5]').click();const before=values.get(SAVE_KEY);
 assert.ok(q('.trade-in-quote'));q('#trade-in').click();assert.match(q('#modal').textContent,/Подтвердить трейд-ин/);assert.equal(values.get(SAVE_KEY),before);
 q('#trade-in-confirm').click();const sold=JSON.parse(values.get(SAVE_KEY));assert.equal(sold.car,'mx5');assert.deepEqual(sold.ownedCars,['mx5']);assert.deepEqual(sold.purchased.ae86,[]);assert.ok(!q('#modal').hasAttribute('open'));
 q('[data-garage-preview=ae86]').click();assert.match(q('[data-car=ae86]').textContent,/Купить/);assert.ok(sold.money<50000);
});

test('player-only interface hides driver recruitment and JSON export while preserving crew support',async t=>{
 const {document:d,frames}=await boot(t),q=s=>d.querySelector(s),go=view=>q('[data-view='+view+']').click();
 go('garage');assert.equal(q('[data-pilot]'),null);assert.match(q('.garage-player-note').textContent,/За рулём: ты/);
 go('team');assert.equal(q('[data-hire]'),null);assert.equal(q('[data-assign]'),null);assert.equal(q('#plan-order'),null);assert.ok(q('[data-pane=staff]'));
 go('race');assert.equal(q('#control'),null);
 q('#start').click();let turns=0;
 while(q('#execute')&&turns++<12){const card=q('[data-card=balanced]');if(card&&!card.disabled)card.click();q('#execute').click();const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);}
 assert.ok(q('.report'));assert.equal(q('#export'),null);assert.ok(q('.race-recap'));
});

test('garage interface sorts by price and displays HD previews for every model',async t=>{
 const {document:d}=await boot(t),q=s=>d.querySelector(s);
 q('[data-view=garage]').click();
 assert.deepEqual([...d.querySelectorAll('[data-garage-preview]')].map(node=>node.dataset.garagePreview),
  ['ae86','mx5','s13','ek9','chaser','evo','rx7','r32','supra','r34','nsx']);
 assert.match(q('.garage-price-sort').textContent,/ЦЕНА/);
 assert.ok(q('.garage-car-detail .garage-render-ae86'));
 q('[data-garage-preview=rx7]').click();assert.ok(q('.garage-car-detail .garage-render-rx7'));
 q('[data-garage-preview=r32]').click();assert.ok(q('.garage-car-detail .garage-render-r32'));
 assert.equal(q('.garage-car-detail .vehicle-art svg'),null);
 q('[data-garage-preview=r34]').click();assert.ok(q('.garage-car-detail .garage-render-r34'));
 q('[data-garage-preview=chaser]').click();assert.ok(q('.garage-car-detail .garage-render-chaser'));
 q('[data-garage-preview=supra]').click();assert.ok(q('.garage-car-detail .garage-render-supra'));
 q('[data-garage-preview=ek9]').click();assert.ok(q('.garage-car-detail .garage-render-ek9'));
 q('[data-garage-preview=nsx]').click();assert.ok(q('.garage-car-detail .garage-render-nsx'));
 q('#garage-drive').value='AWD';q('#garage-drive').onchange({target:q('#garage-drive')});
 assert.deepEqual([...d.querySelectorAll('[data-garage-preview]')].map(node=>node.dataset.garagePreview),['evo','r32','r34']);
});

test('local crew selection locks the advertised opponent and race lines update the real forecast',async t=>{
 const {document:d,frames,values}=await boot(t),q=s=>d.querySelector(s);
 q('[data-view=world]').click();q('[data-pane=rivals]').click();assert.equal(q('#pane-world-rivals').hidden,false);assert.equal(d.querySelectorAll('[data-challenge]').length,9);
 q('[data-challenge=cedar-1]').click();assert.match(q('.sidebar').textContent,/Хару Кондо/);assert.equal(q('[data-rival-level]'),null);assert.equal(q('#weather').disabled,true);
 q('#start').click();assert.equal(q('#challenge-cancel'),null);q('[data-card=balanced]').click();q('#execute').click();
 let callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);
 assert.equal(q('[data-line=late-apex]').disabled,false);q('[data-line=late-apex]').click();assert.equal(q('[data-line=late-apex]').getAttribute('aria-pressed'),'true');
 assert.equal(d.querySelectorAll('.upcoming-sectors>div').length,3);
 q('#execute').click();assert.equal(q('[data-line=inside]').disabled,true);callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);
 assert.match(q('.last-sector').textContent,/Поздний апекс/);assert.ok(JSON.parse(values.get(SAVE_KEY)).rivals);
});

test('bench preview changes only the trial build and special series can register through their tab',async t=>{
 const c=unlockEverything(newCareer());const {document:d,values}=await boot(t,c),q=s=>d.querySelector(s),saved=()=>JSON.parse(values.get(SAVE_KEY));
 q('[data-view=tuning]').click();q('[data-pane=bench]').click();assert.equal(q('#pane-tuning-bench').hidden,false);const before=saved();
 const ecu=q('[data-bench-part=ecu]');ecu.checked=!ecu.checked;ecu.onchange();assert.match(q('#bench-result').textContent,/Пробная/);assert.deepEqual(saved(),before);
 q('#bench-engine').value='ls3';q('#bench-engine').onchange({target:q('#bench-engine')});assert.deepEqual(saved(),before);
 q('#bench-reset').click();assert.equal(q('#bench-engine').value,'4age');assert.deepEqual(saved(),before);
 q('[data-view=seasons]').click();q('[data-pane=special]').click();assert.equal(d.querySelectorAll('[data-special-enter]').length,5);q('[data-special-enter=special-na]').click();assert.equal(saved().championships.active.cupId,'special-na');
 q('#season-prepare').click();q('#start').click();q('[data-view=tuning]').click();q('[data-pane=bench]').click();assert.equal(q('#bench-event'),null);assert.match(q('.bench-panel').textContent,/после завершения/);
});

test('player growth edits preserve the career, freeze on start and remain separate from driver selection',async t=>{
 const c=newCareer();c.player.xp=2160;const {document:d,values}=await boot(t,c),q=s=>d.querySelector(s),saved=()=>JSON.parse(values.get(SAVE_KEY));
 q('[data-view=world]').click();q('[data-pane=player]').click();q('[data-player-train=precision]').click();q('[data-player-train=precision]').click();q('[data-player-train=precision]').click();assert.equal(saved().player.learned.precision,3);
 q('[data-player-train=control]').click();assert.equal(saved().player.active.length,2);assert.equal(q('[data-pilot]'),null);
 q('[data-view=race]').click();assert.match(q('.active-skills').textContent,/Точность 3/);q('#start').click();assert.ok(q('[data-card=skill-release]'));q('[data-view=world]').click();q('[data-pane=player]').click();assert.equal(q('[data-player-train=control]').disabled,true);assert.equal(q('#player-reset').disabled,true);
 q('[data-view=race]').click();q('#abandon').click();q('#confirm-abandon').click();q('[data-view=world]').click();q('[data-pane=player]').click();q('#player-reset').click();assert.equal(saved().player.xp,2160);assert.deepEqual(saved().player.learned,{});
});
test('sound settings gracefully handle a browser without Web Audio and scene feedback reflects the played card',async t=>{
 const {document:d,frames}=await boot(t,newCareer()),q=s=>d.querySelector(s);await q('#sound-toggle').onclick();assert.match(q('#sound-toggle').textContent,/выкл/);
 q('#sound-volume').value='.1';q('#sound-volume').oninput({target:q('#sound-volume')});q('#start').click();q('[data-card=balanced]').click();q('#execute').click();
 const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+500);assert.match(q('#scene-tactic').textContent,/Чистый темп/);assert.equal(q('#scene-tactic').hidden,false);
});

test('top-level Player navigation opens the actual specialization controls directly',async t=>{
 const {document:d}=await boot(t),q=s=>d.querySelector(s);q('[data-view=player]').click();assert.equal(q('#pane-world-player').hidden,false);assert.ok(q('[data-player-train=precision]'));assert.equal(q('[data-view=player]').classList.contains('active'),true);q('[data-view=race]').click();assert.ok(q('#scene'));assert.ok(q('#start'));
});

test('race tools sit outside the road canvas and the overview toggle preserves the current run',async t=>{
 const {document:d,values}=await boot(t),q=s=>d.querySelector(s);assert.equal(q('.scene-tools').closest('.scene-wrap'),null);assert.match(q('#camera-toggle').textContent,/всю трассу/);const before=values.get(SAVE_KEY);q('#camera-toggle').click();assert.match(q('#camera-toggle').textContent,/текущей связке/);assert.equal(values.get(SAVE_KEY),before);
});
