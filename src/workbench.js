import {tireKey} from './wear.js';
import {CARS,PILOTS,getEvent} from './data.js';
import {escapeHTML} from './career-view.js';
import {supportCost} from './operations.js';
const selectedTabs=new Map();
export function selectWorkspaceTab(view,id){selectedTabs.set(view,id);}
let lastSeasonAttempt=null;
export function contextHTML(career,view,race){
 const config=race?.config,car=config?.car||CARS.find(c=>c.id===career.car),pilot=config?.pilot||PILOTS.find(p=>p.id===career.pilot),event=getEvent(race?.eventId||career.eventId),condition=career.condition[car.id];
 return `<section class="context-bar" aria-label="Важная информация"><div><span>АКТИВНАЯ МАШИНА</span><strong>${escapeHTML(car.name)}</strong></div><div><span>СОСТОЯНИЕ</span><strong class="${condition<60?'negative':''}">${Math.round(condition)}%</strong></div><div><span>МОТОР / ШИНЫ</span><strong>${Math.round(career.wear?.[car.id]?.engine??100)}% / ${Math.round(career.wear?.[car.id]?.[tireKey(career.builds[car.id])]??100)}%</strong></div><div><span>ПИЛОТ</span><strong>${escapeHTML(pilot.name)}</strong></div><div><span>${view==='race'?'СЕССИЯ':'ВЫБРАННЫЙ МАРШРУТ'}</span><strong>${escapeHTML(event.title)}${race?' · '+(race.finished?(race.player?.dnf?'Сход':'Финиш'):race.index+1+'/'+event.sectors.length):''}</strong></div><div><span>РЕПУТАЦИЯ</span><strong>${career.street} Street / ${career.official} Official</strong></div><div><span>ПЕРСОНАЛ ЗА СТАРТ</span><strong>¥${supportCost(career).toLocaleString('ru-RU')}</strong></div></section>`;
}
export function tabKey(current,keys,key){const i=keys.indexOf(current);return key==='Home'?keys[0]:key==='End'?keys.at(-1):key==='ArrowRight'?keys[(i+1)%keys.length]:key==='ArrowLeft'?keys[(i-1+keys.length)%keys.length]:current;}
function tabs(root,view,groups){
 groups=groups.filter(g=>g.nodes.length);if(!groups.length)return;
 const doc=root.ownerDocument,box=doc.createElement('section'),nav=doc.createElement('div'),body=doc.createElement('div');box.className='workbench';nav.className='workspace-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Разделы страницы');body.className='workspace-body';
 const panes=[];for(const g of groups){const button=doc.createElement('button'),pane=doc.createElement('section');button.textContent=g.label;button.id='tab-'+view+'-'+g.id;button.dataset.pane=g.id;button.setAttribute('role','tab');button.setAttribute('aria-controls','pane-'+view+'-'+g.id);pane.id='pane-'+view+'-'+g.id;pane.className='workspace-pane';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);pane.tabIndex=0;for(const n of g.nodes)pane.append(n);nav.append(button);body.append(pane);panes.push({g,button,pane});}
 const activate=(id,focus=false)=>{selectedTabs.set(view,id);for(const p of panes){const active=p.g.id===id;p.button.setAttribute('aria-selected',String(active));p.button.tabIndex=active?0:-1;p.pane.hidden=!active;if(active&&focus)p.button.focus();}};
 for(const {g,button} of panes){button.onclick=()=>activate(g.id);button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();activate(tabKey(g.id,groups.map(g=>g.id),e.key),true);}};}
 box.append(nav,body);root.append(box);activate(groups.some(g=>g.id===selectedTabs.get(view))?selectedTabs.get(view):groups[0].id);
 root.querySelectorAll('a[href="#organizer"]').forEach(a=>a.onclick=e=>{e.preventDefault();activate('organizer');nav.querySelector('[data-pane="organizer"]').focus();});
}
export function fitWorkspace(root){
 const body=root.querySelector('.workspace-body');if(!body)return;
 const top=body.getBoundingClientRect().top;if(Number.isFinite(top))body.style.setProperty('--workspace-top',Math.max(0,Math.round(top))+'px');
}
export function mountWorkbench(root,view,career,race){
 root.dataset.page=view;const children=[...root.children],pick=selector=>children.filter(n=>n.matches(selector));
 if(view==='tuning'){
  pick('.tuning-nav').forEach(n=>n.remove());const overview=pick('.panel').find(n=>!n.matches('.setup-panel,.preset-panel,.operations-panel,.powertrain-panel,.maintenance-panel'));overview?.classList.add('page-overview');
  tabs(root,view,[{id:'engines',label:'Моторы / свапы',nodes:pick('.powertrain-panel')},{id:'maintenance',label:'Сервис узлов',nodes:pick('.maintenance-panel')},{id:'setup',label:'Настройки',nodes:pick('.setup-panel')},{id:'engineer',label:'Инженер',nodes:pick('.operations-panel')},{id:'presets',label:'Пресеты',nodes:pick('.preset-panel')},...pick('.tuning-group').map(n=>({id:n.id,label:n.querySelector('h3').textContent,nodes:[n]}))]);
 }else if(view==='team'){
  const ops=pick('.operations-panel');tabs(root,view,[{id:'pilots',label:'Пилоты',nodes:pick('.section-title,.pilot-row')},{id:'plan',label:'План заезда',nodes:pick('.team-plan')},{id:'staff',label:'Мастерская',nodes:ops.slice(0,1)},{id:'sponsors',label:'Спонсоры',nodes:ops.slice(1)}]);
  const note=pick('p.notice')[0];if(note){const details=root.ownerDocument.createElement('details');details.className='workspace-help';details.innerHTML='<summary>Как работает команда</summary>';details.append(note);root.append(details);}
 }else if(view==='seasons'){
  const attempt=career.championships.active?.attempt;if(attempt&&attempt!==lastSeasonAttempt)selectedTabs.set(view,'current');lastSeasonAttempt=attempt;
  const panels=pick('.panel:not(.organizer-panel)'),active=career.championships.active;
  const organizer=pick('.organizer-panel')[0];if(organizer){const nodes=[...organizer.children],split=nodes.findIndex(n=>n.tagName==='H3'),editor=root.ownerDocument.createElement('div'),projects=root.ownerDocument.createElement('div');editor.className='series-editor';projects.className='series-projects';nodes.forEach((n,i)=>(i<split?editor:projects).append(n));organizer.append(editor,projects);}
  tabs(root,view,[...(active?[{id:'current',label:'Текущий сезон',nodes:panels.slice(0,1)}]:[]),{id:'cups',label:'Кубки карьеры',nodes:pick('.section-grid')},{id:'organizer',label:'Мои серии / редактор',nodes:pick('.organizer-panel')},{id:'history',label:'История сезонов',nodes:panels.slice(active?1:0)}]);
 }else if(view==='world'){
  const grid=children.findIndex(n=>n.matches('.event-grid')),records=children.findIndex((n,i)=>i>grid&&n.matches('.section-title')),history=children.findIndex((n,i)=>i>records&&n.tagName==='H2');
  tabs(root,view,[{id:'journey',label:'Путь команды',nodes:pick('.journey-panel')},{id:'events',label:'Маршруты',nodes:children.slice(grid,records)},{id:'records',label:'Рекорды и повторы',nodes:children.slice(records,history)},{id:'history',label:'История заездов',nodes:children.slice(history)}]);
 }else if(view==='race'&&root.querySelector('#report')?.children.length){
  const button=root.ownerDocument.createElement('button');button.className='secondary race-report-toggle';let report=true;const toggle=()=>{root.dataset.racePanel=report?'report':'track';button.textContent=report?'← К трассе и приборам':'Протокол заезда →';};button.onclick=()=>{report=!report;toggle();};root.querySelector('.page-heading').append(button);toggle();const show=root.querySelector('#show-report');if(show)show.onclick=()=>{report=true;toggle();};
 }else delete root.dataset.racePanel;
 root.insertAdjacentHTML('afterbegin',contextHTML(career,view,race));fitWorkspace(root);
}
