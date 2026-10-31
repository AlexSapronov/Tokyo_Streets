import {CARS} from './data.js';
// Approximate game ratings, not homologated manufacturer specifications.
const stockIds=['4age','1jz','4g63','b6','sr20','13b','rb26','2jz','b16b','c30a','rb26r34'];
const masses=[115,210,150,110,150,125,230,230,120,200,230],rpms=[7600,7200,8000,7200,7500,8200,8000,7200,8600,8200,8000];
export const ENGINES=CARS.map((c,i)=>({id:stockIds[i],name:c.engine,power:c.power,mass:masses[i],redline:rpms[i],heat:1,cooling:1,price:18000+Math.round(c.power*110),extreme:false,fuel:'petrol'}));
ENGINES.push(
 {id:'1uz',name:'Toyota 1UZ-FE · 4.0 V8 · NA',power:260,mass:175,redline:6500,heat:1.12,cooling:.95,price:65000},
 {id:'ls3',name:'GM LS3 · 6.2 V8 · NA',power:430,mass:210,redline:6600,heat:1.3,cooling:.9,price:145000,extreme:true},
 {id:'1gz',name:'Toyota 1GZ-FE · 5.0 V12 · NA',power:280,mass:295,redline:6000,heat:1.25,cooling:.85,price:125000,extreme:true},
 {id:'m120',name:'Mercedes-Benz M120 · 6.0 V12 · NA',power:408,mass:300,redline:6000,heat:1.4,cooling:.82,price:195000,extreme:true},
 {id:'1lr',name:'Lexus 1LR-GUE · 4.8 V10 · NA',power:560,mass:210,redline:9000,heat:1.45,cooling:.85,price:390000,extreme:true},
 {id:'w16',name:'Bugatti · 8.0 W16 · QUAD TURBO',power:1001,mass:420,redline:6500,heat:2.1,cooling:.65,price:650000,extreme:true},
 {id:'om606',name:'Mercedes-Benz OM606 · 3.0 DIESEL TURBO',power:177,mass:245,redline:4800,heat:1.12,cooling:.95,price:68000,fuel:'diesel'},
 {id:'6bt',name:'Cummins 6BT · 5.9 DIESEL TURBO',power:215,mass:490,redline:3200,heat:1.3,cooling:.85,price:95000,extreme:true,fuel:'diesel'}
);
export const MOTOR_PARTS=['ecu','turbo','cams','exhaust','intercooler','flywheel'];
export const stockEngineId=carId=>stockIds[CARS.findIndex(c=>c.id===carId)]||'4age';
export const getEngine=id=>ENGINES.find(e=>e.id===id);
export const installedEngineId=(career,carId=career.car)=>career.engines?.installed?.[carId]?.engineId||stockEngineId(carId);
export function engineCar(car,id){
 const spec=getEngine(id||stockEngineId(car.id));if(!spec||spec.id===stockEngineId(car.id))return {...car};
 const original=getEngine(stockEngineId(car.id));return {...car,engine:spec.name,power:spec.power,mass:car.mass+spec.mass-original.mass+(spec.extreme?35:12),cooling:car.cooling*spec.cooling,engineHeat:spec.heat,engineRedline:spec.redline,engineShiftScale:spec.redline/original.redline,launchRPM:spec.fuel==='diesel'?spec.redline*.65:4800,engineId:spec.id};
}
