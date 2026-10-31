// UI localization runs after each render so existing game templates can stay unchanged.
// Russian is the source language; never translate user-supplied names or simulation data.
export const LANG_KEY='tokyo-streets-language';
const ru={
 'Заезд':'Заезд','Гараж':'Гараж','Тюнинг':'Тюнинг','Карьера':'Карьера','Чемпионаты':'Чемпионаты','Команда':'Команда'
};
const en={
 'Заезд':'Race','Гараж':'Garage','Тюнинг':'Tuning','Карьера':'Career','Чемпионаты':'Championships','Команда':'Team',
 'НОЧНАЯ СМЕНА':'NIGHT SHIFT','Основная навигация':'Main navigation','Как играть':'How to play',
 'Загрузка Tokyo Streets…':'Loading Tokyo Streets…','Отладка':'Debug','Открыть всё':'Unlock all','Сбросить всё':'Reset progress',
 'Локальная карьера в этом браузере':'Career saved in this browser',
 'УПРАВЛЕНИЕ':'CONTROL','ДИСЦИПЛИНА':'DISCIPLINE','ТРАССА':'COURSE','ПОКРЫТИЕ':'CONDITIONS',
 'Лично · карты':'Driver · cards','Менеджер · приказы':'Manager · orders',
 'Переменная влажность':'Patchy damp','☂ Переменная влажность':'☂ Patchy damp','☾ Сухой асфальт':'☾ Dry asphalt','☂ Дождь':'☂ Rain',
 'Сухо':'Dry','Дождь':'Rain','Сухой асфальт':'Dry asphalt',
 'Твой лучший заезд':'Your best run','ЗАКРЫТЫЙ МАРШРУТ':'CLOSED COURSE','ПЕРЕД СТАРТОМ':'READY TO RACE',
 'ФИНИШ':'FINISH','СХОД / DNF':'RETIRED / DNF','ПОВТОР РЕКОРДА':'BEST RUN REPLAY',
 'Заезд окончен.':'Race complete.',
 'Судейские клипы':'Judged clipping points','Фазы дрэга':'Drag stages','Разведка маршрута':'Course overview',
 'Выбор соперника':'Choose your rival','ЛИЧНЫЙ РЕКОРД / ЭТА СБОРКА':'PERSONAL BEST / THIS BUILD',
 'Рекорда пока нет.':'No record yet.','Показывать призрак':'Show ghost',
 '▶ Повтор рекорда':'▶ Replay best run','Завершить просмотр':'Exit replay','На старт ↗':'Start race ↗',
 'На старт этапа ↗':'Start championship round ↗','Посмотреть результат ↓':'View results ↓',
 'Покинуть заезд':'Leave race','Ⅱ Пауза':'Ⅱ Pause','Скорость':'Speed','На дорогу ↗':'Hit the road ↗',
 'Выбор приёма':'Choose a move','ПРОСМОТР ПЕРЕД СТАРТОМ':'PRE-RACE PREVIEW','ВЫБЕРИ КАРТУ → ИСПОЛНИ СЕКТОР':'PICK A CARD → RUN SECTOR',
 'БЕЗ СЛУЧАЙНОЙ РАЗДАЧИ':'NO RANDOM DRAWS','КАРТЫ':'CARDS','ПОЛНЫЙ НАБОР':'FULL DECK',
 'Золото':'Gold','Серебро':'Silver','Бронза':'Bronze',
 'ХРОНОМЕТР':'TIMING','ОДИНОЧНАЯ СЕССИЯ':'SOLO RUN','ТВОЁ ВРЕМЯ':'YOUR TIME',
 'ТЫ ВПЕРЕДИ / СЕК':'YOU LEAD / SEC','ТЫ ПОЗАДИ / СЕК':'YOU TRAIL / SEC',
 'НА ОДНОЙ ЛИНИИ':'NECK AND NECK','ПОВТОР БЕЗ НАГРАД':'REPLAY / NO REWARDS',
 'БАЛЛЫ ЗА СЕССИЮ / МАКС. 800':'RUN SCORE / MAX 800',
 'Машина допущена к старту':'Ready to race','Класс сборки:':'Build class:',
 'Выплаты за повторение:':'Repeat payout:','Персонал за старт:':'Crew cost per race:',
 'Нагрузка атак:':'Attack strain:','СЕКТОРОВ':'SECTORS','КЛИПОВ':'CLIPS','ФАЗЫ':'STAGES','ФАЗ':'STAGES',
 'Пауза':'Pause','Возобновить':'Resume','Отмена':'Cancel','Закрыть':'Close',
 'Сохранить настройки':'Save setup','Настройки сохранены':'Setup saved','Базовые настройки':'Reset setup',
 'НАСТРОЙКИ МАШИНЫ':'CAR SETUP','Подстрой под трассу':'Dial in your setup',
 'Все':'All','В гараж':'Garage','Ещё одна связка ↗':'Run it again ↗','▶ Повтор заезда':'▶ Watch replay',
 'Протокол JSON ↓':'Export JSON ↓','Судейский протокол':'Judge report',
 'Последний клип':'Last clip','Связка / максимум':'Combo / best','Чистые серии':'Clean chains',
 'Разрывы / развороты':'Breaks / spins','Температура шин':'Tire temperature',
 'Сохранить название':'Save team name','Название команды':'Team name',
 'Основать команду':'Found team','Назначить пилота':'Assign driver','Назначен на текущую машину':'Assigned to current car',
 'Базовый приказ':'Default order','Сохранить план':'Save plan',
 'ПУТЬ К СВОЕЙ КОМАНДЕ':'BUILD YOUR OWN TEAM','ШТАБ ОТКРЫТ':'TEAM HQ OPEN',
 'Приказы пилоту':'Team radio','Ответ пилота:':'Driver response:',
 'Передать сектор пилоту ↗':'Send driver into sector ↗',
 'Остановить после участка':'Stop after this sector','Авто до финиша':'Auto-run to finish',
 'Настройки сохранены':'Setup saved','Сбросить всё?':'Reset all progress?'
};
let language='ru';
try{language=localStorage.getItem(LANG_KEY)==='en'?'en':'ru';}catch{}
export const getLanguage=()=>language;
export const translate=(text)=>language==='en'?(en[text]??text):(ru[text]??text);
export function setLanguage(next){
 language=next==='en'?'en':'ru';
 try{localStorage.setItem(LANG_KEY,language);}catch{}
 document.documentElement.lang=language;
 document.title=language==='en'?'Tokyo Streets | Tactical Racing':'Tokyo Streets | Тактические гонки';
}
function translateText(text){
 if(!text?.trim())return text;
 const trimmed=text.trim();
 const exact=en[trimmed];
 if(exact!==undefined)return text.replace(trimmed,exact);
 // Whole-word expressions in generated status labels, not free-form replacement of save data.
 const replacements=[
  [/кг\/л\.с\./g,'kg/hp'],[/л\.с\./g,'hp'],[/км\/ч/g,'km/h'],
  [/кг/g,'kg'],[/ПЕРЕД СТАРТОМ/g,'READY TO RACE'],
  [/СЕКТОР\s+(\d+)/g,'SECTOR $1']
 ];
 let value=text;
 for(const [pattern,replacement] of replacements)value=value.replace(pattern,replacement);
 return value;
}
export function localize(root=document){
 document.documentElement.lang=language;
 const selected=root.querySelector?.('#language-select');
 if(selected)selected.value=language;
 if(language==='ru')return;
 const skip='script,style,textarea,pre,code,[contenteditable],input,option[value^="custom"]';
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  const parent=node.parentElement;
  if(!parent||parent.closest(skip))continue;
  const translated=translateText(node.nodeValue);
  if(translated!==node.nodeValue)node.nodeValue=translated;
 }
 for(const element of root.querySelectorAll('[aria-label],[title],[placeholder]')){
  for(const attr of ['aria-label','title','placeholder']){
   const value=element.getAttribute(attr);
   if(value)element.setAttribute(attr,translateText(value));
  }
 }
}
setLanguage(language);
