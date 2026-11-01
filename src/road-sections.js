import {trackGeometry,SECTOR_ANCHORS} from './track-geometry.js';
// Entry/exit positions are authored in the venue's anchor sequence. A full
// corner is one decision; flat-out kinks remain within the adjacent straight.
// [entry, exit, braking radius, name]. These do not change the road silhouette.
export const ROAD_TURNS={
 haruna:[[1,3.2,78,'Первый правый'],[4.25,6.4,24,'Кедровая шпилька'],[7.8,8.75,48,'Поворот перед тоннелем'],[10,12.4,21,'Шпилька у водопада'],[13.65,14.45,58,'Последний правый']],
 akagi:[[1,3.1,72,'Верхняя шпилька'],[4,6.25,38,'Лесной разворот'],[6.7,7.25,42,'Вход в ломаную связку'],[7.75,8.45,36,'Выход из ломаной связки'],[10.15,12.35,29,'Нижняя шпилька'],[13.65,14.45,48,'Финишный правый']],
 tsukuba:[[1,3.2,55,'Первый разворот'],[4.35,6.3,42,'Левая дуга'],[6.85,7.3,65,'Правый перед разгоном'],[7.8,11.25,60,'Дальний разворот'],[12.55,13,55,'Выход на главную прямую']],
 irohazaka:[[1,2.3,23,'Первая шпилька'],[2.85,4.1,27,'Левая у стены'],[4.85,5.55,39,'Вход в двойной радиус'],[5.55,6.15,32,'Выход из двойного радиуса'],[6.8,8.25,21,'Моховая шпилька'],[8.95,10.3,29,'Обратная петля'],[10.8,11.35,55,'Поворот к станции']],
 hakone:[[1,3.1,125,'Панорамная дуга'],[4.1,6.25,68,'Слепой поворот у озера'],[7.1,9.15,96,'Дуга у смотровой']],
 wangan:[],
 nikko:[[1,3.15,29,'Первый разворот'],[4.8,6.35,44,'Левая связка'],[7.45,9.5,82,'Скоростной правый'],[10.4,11.3,24,'Тормозной карман']],
 suzuka:[[2,5.2,65,'Первый и второй повороты'],[5.8,7.35,62,'S-связки · первая дуга'],[7.35,8.7,58,'S-связки · перекладка'],[8.7,10.05,62,'S-связки · обратная дуга'],[10.05,11.7,68,'S-связки · выход'],[11.7,14.2,110,'Dunlop'],[15.4,16.8,43,'Degner · первый'],[17.6,20.15,38,'Degner · второй'],[21.4,24.4,25,'Шпилька'],[25.1,28.8,200,'200R'],[29.1,33,68,'Spoon'],[36.2,40.2,130,'130R'],[40.2,42.15,28,'Шикана · вход'],[42.15,44.2,32,'Шикана · выход']],
 fuji:[[2,5.15,30,'TGR · первый поворот'],[7.55,9.2,65,'Coca-Cola'],[9.2,12.6,100,'100R'],[12.6,16.3,27,'ADVAN · шпилька'],[22.4,24.45,28,'Dunlop · шикана'],[25,27.4,48,'Технический подъём'],[28.05,30.2,36,'GR Supra'],[30.2,32,45,'GR GT'],[32,34.5,65,'Panasonic']]
};
// Long full-throttle stretches still offer decisions without fictitious braking.
const STRAIGHT_BREAKS={wangan:[2,4,6,8]};
export const FAST_BENDS={haruna:[[3.2,4.25],[6.4,7.8]],akagi:[[8.45,10.15],[12.35,13.65]],tsukuba:[[3.2,4.35]],irohazaka:[[8.25,8.95]],hakone:[[3.1,4.1],[6.25,7.1]],wangan:[[0,9]],nikko:[[3.15,4.8]],suzuka:[[44.2,46]],fuji:[[16.3,22.4]]};
// Find the marked point on its original geometry piece. Restricting the search
// to that piece disambiguates crossings such as Suzuka's bridge.
function atAnchor(event,geometry,index){
 const bounds=SECTOR_ANCHORS[event.id],last=event.anchors.length-1;if(index<=0)return 0;if(index>=last)return 1;
 const exact=bounds.indexOf(index);if(exact>=0)return geometry.pieces[exact]?.start??1;
 const k=Math.max(0,bounds.findIndex((end,i)=>i&&index<end)-1),piece=geometry.pieces[k];
 const lo=Math.floor(index),t=index-lo,target=event.anchors[lo].map((v,j)=>v+(event.anchors[lo+1][j]-v)*t);
 const distance=f=>{const p=geometry.at(f);return (p[0]-target[0])**2+(p[1]-target[1])**2;};
 let best=piece.start,value=Infinity;const step=(piece.end-piece.start)/256;
 for(let i=0;i<=256;i++){const f=piece.start+i*step,d=distance(f);if(d<value){value=d;best=f;}}
 let a=Math.max(piece.start,best-step),b=Math.min(piece.end,best+step);
 for(let i=0;i<20;i++){const x=a+(b-a)/3,y=b-(b-a)/3;if(distance(x)<distance(y))b=y;else a=x;}return (a+b)/2;
}
export function authoredRoad(event){
 const turns=ROAD_TURNS[event.id];if(!turns)throw Error('Нет разметки трассы '+event.id);
 const geometry=trackGeometry(event),total=event.sectors.reduce((n,s)=>n+s.length,0),toFraction=i=>atAnchor(event,geometry,i),zones=turns.map(([entry,exit,radius,name])=>({start:toFraction(entry),end:toFraction(exit),radius,name}));
 const breaks=[...new Set([0,1,...zones.flatMap(z=>[z.start,z.end]),...(STRAIGHT_BREAKS[event.id]||[]).map(toFraction)])].sort((a,b)=>a-b);
 const fast=(FAST_BENDS[event.id]||[]).map(([a,b])=>[toFraction(a),toFraction(b)]),sectors=[];
 for(let i=0;i<breaks.length-1;i++){
  const start=breaks[i],end=breaks[i+1],middle=(start+end)/2,turn=zones.find(z=>middle>=z.start&&middle<z.end),sourceIndex=Math.max(0,geometry.pieces.findIndex(p=>middle>=p.start&&middle<p.end)),source=event.sectors[sourceIndex],length=(end-start)*total,radius=turn?.radius||0,flatOut=!turn&&fast.some(([a,b])=>Math.min(end,b)-Math.max(start,a)>1e-6);
  const decisionScale=geometry.pieces.reduce((sum,p,j)=>sum+Math.max(0,Math.min(end,p.end)-Math.max(start,p.start))*total/event.sectors[j].length,0);
  sectors.push({...source,name:turn?.name||(flatOut?'Полный газ · ':'Прямая · ')+Math.round(length)+' м',label:turn?(radius<35?'Шпилька':radius<70?'Крутой поворот':radius<140?'Средний поворот':'Скоростная дуга'):flatOut?'Прямая · скоростной излом':'Прямая',type:turn?'corner':'straight',radius,length,decisionScale,sourceIndex,requiresBraking:!!turn,flatOut,entry:start,exit:end});
 }
 for(let i=0;i<sectors.length;i++)if(sectors[i].type==='straight')sectors[i].nextRadius=sectors.slice(i+1).find(s=>s.type==='corner')?.radius||0;
 return {...event,routeVersion:3,geometrySource:event,sectors,description:event.description.replace(/\d+ игровых участков/,sectors.length+' игровых участков')};
}
