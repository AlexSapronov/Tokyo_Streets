// Real HTML parsing and DOM interaction through linkedom; no browser layout engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {newCareer,SAVE_KEY} from '../src/storage.js';
import {unlockEverything} from '../src/balance.js';
import {mountWorkbench,contextHTML,tabKey,fitWorkspace} from '../src/workbench.js';
import {vehicleSVG,topVehicleSVG} from '../src/vehicles.js';
import {CARS,getEvent} from '../src/data.js';
function root(html){const {document}=parseHTML('<html><body><main>'+html+'</main></body></html>');return document.querySelector('main');}
test('tabs move existing nodes, preserve edits and handlers, and provide keyboard selection',()=>{
 const r=root('<div class="page-heading"></div><section class="panel">summary</section><section class="setup-panel"><input id="edit"></section><section class="preset-panel"><button id="action">save</button></section><section class="workshop-panel">presets</section><nav class="tuning-nav"></nav><section class="tuning-group" id="engine"><h3>Engine</h3></section>');let calls=0;const input=r.querySelector('input'),button=r.querySelector('#action');input.value='unsaved';button.onclick=()=>calls++;
 mountWorkbench(r,'tuning',newCareer(),null);assert.equal(r.querySelectorAll('[role=tabpanel]').length,6);r.querySelector('[data-pane=presets]').click();assert.equal(input.value,'unsaved');r.querySelector('#action').click();assert.equal(calls,1);assert.ok(r.querySelector('#pane-tuning-setup').hidden);assert.equal(r.querySelector('[data-pane=presets]').getAttribute('aria-selected'),'true');
 for(const n of r.querySelectorAll('[role=tab]'))n.focus=()=>{};let prevented=false;r.querySelector('[data-pane=presets]').onkeydown({key:'ArrowRight',preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(r.querySelector('[data-pane=setup]').getAttribute('aria-selected'),'true');assert.equal(r.querySelector('[data-pane=settings]').getAttribute('aria-selected'),'true');
 r.querySelector('[data-pane=engine]').onkeydown({key:'Enter'});assert.equal(input.value,'unsaved');
});
test('tab keys wrap, support Home/End and keep unrelated keys unchanged',()=>{const keys=['a','b','c'];for(const [current,key,expected] of [['a','ArrowLeft','c'],['c','ArrowRight','a'],['b','Home','a'],['a','End','c'],['b','Tab','b']])assert.equal(tabKey(current,keys,key),expected);});
test('global context exposes condition, pilot, reputation and startup costs with escaped text',()=>{
 const c=newCareer();c.condition.ae86=40;const html=contextHTML(c,'garage',null);assert.match(html,/40%/);assert.match(html,/negative/);assert.match(html,/ДОСТУП К ТЮНИНГУ/);assert.match(html,/Street/);
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
async function boot(t,initial,options={}){
 const {document,HTMLElement,HTMLCanvasElement,HTMLSelectElement,HTMLInputElement}=parseHTML(readFileSync(new URL('../index.html',import.meta.url),'utf8'));
 // Supply browser-only facilities and the form properties linkedom doesn't model.
 Object.defineProperty(HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(n=>n.hasAttribute('selected'))?.getAttribute('value')||this.querySelector('option')?.getAttribute('value')||'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.getAttribute('value')===String(v));}});
 Object.defineProperty(HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',!!v);}});
 HTMLCanvasElement.prototype.getContext=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});HTMLElement.prototype.getBoundingClientRect=()=>({width:1600,height:430});HTMLElement.prototype.focus=function(){document.testFocus=this;};HTMLElement.prototype.scrollIntoView=()=>{};HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLElement.prototype.close=function(){this.removeAttribute('open');};
 const c=initial||unlockEverything(newCareer());c.helpSeen=options.helpSeen??true;const values=new Map([[SAVE_KEY,JSON.stringify(c)]]),frames=new Map();let seq=0;const windowHandlers={};if(options.values)for(const [k,v] of options.values)values.set(k,v);
 const stubs={document,window:{devicePixelRatio:1,location:{search:options.debug?'?debug=1':''},addEventListener(type,cb){windowHandlers[type]=cb;},localStorage:options.storage||{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}},Image:class{complete=true;naturalWidth=130;},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:cb=>{frames.set(++seq,cb);return seq;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:()=>0,clearTimeout:()=>{}};
 for(const [key,value] of Object.entries(stubs)){const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});}
 await import('../src/app.js?dom='+Math.random());return {document,values,frames,windowHandlers};
}
test('actual app boots and all page navigation, garage preview and tuning tabs remain interactive',async t=>{
 const {document:d,values}=await boot(t),q=s=>d.querySelector(s),go=view=>q('[data-view='+view+']').click();assert.ok(q('#start'));go('garage');assert.equal(q('#app').dataset.page,'garage');
 const before=JSON.parse(values.get(SAVE_KEY));q('[data-garage-preview=supra]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).car,before.car);assert.match(q('.garage-car-detail').textContent,/Supra/);q('[data-car=supra]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).car,'supra');assert.match(q('.context-bar').textContent,/Supra/);
 go('tuning');const input=q('#setup-pressure');input.value='2.4';q('[data-pane=presets]').click();q('[data-pane=setup]').click();assert.equal(input.value,'2.4');q('#setup-save').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).setups.supra.pressure,2.4);
 for(const page of ['world','seasons','race']){go(page);assert.equal(q('#app').dataset.page,page);assert.ok(q('.context-bar'));assert.equal(q('#debug-unlock'),null);}
 assert.equal(q('[data-view=team]'),null);
 go('seasons');q('[data-pane=organizer]').click();q('#series-name').value='DOM Series';q('#series-save').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).organizer.series[0].name,'DOM Series');assert.equal(q('[role=tab][aria-selected=true]').dataset.pane,'organizer');
 q('[data-series-enter]').click();assert.equal(q('[role=tab][aria-selected=true]').dataset.pane,'current');assert.ok(q('#season-prepare'));
 go('tuning');q('[data-pane=engines]').click();q('#engine-catalog-select').value='w16';q('#engine-catalog-select').onchange();assert.equal(q('[data-engine-buy=w16]').closest('.engine-row').hidden,false);q('#engine-catalog-select').value='1uz';q('#engine-catalog-select').onchange();q('[data-engine-buy=1uz]').click();q('[data-engine-install]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).engines.installed.supra.engineId,'1uz');assert.match(q('.page-overview').textContent,/1UZ/);
 go('race');q('#discipline-select').value='drift';q('#discipline-select').onchange({target:q('#discipline-select')});assert.ok([...q('#event-select').querySelectorAll('option')].every(o=>o.value==='ebisu'||o.value==='meihan'||o.value.endsWith('-drift')));
 go('world');q('#world-discipline').value='drag';q('#world-discipline').onchange({target:q('#world-discipline')});assert.equal(q('.event-grid').querySelectorAll('[data-event]').length,3);
 go('seasons');q('[data-pane=organizer]').click();q('[data-series-discipline]').value='drift';q('[data-series-discipline]').onchange();assert.ok([...q('[data-series-event]').querySelectorAll('option')].every(o=>o.value==='ebisu'||o.value==='meihan'||o.value.endsWith('-drift')));
});

test('pane height accounts for the real header offset without hiding overflowing content',()=>{
 const r=root('<div class="workspace-body"></div>');r.querySelector('div').getBoundingClientRect=()=>({top:315.4});fitWorkspace(r);assert.equal(r.querySelector('div').style.getPropertyValue('--workspace-top'),'315px');fitWorkspace(root(''));
});
test('actual race actions finish into an accessible report and can retry without page scrolling',async t=>{
 const {document:d,frames}=await boot(t),q=s=>d.querySelector(s);q('#start').click();assert.ok(q('#execute'));let turns=0;
 while(q('#execute')&&turns++<40){const balanced=q('[data-card=balanced]');if(balanced&&!balanced.disabled)balanced.click();q('#execute').click();const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(performance.now()+20000);}
 assert.ok(turns<=12);assert.ok(q('.report'));assert.equal(q('#app').dataset.racePanel,'report');q('.race-report-toggle').click();assert.equal(q('#app').dataset.racePanel,'track');q('#show-report').click();assert.equal(q('#app').dataset.racePanel,'report');q('#retry').click();assert.ok(q('#execute'));assert.equal(q('#app').dataset.racePanel,undefined);
});

test('new career goals navigate to real routes, lock during racing and report paid progress',async t=>{
 const {document:d,values,frames}=await boot(t,newCareer()),q=s=>d.querySelector(s);
 assert.match(q('.journey-focus').textContent,/Ночные смены/);
 q('[data-journey-view]').click();assert.equal(q('#app').dataset.page,'seasons');
 q('[data-view=world]').click();q('[data-pane=journey]').click();assert.equal(q('#pane-world-journey').hidden,false);
 q('[data-journey-event]').click();assert.equal(q('#app').dataset.page,'race');assert.equal(JSON.parse(values.get(SAVE_KEY)).eventId,'haruna');
 q('#start').click();assert.ok(q('[data-journey-view]').disabled);assert.ok(q('[data-journey-event]').disabled);
 let turns=0;while(q('#execute')&&turns++<40){const balanced=q('[data-card=balanced]');if(balanced&&!balanced.disabled)balanced.click();q('#execute').click();const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(performance.now()+20000);}
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

test('player-only interface hides driver recruitment and JSON export and exposes solo workshop presets',async t=>{
 const {document:d,frames}=await boot(t),q=s=>d.querySelector(s),go=view=>q('[data-view='+view+']').click();
 go('garage');assert.equal(q('[data-pilot]'),null);assert.match(q('.garage-player-note').textContent,/За рулём: ты/);
 assert.equal(q('[data-view=team]'),null);go('tuning');assert.ok(q('[data-pane=workshop]'));assert.equal(q('[data-staff-hire]'),null);
 go('race');assert.equal(q('#control'),null);
 q('#start').click();let turns=0;
 while(q('#execute')&&turns++<40){const card=q('[data-card=balanced]');if(card&&!card.disabled)card.click();q('#execute').click();const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);}
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
 q('[data-view=player]').click();q('[data-pane=skills]').click();q('[data-player-train=precision]').click();q('[data-player-train=precision]').click();q('[data-player-train=precision]').click();assert.equal(saved().player.learned.precision,3);
 q('[data-player-train=control]').click();assert.equal(saved().player.active.length,2);assert.equal(q('[data-pilot]'),null);
 q('[data-view=race]').click();assert.match(q('.active-skills').textContent,/Точность 3/);q('#start').click();assert.ok(q('[data-card=skill-release]'));q('[data-view=player]').click();q('[data-pane=skills]').click();assert.equal(q('[data-player-train=control]').disabled,true);assert.equal(q('#player-reset').disabled,true);
 q('[data-view=race]').click();q('#abandon').click();q('#confirm-abandon').click();q('[data-view=player]').click();q('[data-pane=skills]').click();q('#player-reset').click();assert.equal(saved().player.xp,2160);assert.deepEqual(saved().player.learned,{});
});
test('sound settings gracefully handle a browser without Web Audio and scene feedback reflects the played card',async t=>{
 const {document:d,frames}=await boot(t,newCareer()),q=s=>d.querySelector(s);await q('#sound-toggle').onclick();assert.match(q('#sound-toggle').textContent,/выкл/);
 q('#sound-volume').value='.1';q('#sound-volume').oninput({target:q('#sound-volume')});q('#start').click();q('[data-card=balanced]').click();q('#execute').click();
 const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+500);assert.match(q('#scene-tactic').textContent,/Чистый темп/);assert.equal(q('#scene-tactic').hidden,false);
});

test('top-level Player navigation opens the actual specialization controls directly',async t=>{
 const {document:d}=await boot(t),q=s=>d.querySelector(s);q('[data-view=player]').click();q('[data-pane=skills]').click();assert.equal(q('#pane-player-skills').hidden,false);assert.ok(q('[data-player-train=precision]'));assert.equal(q('[data-view=player]').classList.contains('active'),true);q('[data-view=race]').click();assert.ok(q('#scene'));assert.ok(q('#start'));
});

test('race tools sit outside the road canvas and the overview toggle preserves the current run',async t=>{
 const {document:d,values}=await boot(t),q=s=>d.querySelector(s);assert.equal(q('.scene-tools').closest('.scene-wrap'),null);assert.match(q('#camera-toggle').textContent,/Вся трасса/);const before=values.get(SAVE_KEY);q('#camera-toggle').click();assert.equal(q('#map-zoom').textContent,'100%');assert.equal(q('#camera-follow').getAttribute('aria-pressed'),'false');assert.equal(values.get(SAVE_KEY),before);
});

test('solo workshop buttons charge money and Street Cred and persist actual randomized settings',async t=>{
 const c=newCareer();c.money=100000;c.street=60;c.streetPeak=60;
 // Archived support data must not create a wage in the current game.
 c.team.founded=true;c.operations.staff.mechanic=2;c.operations.staff.engineer=2;
 const {document:d,values}=await boot(t,c),q=s=>d.querySelector(s),go=view=>q('[data-view='+view+']').click();
 assert.equal(q('[data-view=team]'),null);go('tuning');q('[data-pane=workshop]').click();
 assert.equal(d.querySelectorAll('[data-workshop-preset]').length,4);assert.match(q('#pane-tuning-workshop').textContent,/85–100%/);
 q('[data-workshop-preset=wet]').click();const saved=JSON.parse(values.get(SAVE_KEY));
 assert.equal(saved.money,98800);assert.equal(saved.street,58);assert.equal(saved.streetPeak,60);assert.ok(saved.setups.ae86.pressure<2.2);
 assert.ok(saved.lastWorkshop.quality>=.85&&saved.lastWorkshop.quality<=1);assert.deepEqual(saved.builds.ae86,[]);
 go('race');q('#start').click();const started=JSON.parse(values.get(SAVE_KEY));assert.equal(started.money,98800);
 go('tuning');assert.ok([...d.querySelectorAll('[data-workshop-preset]')].every(b=>b.disabled));
});

test('paid workshop receipt opens actual settings, survives reload and reports manual edits',async t=>{
 const c=newCareer();c.money=100000;c.street=60;c.streetPeak=60;
 const first=await boot(t,c),d=first.document,q=s=>d.querySelector(s);
 q('[data-view=tuning]').click();q('[data-pane=workshop]').click();q('[data-workshop-preset=wet]').click();
 const paid=JSON.parse(first.values.get(SAVE_KEY));assert.equal(paid.lastWorkshop.paidMoney,1200);assert.equal(paid.lastWorkshop.paidStreet,2);
 assert.deepEqual(paid.lastWorkshop.after,paid.setups.ae86);assert.match(q('.workshop-result').textContent,/Дождь/);
 assert.match(q('.workshop-result').textContent,/Что изменилось после оплаты/);assert.doesNotMatch(q('.workshop-result').textContent,/ориентир/);
 q('[data-workshop-open-setup]').click();assert.equal(q('[data-pane=setup]').getAttribute('aria-selected'),'true');assert.equal(q('[data-pane=settings]').getAttribute('aria-selected'),'true');
 q('#setup-pressure').value='2.6';q('#setup-save').click();q('[data-pane=workshop]').click();
 assert.match(q('.workshop-result').textContent,/сборка или настройки изменены/);
 const edited=JSON.parse(first.values.get(SAVE_KEY));assert.equal(edited.money,paid.money);assert.equal(edited.street,paid.street);assert.deepEqual(edited.lastWorkshop,paid.lastWorkshop);
 const second=await boot(t,edited),q2=s=>second.document.querySelector(s);q2('[data-view=tuning]').click();q2('[data-pane=workshop]').click();
 assert.match(q2('.workshop-result').textContent,/сборка или настройки изменены/);assert.match(q2('.workshop-result').textContent,/Списано:/);
});

test('tuning separates installation from setup, preserves edits between modes and replaces alternative hardware',async t=>{
 const c=newCareer();c.money=1000000;c.street=60;c.streetPeak=60;
 const {document:d,values}=await boot(t,c),q=s=>d.querySelector(s),saved=()=>JSON.parse(values.get(SAVE_KEY));
 q('[data-view=tuning]').click();q('[data-pane=installation]').click();
 assert.equal(q('[aria-label="Разделы тюнинга"]').querySelectorAll('[role=tab]').length,2);
 assert.equal(q('#pane-tuning-installation').hidden,false);assert.equal(q('#pane-tuning-settings').hidden,true);
 assert.equal(q('#pane-tuning-settings .tuning-group'),null);assert.equal(q('#pane-tuning-installation .setup-panel'),null);
 const cats=q('[aria-label="Категории деталей"]');assert.ok(cats);
 for(const category of ['tires','engine','cooling','transmission','chassis','aero'])assert.equal(q('#tuning-'+category).querySelectorAll('[data-part]').length,6);
 q('[data-pane=tuning-engine]').click();q('[data-part=streetEcu]').click();assert.deepEqual(saved().builds.ae86,['streetEcu']);
 const spent=saved().money;q('[data-part=ecu]').click();assert.deepEqual(saved().builds.ae86,['ecu']);assert.equal(saved().money,spent-16000);
 assert.ok(saved().purchased.ae86.includes('streetEcu'));assert.equal(q('[data-pane=tuning-engine]').getAttribute('aria-selected'),'true');
 assert.equal(q('[data-pane=installation]').getAttribute('aria-selected'),'true');
 q('[data-pane=settings]').click();q('[data-pane=setup]').click();q('#setup-pressure').value='2.4';
 q('[data-pane=installation]').click();q('[data-pane=settings]').click();assert.equal(q('#setup-pressure').value,'2.4');
 assert.equal(q('[data-pane=setup]').getAttribute('aria-selected'),'true');
 const ids=[...d.querySelectorAll('[role=tab],[role=tabpanel]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
 q('[data-view=garage]').click();q('#open-maintenance').click();assert.equal(q('[data-pane=installation]').getAttribute('aria-selected'),'true');assert.equal(q('#pane-tuning-maintenance').hidden,false);
});

test('first visit offers a short playable introduction without spending money or exposing debug',async t=>{
 const {document:d,values}=await boot(t,newCareer(),{helpSeen:false}),q=s=>d.querySelector(s);
 assert.match(q('#modal-content').textContent,/Твоя первая ночь/);assert.equal(q('#debug-unlock'),null);assert.ok(q('.beginner-guide'));
 q('#welcome-drive').click();const c=JSON.parse(values.get(SAVE_KEY));assert.equal(c.weather,'mixed');assert.equal(c.rivalLevel,'equal');assert.equal(c.money,18000);assert.equal(c.helpSeen,true);assert.equal(q('#weather').value,'dry');q('#start').click();assert.match(q('.school-coach').textContent,/Исполнить/);
});
test('unfinished race restarts only after confirmation with identical execution and no awards',async t=>{
 const {document:d,values,frames}=await boot(t,newCareer()),q=s=>d.querySelector(s),flush=()=>{const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);};
 q('#start').click();q('[data-card=balanced]').click();q('#execute').click();assert.equal(q('#restart').disabled,true);flush();const result=q('.last-sector').textContent,before=values.get(SAVE_KEY);
 q('#restart').click();assert.ok(q('#confirm-restart'));assert.equal(values.get(SAVE_KEY),before);q('#confirm-restart').click();assert.equal(q('.last-sector'),null);assert.match(q('#scene-status').textContent,/01/);
 q('[data-card=balanced]').click();q('#execute').click();flush();assert.equal(q('.last-sector').textContent,result);assert.equal(values.get(SAVE_KEY),before);
});
test('restart keeps a championship stage and a challenge opponent instead of converting them to free races',async t=>{
 const c=unlockEverything(newCareer());c.car='ae86';c.builds.ae86=[];const {document:d,values,frames}=await boot(t,c),q=s=>d.querySelector(s),flush=()=>{const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);};
 q('[data-view=seasons]').click();q('[data-cup-enter=club]').click();q('#season-prepare').click();q('#start').click();const stage=JSON.parse(values.get(SAVE_KEY)).championships.active;assert.ok(stage);
 q('#execute').click();flush();const result=q('.last-sector').textContent;q('#restart').click();q('#confirm-restart').click();q('#execute').click();flush();assert.equal(q('.last-sector').textContent,result);assert.deepEqual(JSON.parse(values.get(SAVE_KEY)).championships.active,stage);
 q('#abandon').click();q('#confirm-abandon').click();q('[data-view=world]').click();q('[data-pane=rivals]').click();q('[data-challenge=cedar-1]').click();q('#start').click();q('#restart').click();q('#confirm-restart').click();assert.match(q('.sidebar').textContent,/Хару Кондо/);assert.equal(q('[data-rival-level]'),null);
});
test('career slots copy, rename and switch without merging progress, and are locked during a race',async t=>{
 const c=newCareer();c.money=42000;const {document:d,values}=await boot(t,c),q=s=>d.querySelector(s);
 q('#saves').click();assert.equal(d.querySelectorAll('.save-slot').length,3);q('[data-slot-copy="2"]').click();q('#slot-confirm').click();assert.equal(JSON.parse(values.get(SAVE_KEY+'-slot-2')).money,42000);
 q('[data-slot-name="2"]').value='<My career>';q('[data-slot-rename="2"]').click();assert.match(q('.save-slots').textContent,/<My career>/);assert.equal(q('.save-slots My'),null);
 q('[data-slot-load="2"]').click();q('#slot-confirm').click();assert.equal(values.get(SAVE_KEY+'-active-slot'),'2');assert.match(q('#saves').textContent,/2/);
 q('#weather').value='rain';q('#weather').onchange({target:q('#weather')});assert.equal(JSON.parse(values.get(SAVE_KEY)).weather,'mixed');assert.equal(JSON.parse(values.get(SAVE_KEY+'-slot-2')).weather,'rain');
 q('#start').click();q('#saves').click();assert.equal(q('[data-slot-load="1"]').disabled,true);assert.equal(q('[data-slot-copy="3"]').disabled,true);assert.equal(q('#save-download').disabled,false);
});
test('corrupt autosave shows recovery, keeps its bytes and restores its prior good career',async t=>{
 const c=newCareer();c.money=3333;const {document:d,values}=await boot(t,c,{values:[[SAVE_KEY,'{broken'],[SAVE_KEY+'-backup',JSON.stringify(c)]]}),q=s=>d.querySelector(s);
 assert.ok(q('#save-warning'));assert.equal(values.get(SAVE_KEY),'{broken');q('#saves').click();assert.equal(q('[data-slot-restore="1"]').disabled,false);q('[data-slot-restore="1"]').click();q('#slot-confirm').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).money,3333);assert.equal(q('#save-warning'),null);
});
test('another tab changing the career blocks autosave and protects its newer data',async t=>{
 const {document:d,values,windowHandlers}=await boot(t,newCareer()),q=s=>d.querySelector(s),newer=newCareer();newer.money=777;const raw=JSON.stringify(newer);values.set(SAVE_KEY,raw);windowHandlers.storage({key:SAVE_KEY});assert.match(q('#save-warning').textContent,/другой вкладке/);
 q('#weather').value='dry';q('#weather').onchange({target:q('#weather')});assert.equal(values.get(SAVE_KEY),raw);assert.match(q('#saves').textContent,/Не сохранено/);
});
test('leaving during a finishing animation still warns before unsaved rewards are lost',async t=>{
 const {document:d,frames,windowHandlers}=await boot(t,newCareer()),q=s=>d.querySelector(s);q('#start').click();let warned=false;windowHandlers.beforeunload({preventDefault(){warned=true;}});assert.equal(warned,true);
 let lastWarned=false,turns=0;while(q('#execute')&&turns++<20){q('#execute').click();warned=false;windowHandlers.beforeunload({preventDefault(){warned=true;}});lastWarned=warned;const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);}assert.ok(q('.report'));assert.equal(lastWarned,true);
});
test('explicit developer mode retains debug tools while public mode hides them',async t=>{
 const {document:d}=await boot(t,newCareer(),{debug:true});assert.ok(d.querySelector('#debug-unlock'));assert.ok(d.querySelector('#debug-reset'));
});

test('import previews the destination, preserves it on invalid files and replaces only after confirmation',async t=>{
 const {document:d,values}=await boot(t,newCareer()),q=s=>d.querySelector(s);q('#saves').click();const before=values.get(SAVE_KEY);
 const invalid=q('[data-slot-import="2"]');Object.defineProperty(invalid,'files',{configurable:true,value:[{size:3,text:async()=>'bad'}]});await invalid.onchange();assert.match(q('#save-error').textContent,/JSON/);assert.equal(values.has(SAVE_KEY+'-slot-2'),false);
 const imported=newCareer();imported.helpSeen=true;imported.money=6543;const valid=q('[data-slot-import="2"]');Object.defineProperty(valid,'files',{configurable:true,value:[{size:3000,text:async()=>JSON.stringify(imported)}]});await valid.onchange();assert.ok(q('#slot-confirm'));assert.equal(values.has(SAVE_KEY+'-slot-2'),false);q('#slot-confirm').click();assert.equal(JSON.parse(values.get(SAVE_KEY+'-slot-2')).money,6543);assert.equal(values.get(SAVE_KEY),before);
 const current=q('[data-slot-import="1"]');Object.defineProperty(current,'files',{value:[{size:3000,text:async()=>JSON.stringify(imported)}]});await current.onchange();q('#slot-confirm').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).money,6543);assert.equal(JSON.parse(values.get(SAVE_KEY+'-backup')).money,18000);assert.equal(q('#save-warning'),null);
});
test('new career in a slot is confirmed, backs up the old career and leaves other slots untouched',async t=>{
 const c=newCareer();c.money=12345;const {document:d,values}=await boot(t,c),q=s=>d.querySelector(s);q('#saves').click();q('[data-slot-copy="2"]').click();q('#slot-confirm').click();const other=values.get(SAVE_KEY+'-slot-2');q('[data-slot-new="1"]').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).money,12345);q('#slot-confirm').click();assert.equal(JSON.parse(values.get(SAVE_KEY)).money,18000);assert.equal(JSON.parse(values.get(SAVE_KEY+'-backup')).money,12345);assert.equal(values.get(SAVE_KEY+'-slot-2'),other);assert.ok(q('#welcome-drive'));
});
test('blocked browser storage remains playable with a persistent unsaved warning',async t=>{
 const {document:d}=await boot(t,newCareer(),{storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}}),q=s=>d.querySelector(s);assert.ok(q('#save-warning'));q('#weather').value='dry';q('#weather').onchange({target:q('#weather')});assert.match(q('#saves').textContent,/Не сохранено/);q('#saves').click();assert.ok(q('#save-download'));assert.equal(d.querySelectorAll('.save-slot').length,3);
});
test('missing maintenance blocks start and provides a direct path to component service',async t=>{
 const c=newCareer();c.condition.ae86=35;const {document:d}=await boot(t,c),q=s=>d.querySelector(s);assert.equal(q('#start').disabled,true);q('#race-maintenance').click();assert.equal(q('#app').dataset.page,'tuning');assert.equal(q('#pane-tuning-maintenance').hidden,false);
});
test('animation pauses when the tab goes into the background',async t=>{
 const {document:d}=await boot(t,newCareer()),q=s=>d.querySelector(s);q('#start').click();q('#execute').click();Object.defineProperty(d,'visibilityState',{value:'hidden'});d.dispatchEvent(new d.defaultView.Event('visibilitychange'));assert.match(q('#pause').textContent,/Продолжить/);
});

test('download button produces a portable copy of current progress',async t=>{
 const c=newCareer();c.money=7281;const {document:d}=await boot(t,c);let captured;const create=URL.createObjectURL;URL.createObjectURL=blob=>{captured=blob;return 'blob:test';};t.after(()=>{URL.createObjectURL=create;});d.querySelector('#saves').click();d.querySelector('#save-download').click();assert.ok(captured instanceof Blob);const payload=JSON.parse(await captured.text());assert.equal(payload.format,'tokyo-streets-career');assert.equal(payload.career.money,7281);
});

test('race workspace sizing follows actual viewport and track offset instead of display resolution',()=>{
 const r=root('<div class="race-layout"><section></section></div><section class="cards-area"></section>');r.dataset.page='race';let trackTop=300,deckHeight=340;r.querySelector('section').getBoundingClientRect=()=>({top:trackTop});r.querySelector('.cards-area').getBoundingClientRect=()=>({height:deckHeight});const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{innerHeight:1080}});
 try{fitWorkspace(r);assert.equal(r.style.getPropertyValue('--race-room'),'762px');assert.equal(r.style.getPropertyValue('--race-track-height'),'422px');trackTop=140;fitWorkspace(r);assert.equal(r.style.getPropertyValue('--race-track-height'),'582px');deckHeight=120;fitWorkspace(r);assert.equal(r.style.getPropertyValue('--race-track-height'),'802px');window.innerHeight=1440;fitWorkspace(r);assert.equal(r.style.getPropertyValue('--race-room'),'1282px');assert.equal(r.style.getPropertyValue('--race-track-height'),'1162px');}finally{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else delete globalThis.window;}
});
test('corner choice and sector feedback form a visible three-step decision with actual costs',async t=>{
 const {document:d,frames}=await boot(t,newCareer()),q=s=>d.querySelector(s);assert.equal(q('#forecast').parentElement,q('#app'));const children=[...q('#app').children];assert.ok(children.indexOf(q('#forecast'))<children.indexOf(q('.race-layout')));q('#start').click();q('#execute').click();let callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);
 assert.match(q('.upcoming-sectors .current').textContent,/ПОВОРОТ/);assert.match(q('.upcoming-sectors .current').textContent,new RegExp('2/'+getEvent('haruna',3).sectors.length));assert.match(q('.line-options legend').textContent,/1\. Траектория/);
 q('[data-line=late-apex]').click();assert.match(q('.forecast-main').textContent,/Поздний апекс/);assert.match(q('.forecast-values').textContent,/ФОКУС:.*→/);assert.match(q('#execute').textContent,/3\. Исполнить/);
 q('#execute').click();callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);q('#sector-details').click();assert.match(q('#modal-content').textContent,/Случайное исполнение/);assert.match(q('#modal-content').textContent,/Соперник:/);assert.match(q('#modal-content').textContent,/Повтор приёма/);
});

test('map zoom buttons offer steps, following is optional, and camera controls do not touch career',async t=>{
 const {document:d,values}=await boot(t),q=s=>d.querySelector(s),before=values.get(SAVE_KEY);q('#camera-toggle').click();assert.equal(q('#map-zoom').textContent,'100%');q('#map-zoom-in').click();assert.equal(q('#map-zoom').textContent,'125%');q('#map-zoom-in').click();assert.equal(q('#map-zoom').textContent,'150%');q('#map-zoom-out').click();assert.equal(q('#map-zoom').textContent,'125%');
 q('#camera-follow').click();assert.equal(q('#camera-follow').getAttribute('aria-pressed'),'true');q('#camera-focus').click();assert.equal(q('#camera-follow').getAttribute('aria-pressed'),'false');assert.equal(values.get(SAVE_KEY),before);
});
test('active racing hides career chrome automatically and can reveal it without interrupting execution',async t=>{
 const {document:d,frames,values}=await boot(t,newCareer()),q=s=>d.querySelector(s);assert.equal(d.body.classList.contains('race-focus'),false);q('#start').click();assert.equal(d.body.classList.contains('race-focus'),true);q('#execute').click();const before=values.get(SAVE_KEY);q('#race-menu-toggle').click();assert.equal(d.body.classList.contains('race-focus'),false);assert.equal(q('#execute').disabled,true);assert.equal(values.get(SAVE_KEY),before);q('#race-menu-toggle').click();assert.equal(d.body.classList.contains('race-focus'),true);
 let turns=0;while(q('#execute')&&turns++<40){const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);if(q('#execute'))q('#execute').click();}assert.ok(q('.report'));assert.equal(d.body.classList.contains('race-focus'),false);
});


test('school navigation, staged cards, finish report and next lesson persist without touching garage',async t=>{
 const c=newCareer();c.condition.ae86=40;c.wear.ae86.stockTires=24;const {document:d,values,frames}=await boot(t,c),q=s=>d.querySelector(s);q('[data-view=player]').click();assert.ok(q('.school-panel'));assert.equal(q('[data-school-start="1"]').disabled,true);q('[data-school-start="0"]').click();assert.equal(q('#app').dataset.lesson,'0');assert.equal(d.querySelectorAll('[data-card]').length,1);q('#start').click();assert.ok(q('.school-coach'));let turn=0;while(q('#execute')&&turn<40){const id=turn===1?'attack':turn===3?'breathe':'balanced';q('[data-card='+id+']').click();q('#execute').click();const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(performance.now()+20000);turn++;}
 assert.match(q('.school-report').textContent,/Урок пройден/);assert.equal(q('#retry'),null);let saved=JSON.parse(values.get(SAVE_KEY));assert.equal(saved.school.step,1);assert.equal(saved.money,c.money);assert.deepEqual(saved.wear,c.wear);assert.deepEqual(saved.condition,c.condition);assert.equal(saved.races,0);q('#school-next').click();assert.equal(q('#app').dataset.lesson,'1');assert.ok(q('[data-card=cool]'));assert.equal(q('[data-view=world]').disabled,false);q('#school-leave').click();assert.equal(q('#app').dataset.lesson,undefined);q('[data-view=world]').click();assert.equal(q('.player-panel'),null);assert.equal(q('[data-pane=school]'),null);q('[data-view=player]').click();q('[data-pane=school]').click();assert.equal(q('[data-school-start="1"]').disabled,false);
});
