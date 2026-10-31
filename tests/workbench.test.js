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
async function boot(t){
 const {document,HTMLElement,HTMLCanvasElement,HTMLSelectElement,HTMLInputElement}=parseHTML(readFileSync(new URL('../index.html',import.meta.url),'utf8'));
 // Supply browser-only facilities and the form properties linkedom doesn't model.
 Object.defineProperty(HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(n=>n.hasAttribute('selected'))?.getAttribute('value')||this.querySelector('option')?.getAttribute('value')||'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.getAttribute('value')===String(v));}});
 Object.defineProperty(HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',!!v);}});
 HTMLCanvasElement.prototype.getContext=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});HTMLElement.prototype.getBoundingClientRect=()=>({width:1600,height:430});HTMLElement.prototype.focus=function(){document.testFocus=this;};HTMLElement.prototype.scrollIntoView=()=>{};HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLElement.prototype.close=function(){this.removeAttribute('open');};
 const c=unlockEverything(newCareer());c.helpSeen=true;const values=new Map([[SAVE_KEY,JSON.stringify(c)]]),frames=new Map();let seq=0;
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
});

test('pane height accounts for the real header offset without hiding overflowing content',()=>{
 const r=root('<div class="workspace-body"></div>');r.querySelector('div').getBoundingClientRect=()=>({top:315.4});fitWorkspace(r);assert.equal(r.querySelector('div').style.getPropertyValue('--workspace-top'),'315px');fitWorkspace(root(''));
});
test('actual race actions finish into an accessible report and can retry without page scrolling',async t=>{
 const {document:d,frames}=await boot(t),q=s=>d.querySelector(s);q('#start').click();assert.ok(q('#execute'));let turns=0;
 while(q('#execute')&&turns++<12){const balanced=q('[data-card=balanced]');if(balanced&&!balanced.disabled)balanced.click();q('#execute').click();const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(performance.now()+20000);}
 assert.ok(turns<=12);assert.ok(q('.report'));assert.equal(q('#app').dataset.racePanel,'report');q('.race-report-toggle').click();assert.equal(q('#app').dataset.racePanel,'track');q('#show-report').click();assert.equal(q('#app').dataset.racePanel,'report');q('#retry').click();assert.ok(q('#execute'));assert.equal(q('#app').dataset.racePanel,undefined);
});
