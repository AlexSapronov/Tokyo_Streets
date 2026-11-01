import {configuration,createRace,resolveSector,availableCards} from './engine.js';
import {readTelemetry} from './telemetry.js';
import {getEvent} from './data.js';
export const LESSONS=[
 {name:'Первый старт',event:'haruna',weather:'dry',description:'Участок, приём, исполнение и фокус.'},
 {name:'Линия и температуры',event:'tsukuba',weather:'dry',description:'Траектории, шины, тормоза, масло и вода.'},
 {name:'Ритм и борьба',event:'haruna',weather:'mixed',description:'Повторы, общая нагрузка, ресурсные ходы и защита.'},
 {name:'Экзамен',event:'tsukuba',weather:'dry',description:'Бронза или лучше, фокус не ниже 30, тормоза не выше 145°C.'}
];
export const emptySchool=()=>({step:0,attempts:[0,0,0,0],bestExam:null,settled:[]});
export function normalizeSchool(raw){const s=emptySchool();if(!raw||typeof raw!=='object')return s;s.step=Number.isInteger(raw.step)?Math.max(0,Math.min(4,raw.step)):0;s.attempts=s.attempts.map((_,i)=>Number.isInteger(raw.attempts?.[i])?Math.max(0,Math.min(100000,raw.attempts[i])):0);s.bestExam=Number.isFinite(raw.bestExam)&&raw.bestExam>0?raw.bestExam:null;s.settled=[...new Set((Array.isArray(raw.settled)?raw.settled:[]).filter(id=>typeof id==='string'&&id.length>0&&id.length<=80))].slice(-32);return s;}
export function schoolCards(race){
 const all=availableCards(race.config,race.mode,race.eventId);if(!race.school)return all;
 const step=race.school.step;if(step>=2)return all;
 const ids=step===0?['balanced',...(race.index>=1?['attack']:[]),...(race.index>=3?['breathe']:[])]:['balanced','attack','breathe','safe','late','power','preserve','cool','thermal'];
 return all.filter(card=>ids.includes(card.id));
}
export function createLesson(career,step,runId=null){
 const progress=normalizeSchool(career.school);if(!Number.isInteger(step)||step<0||step>3||step>progress.step)throw Error('Сначала закончи предыдущий учебный заезд');
 const spec=LESSONS[step],config=configuration('ae86','ren',['streetTires','brakes','cooling','lsd'],100);
 config.routeVersion=3;const race=createRace(config,spec.weather,spec.event,runId,12601+step,spec.event==='haruna'?'easy':null);race.school={step,version:1};
 if(step===1){race.player.heat=118;race.player.telemetry={oil:132,coolant:104,tireTemp:94,brakes:118};}
 return race;
}
export function resolveLesson(race,card,line='neutral'){
 if(!race.school)return resolveSector(race,card,line);
 if(!schoolCards(race).some(c=>c.id===card))throw Error('Этот приём откроется позже в обучении');
 if(race.school.step===0&&line!=='neutral')throw Error('Выбор траектории откроется во втором уроке');
 const next=resolveSector(race,card,line);next.player.tires=100;if(next.player.dnf)next.player.dnf.damage=0;
 const row=next.history.at(-1);row.tires=100;row.telemetry=readTelemetry(next.config,next.player,next.mode);return next;
}
export function lessonResult(race){
 const step=race.school.step,full=!race.player.dnf&&race.finished&&race.history.length===getEvent(race.eventId,race.routeVersion).sectors.length,used=id=>race.history.some(r=>r.cardId===id);
 const tasks=step===0?[['Попробовать атаку',used('attack')],['Восстановить фокус',used('breathe')]]:step===1?[['Выбрать линию поворота',race.history.some(r=>r.lineId&&r.lineId!=='neutral')],['Применить охлаждение тормозов',used('cool')]]:step===2?[['Увидеть штраф повторного приёма',race.history.some(r=>r.reasons.some(s=>s.startsWith('Повтор приёма')))],['Восстановить фокус',used('breathe')]]:[['Время не хуже бронзы',race.player.time<=race.targets.bronze],['Фокус не ниже 30',race.player.focus>=30],['Тормоза не выше 145°C',race.player.heat<=145]];
 const checks=[['Финишировать без схода',full],...tasks];return {passed:checks.every(([,ok])=>ok),checks};
}
export function settleLesson(career,race){
 if(!race.school||!race.finished||race.awarded||!race.runId)throw Error('Нельзя завершить этот учебный заезд');const state=normalizeSchool(career.school);if(state.settled.includes(race.runId))throw Error('Учебный заезд уже учтён');
 const step=race.school.step;if(!Number.isInteger(step)||step<0||step>3||step>state.step)throw Error('Неверный этап обучения');const result=lessonResult(race),next=structuredClone(career);state.attempts[step]++;state.settled=[...state.settled,race.runId].slice(-32);
 if(result.passed&&step===state.step)state.step=Math.min(4,state.step+1);
 if(result.passed&&step===3)state.bestExam=state.bestExam===null?race.player.time:Math.min(state.bestExam,race.player.time);
 next.school=state;return {career:next,race:{...race,awarded:true,schoolResult:result}};
}
export function schoolHint(race){
 const step=race.school.step,i=race.index;
 if(step===3)return 'Экзамен без подсказок. Цели: финиш, бронзовое время, фокус ≥30 и тормоза ≤145°C. Машина защищена от износа.';
 const hints=step===0?[
 'Это пошаговая гонка. Сейчас доступен «Чистый темп»: выбери карту и нажми «Исполнить». Руль и педали не нужны.',
 'Открылась «Полная атака». Посмотри фокус до → после в прогнозе: ускорение расходует концентрацию и повышает нагрузку.',
 'Высокий фокус сужает RNG-разброс, но не отменяет потери сцепления и штрафы приёма. Следи за разбором участка.',
 'Открылось «Собраться». Попробуй его: фокус восстанавливается ценой времени. В этом уроке нужно применить атаку и восстановление.'
 ]:step===1?[
 'Тормоза учебной машины специально прогреты до 118°C. Выбери «Остудить тормоза»: свыше 105°C дорожные тормоза теряют эффективность; на прямых работает обдув.',
 'Теперь доступны все линии. Выбери неклассическую траекторию: короткий путь может ухудшить выход, поздний апекс — потерять время сейчас ради следующего участка.',
 'Температура шин показывает нагрузку. На дороге сцепление зависит от состава, покрытия и ресурса; сама температура здесь не даёт бонуса. В дрифте рабочее окно температуры влияет на оценку.',
 'Масло выше 125°C и вода выше 105°C ограничивают мощность. Охлаждение и спокойные ходы уменьшают тепловую нагрузку; остудить тормоза и мотор — разные задачи.',
 'Ресурс шин в школе зафиксирован на 100%. В карьере износ снижает сцепление и сохраняется между заездами. «Беречь шины» уменьшает расход.'
 ]:[
 'Открыт полный дорожный набор. Для демонстрации штрафа примени одну активную карту дважды в окне шести решений, например «Атака → Собраться → Атака».',
 'Штраф повторов хранит последние шесть решений: один промежуточный ход не сбрасывает его. Повтор меняет только расход или восстановление фокуса. Темп, нагрев и износ напрямую не штрафуются.',
 'Чередование двух атак тоже накапливает общую нагрузку. Разные атакующие карты не заменяют восстановление; используй спокойные приёмы.',
 'Пока фокуса достаточно, приём сохраняет темп. Риск ошибки растёт, когда фокус снижается. «Чистый темп» не штрафуется за повтор, ресурсные действия разгружают пилота.',
 'Защита доступна только при близком лидерстве: соперник получает +0,35 с, но обгон не запрещён. Сравни полное время обоих, а не стоимость своей карты.',
 'Траектория и скорость выхода влияют на следующий сектор. Разбор показывает вклад твоего решения при том же RNG. Не трать весь фокус ради последнего ускорения.'
 ];return hints[Math.min(i,hints.length-1)];
}
