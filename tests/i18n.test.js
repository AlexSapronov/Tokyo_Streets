import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {copyInventory} from '../scripts/copy-audit.js';
import {getLanguage,setLanguage,englishText,translate,localize,observeLocalization,LANG_KEY} from '../src/i18n.js';
import {configuration,createRace,resolveSector} from '../src/engine.js';
import {newCareer,slotList,renameSlot} from '../src/storage.js';
import {schoolHint,createLesson} from '../src/driving-school.js';
import {savesHTML} from '../src/release-view.js';
import {cupNameHTML,presetsHTML} from '../src/career-view.js';
const cyrillic=/[А-Яа-яЁё]/;
function environment(t){
 const {document,MutationObserver}=parseHTML('<html><body><main></main></body></html>');
 for(const [key,value] of Object.entries({document,MutationObserver})){const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});}
 t.after(()=>setLanguage('ru'));return document;
}
test('every audited Russian UI fragment has English coverage, including partial accessible labels',()=>{
 const missing=copyInventory().filter(r=>cyrillic.test(englishText(r.text)));
 assert.deepEqual(missing,[]);
});
test('dynamic repetition wording reads as an English sentence inside a longer status',()=>{
 const text=englishText('Повтор приёма: 3-е применение с учётом предыдущих 6 решений. Меняется только расход или восстановление фокуса; прямого штрафа темпа нет. · Стабильное исполнение');
 assert.match(text,/use #3, counting the previous 6 decisions/);assert.ok(!cyrillic.test(text));
});
test('Russian copy reflects focus-only repetition and existing player development',()=>{
 const inventory=copyInventory().map(r=>r.text).join('\n');
 assert.ok(!inventory.includes('увеличивает нагрузку и потерю темпа'));
 assert.ok(!inventory.includes('Развитие навыков появится позже'));
 assert.ok(!inventory.includes('скидка механика применяется'));
 assert.ok(inventory.includes('Базовое восстановление: 24 фокуса'));
 assert.ok(inventory.includes('Клип — судейская зона трассы'));
});
test('all lesson hints translate at every progress step without changing their mechanics',()=>{
 const career=newCareer();career.school.step=3;
 for(let step=0;step<4;step++){
  const race=createLesson(career,step);
  for(let index=0;index<20;index++){race.index=index;assert.ok(!cyrillic.test(englishText(schoolHint(race))),step+' / '+index);}
 }
 const cfg=configuration('ae86','ren');setLanguage('ru');const ru=resolveSector(createRace(cfg,'dry','haruna',null,42),'balanced');setLanguage('en');const en=resolveSector(createRace(cfg,'dry','haruna',null,42),'balanced');assert.deepEqual(en,ru);setLanguage('ru');
});
test('language toggles restore static DOM and attributes while preserving user text, values and data attributes',t=>{
 const d=environment(t),root=d.querySelector('main');root.innerHTML='<button data-filter="Поворот" title="Нужен поворот">Гараж</button><input value="Дождь" placeholder="Дождь, дрифт или миля"><h3 translate="no">Полная атака</h3><textarea>Гараж</textarea><pre>Гараж</pre><div contenteditable>Гараж</div>';
 setLanguage('en');localize(d);const button=root.querySelector('button'),input=root.querySelector('input');assert.equal(button.textContent,'Garage');assert.equal(button.title,'Requires a corner');assert.equal(button.dataset.filter,'Поворот');assert.equal(input.value,'Дождь');assert.equal(input.placeholder,'Wet, drift or mile');assert.equal(root.querySelector('h3').textContent,'Полная атака');assert.equal(root.querySelector('textarea').textContent,'Гараж');assert.equal(root.querySelector('pre').textContent,'Гараж');assert.equal(root.querySelector('[contenteditable]').textContent,'Гараж');
 setLanguage('ru');localize(d);assert.equal(button.textContent,'Гараж');assert.equal(button.title,'Нужен поворот');assert.equal(input.placeholder,'Дождь, дрифт или миля');
 setLanguage('en');localize(d);localize(d);assert.equal(button.textContent,'Garage');assert.equal(d.documentElement.lang,'en');
});
test('live messages and accessible labels localize after render and restore the latest Russian source',async t=>{
 const d=environment(t),root=d.querySelector('main');root.innerHTML='<p id="status">Стабильное исполнение</p><button></button>';setLanguage('en');const stop=observeLocalization(d);t.after(stop);
 const tick=async()=>{await Promise.resolve();await Promise.resolve();};const status=d.querySelector('#status'),button=d.querySelector('button');
 status.textContent='Нужно 25 фокуса с учётом повторов';button.setAttribute('aria-label','Показать участок 4 на карте');await tick();assert.equal(status.textContent,'Requires 25 focus including repetition costs');assert.equal(button.getAttribute('aria-label'),'Show sector 4 on the map');
 const newNode=d.createElement('p');newNode.textContent='Остудить тормоза';root.append(newNode);await tick();assert.equal(newNode.textContent,'Cool Brakes');
 setLanguage('ru');localize(d);assert.equal(status.textContent,'Нужно 25 фокуса с учётом повторов');assert.equal(button.getAttribute('aria-label'),'Показать участок 4 на карте');
});
test('language persists independently and storage denial leaves both languages usable',t=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map();Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},configurable:true});t.after(()=>{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage;setLanguage('ru');});
 setLanguage('en');assert.equal(data.get(LANG_KEY),'en');assert.equal(getLanguage(),'en');assert.equal(translate('Полная атака'),'Full Attack');Object.defineProperty(globalThis,'localStorage',{value:{setItem(){throw Error('blocked');}},configurable:true});assert.doesNotThrow(()=>setLanguage('ru'));assert.equal(translate('Полная атака'),'Полная атака');
});
test('names of slots, presets and custom cups stay verbatim even when they match translatable UI copy',t=>{
 const d=environment(t),root=d.querySelector('main'),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};renameSlot(storage,1,'Гараж');const career=newCareer();career.presets.ae86=[{name:'Полная атака',parts:[],setup:{pressure:2.2,finalDrive:1,springRate:100}}];
 setLanguage('en');root.innerHTML=savesHTML(slotList(storage),1)+presetsHTML(career,false)+cupNameHTML({name:'Собраться',custom:true});localize(d);
 assert.equal(root.querySelector('.save-slot h3').textContent,'Гараж');assert.equal(root.querySelectorAll('.save-slot h3')[1].textContent,'Career 2');assert.equal(root.querySelector('[data-slot-name="2"]').value,'Career 2');assert.equal(root.querySelector('.preset-grid h3').textContent,'Полная атака');assert.equal(root.querySelector('span[translate=no]').textContent,'Собраться');assert.equal(data.get('tokyo-streets-v1-name'),'Гараж');
});
