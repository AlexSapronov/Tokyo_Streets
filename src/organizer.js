import {earnedStreet} from './workshop.js';
import {CARS,EVENTS} from './data.js';
export const MAX_SERIES=8;
export const defaultSeries=()=>({name:'Моя клубная серия',kind:'official',maxPower:300,drives:['FR','FF','AWD','MR'],naOnly:false,pool:20000,stages:[['haruna','dry'],['tsukuba','mixed']]});
const identifier=id=>typeof id==='string'&&/^custom-[a-zA-Z0-9-]{1,64}$/.test(id);
export function seriesDefinition(raw,id=raw?.id){
 if(!raw||!identifier(id))throw new Error('Некорректный ID серии');
 if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.trim().length>48)throw new Error('Название: от 1 до 48 символов');
 if(!['official','street'].includes(raw.kind))throw new Error('Выбери официальный или уличный формат');
 if(!Number.isInteger(raw.maxPower)||raw.maxPower<150||raw.maxPower>500)throw new Error('Лимит мощности: от 150 до 500 л.с.');
 if(!Array.isArray(raw.drives)||!raw.drives.length||new Set(raw.drives).size!==raw.drives.length||raw.drives.some(d=>!['FR','FF','AWD','MR'].includes(d)))throw new Error('Нужен хотя бы один допустимый привод');
 if(typeof raw.naOnly!=='boolean')throw new Error('Некорректное ограничение двигателя');
 if(!Number.isInteger(raw.pool)||raw.pool<10000||raw.pool>100000||raw.pool%1000)throw new Error('Призовой фонд: ¥10 000–100 000, шаг ¥1 000');
 if(!Array.isArray(raw.stages)||raw.stages.length<2||raw.stages.length>6||raw.stages.some(s=>!Array.isArray(s)||s.length!==2||!EVENTS.some(e=>e.id===s[0])||!['dry','mixed','rain'].includes(s[1])))throw new Error('Календарь: от двух до шести этапов с известной трассой и погодой');
 const cars=CARS.filter(c=>c.power<=raw.maxPower&&raw.drives.includes(c.drive)&&(!raw.naOnly||!c.engine.includes('TURBO'))).sort((a,b)=>b.power-a.power||a.id.localeCompare(b.id));
 if(!cars.length)throw new Error('Под регламент не подходит ни одна машина');
 const stages=raw.stages.map(s=>[...s]),fee=raw.pool+stages.length*(raw.kind==='official'?4000:2500);
 return {id,name:raw.name.trim(),kind:raw.kind,custom:true,tier:0,previous:null,races:8,street:raw.kind==='street'?40:0,official:raw.kind==='official'?24:0,fee,maxPower:raw.maxPower,drives:[...raw.drives].sort(),naOnly:raw.naOnly,pool:raw.pool,prizes:[.5,.3,.15,.05].map(f=>Math.round(raw.pool*f)),budget:stages.length*9000,stages,
  roster:[['kei','Кэй Накамура','ren','balanced'],['rika','Рика Исикава','yui','safe'],['daichi','Дайти Сато','aki','attack']].map(([npc,name,pilot,style],i)=>[npc,name,cars[i%cars.length].id,pilot,style,['cooling','brakes']])};
}
export function organizerReason(career,series){
 if(career.races<8)return 'Нужно восемь финишей';
 if(series.kind==='official'&&career.official<24)return 'Для разрешения нужно 24 Official Rep';
 if(series.kind==='street'&&earnedStreet(career)<40)return 'Для закрытой встречи нужно 40 Street Cred';
 const closed=series.stages.find(([id])=>{const e=EVENTS.find(e=>e.id===id);return earnedStreet(career)<e.unlockStreet||career.races<e.unlockRaces;});
 if(closed)return 'Сначала открой маршрут: '+EVENTS.find(e=>e.id===closed[0]).title;
 return '';
}
function editable(career,active){if(active)throw new Error('Сначала заверши текущий заезд');return structuredClone(career);}
export function saveSeries(career,raw,id,active=false){
 const next=editable(career,active),series=seriesDefinition(raw,id);next.organizer??={series:[]};
 if(next.championships.active?.cupId===id)throw new Error('Регламент запущенной серии зафиксирован');
 const index=next.organizer.series.findIndex(s=>s.id===id);if(index<0&&next.organizer.series.length>=MAX_SERIES)throw new Error('Можно сохранить не больше восьми серий');
 if(index<0)next.organizer.series.push(series);else next.organizer.series[index]=series;return next;
}
export function deleteSeries(career,id,active=false){const next=editable(career,active);if(next.championships.active?.cupId===id)throw new Error('Сначала заверши или покинь эту серию');const index=next.organizer.series.findIndex(s=>s.id===id);if(index<0)throw new Error('Серия не найдена');next.organizer.series.splice(index,1);return next;}
export function normalizeOrganizer(raw){
 const series=[];for(const s of Array.isArray(raw?.series)?raw.series:[]){try{const clean=seriesDefinition(s);if(!series.some(e=>e.id===clean.id)&&series.length<MAX_SERIES)series.push(clean);}catch{ /* Ignore malformed user definitions, preserve the rest. */ }}return {series};
}
export function exportSeries(series){const clean=seriesDefinition(series);return JSON.stringify({format:'tokyo-streets-series',version:1,series:{name:clean.name,kind:clean.kind,maxPower:clean.maxPower,drives:clean.drives,naOnly:clean.naOnly,pool:clean.pool,stages:clean.stages}},null,2);}
export function importSeries(career,text,id,active=false){
 if(typeof text!=='string'||text.length>16000)throw new Error('JSON серии должен быть не больше 16 КБ');
 let data;try{data=JSON.parse(text);}catch{throw new Error('Не удалось прочитать JSON серии');}
 if(data?.format!=='tokyo-streets-series'||data.version!==1)throw new Error('Неподдерживаемый формат серии');return saveSeries(career,data.series,id,active);
}
