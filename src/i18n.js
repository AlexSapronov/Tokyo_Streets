import {EN_COPY} from './locale-en.js';
export const LANG_KEY='tokyo-streets-language';
const en={...EN_COPY};
for(const [key,value] of Object.entries(en)){if(key.length<120){en[key.toUpperCase()]??=value.toUpperCase();en[key.toLowerCase()]??=value.charAt(0).toLowerCase()+value.slice(1);}}
let language='ru';
try{language=globalThis.localStorage?.getItem(LANG_KEY)==='en'?'en':'ru';}catch{}
export const getLanguage=()=>language;
const originals=new WeakMap(),attributes=new WeakMap();
const letters='А-Яа-яЁё';
const escapeRE=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const phrases=Object.keys(en).filter(key=>key&&/[А-Яа-яЁё]/.test(key)).sort((a,b)=>b.length-a.length);
const phraseRE=new RegExp('(?<!['+letters+'])('+phrases.map(escapeRE).join('|')+')(?!['+letters+'])','g');
// Translate presentation strings only. Never write translated values into game data.
export function englishText(text){
 if(typeof text!=='string'||!/[А-Яа-яЁё]/.test(text))return text;
 const trimmed=text.trim(),exact=en[trimmed];
 if(exact!==undefined)return text.replace(trimmed,exact);
 // This sentence contains an ordinal and needs English word order.
 const value=text.replace(/Повтор приёма: (\d+)-е применение с учётом предыдущих (\d+) решений\. Меняется только расход или восстановление фокуса; прямого штрафа темпа нет\./g,(_,use,window)=>`Repeated move: use #${use}, counting the previous ${window} decisions. Only focus cost or recovery changes; no direct pace penalty.`);
 return value.replace(phraseRE,key=>en[key]);
}
export const translate=text=>language==='en'?englishText(text):text;
export function setLanguage(next){
 language=next==='en'?'en':'ru';
 try{globalThis.localStorage?.setItem(LANG_KEY,language);}catch{}
 if(typeof document!=='undefined'){
  document.documentElement.lang=language;
  document.title=language==='en'?'Tokyo Streets | Tactical Racing':'Tokyo Streets | Тактические гонки';
 }
}
const skip='script,style,textarea,pre,code,[contenteditable],input,option[value^="custom"],[translate="no"],[data-no-i18n]';
function localizeNode(node){
 if(node.nodeType===3){
  if(!node.parentElement||node.parentElement.closest(skip))return;
  const old=originals.get(node),current=node.nodeValue;
  const source=old&&current===old.output?old.source:current;
  const output=translate(source);originals.set(node,{source,output});
  if(current!==output)node.nodeValue=output;
  return;
 }
 if(node.nodeType===1&&node.closest(skip)&&!node.matches('input'))return;
 if(node.nodeType===1&&!node.closest('[translate="no"],[data-no-i18n]')){
  const saved=attributes.get(node)||{};
  for(const attr of ['aria-label','title','placeholder']){
   const current=node.getAttribute(attr);if(current===null)continue;
   const old=saved[attr],source=old&&current===old.output?old.source:current,output=translate(source);
   saved[attr]={source,output};if(output!==current)node.setAttribute(attr,output);
  }
  attributes.set(node,saved);
 }
 for(const child of node.childNodes||[])localizeNode(child);
}
export function localize(root=globalThis.document){
 if(!root)return;
 if(typeof document!=='undefined')document.documentElement.lang=language;
 localizeNode(root);
 const selected=root.querySelector?.('#language-select');if(selected)selected.value=language;
}
// Dashboard, replay, map controls, toasts and errors also change between renders.
export function observeLocalization(root=globalThis.document){
 if(!root||typeof MutationObserver==='undefined')return ()=>{};
 const observer=new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='childList')for(const node of record.addedNodes)localizeNode(node);
   else localizeNode(record.target);
  }
  observer.takeRecords();
 });
 observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
 localize(root);return ()=>observer.disconnect();
}
setLanguage(language);
