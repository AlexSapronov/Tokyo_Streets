import {CARS,PARTS} from './data.js';
import {getEngine,stockEngineId} from './engine-data.js';
import {nominalConfiguration,performanceProfile} from './engine.js';

const roster=(cars,parts=[[],[],[]])=>cars.map((car,i)=>[['kei','Кэй Накамура','ren','balanced'],['rika','Рика Исикава','yui','safe'],['daichi','Дайти Сато','aki','attack']][i]).map(([id,name,pilot,style],i)=>[id,name,cars[i],pilot,style,parts[i]]);
const base={special:true,tier:0,previous:null,races:3,street:0,maxPower:330,drives:['FR','FF','AWD','MR'],naOnly:false,budget:18000,fee:3000,prizes:[16000,10000,6000,2000]};
export const SPECIAL_CUPS=[
 {...base,id:'special-na',name:'NA Club · атмосферные до 200',maxPower:200,naOnly:true,ruleText:'Атмосферный мотор · до 200 л.с. исправной сборки',stages:[['haruna','dry'],['tsukuba','dry']],roster:roster(['ae86','ek9','mx5'],[['brakes'],[],['suspension']])},
 {...base,id:'special-light',name:'Featherweight · до тонны',maxMass:1000,maxPower:220,ruleText:'Фактическая масса с установленными деталями — не больше 1000 кг',stages:[['haruna','mixed'],['nikko','dry']],roster:roster(['mx5','ae86','mx5'],[['brakes'],['lsd'],['suspension']])},
 {...base,id:'special-ff',name:'Frontline · передний привод',maxPower:230,drives:['FF'],ruleText:'Только FF · до 230 л.с. исправной сборки',stages:[['tsukuba','dry'],['nikko','rain']],roster:roster(['ek9','ek9','ek9'],[['brakes'],['streetTires'],['suspension']])},
 {...base,id:'special-factory',name:'Factory Heart · родной мотор',stockEngineOnly:true,ruleText:'Заводская модель двигателя · тюнинг разрешён · до 330 л.с.',stages:[['akagi','dry'],['yokohama-half','dry']],roster:roster(['s13','evo','chaser'],[['lsd'],['brakes'],['cooling']])},
 {...base,id:'special-budget',name:'Grassroots · сборка до ¥60 000',maxBuildCost:60000,maxPower:230,fee:2000,prizes:[12000,8000,4000,1500],ruleText:'Каталожная цена кузова и установленного тюнинга — до ¥60 000; износ не снижает оценку',stages:[['haruna','dry'],['tsukuba','mixed']],roster:roster(['ae86','mx5','ek9'],[['tires','brakes'],['lsd'],['streetTires']])}
];
export function buildValue(config){
 const stock=stockEngineId(config.car.id),motor=config.engineId||stock;
 return CARS.find(c=>c.id===config.car.id).price+config.parts.reduce((sum,id)=>sum+PARTS.find(p=>p.id===id).price,0)+(motor!==stock?getEngine(motor).price:0);
}
export function specialRegulationReason(config,cup){
 if(!cup.special)return '';
 const healthy=nominalConfiguration(config);
 if(healthy.car.power>cup.maxPower)return `Лимит ${cup.maxPower} л.с. по исправной сборке; износ не облегчает допуск`;
 if(cup.maxMass&&performanceProfile(healthy).mass>cup.maxMass)return `Лимит массы ${cup.maxMass} кг с установленными деталями`;
 if(cup.stockEngineOnly&&config.engineId!==stockEngineId(config.car.id))return 'Нужна заводская модель двигателя этой машины';
 if(cup.maxBuildCost&&buildValue(healthy)>cup.maxBuildCost)return `Лимит стоимости сборки ¥${cup.maxBuildCost.toLocaleString('ru-RU')}`;
 return '';
}
