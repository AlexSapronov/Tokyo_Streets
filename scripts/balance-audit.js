// Deterministic, paired catalog/build/economy audit. Can run against another checkout.
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const rootArg=process.argv.indexOf('--root');
const root=rootArg<0?resolve(dirname(fileURLToPath(import.meta.url)),'..'):resolve(process.argv[rootArg+1]);
const mod=name=>import(pathToFileURL(join(root,'src',name+'.js')));
const [data,engine,progress,storage,garage,balance,player]=await Promise.all(['data','engine','progress','storage','garage','balance','player'].map(mod));
const {CARS,PILOTS,EVENTS}=data;
const {configuration:baseConfiguration,createRace,chooseAI,chooseRacingLine,resolveSector,futureSectors,raceOutcome}=engine;
const modern=process.argv.includes('--modern');
const configuration=(...args)=>({...baseConfiguration(...args),...(modern?{routeVersion:3}:{})});
const sectorAt=(index,weather,id)=>data.sectorAt(index,weather,id,modern?3:1);
const seeds=[42,173],rows=[];
function drive(config,eventId,weather,seed,level=null,runId=null){
 let race=createRace(config,weather,eventId,runId,seed,level);
 while(!race.finished){
  const sector=sectorAt(race.index,weather,eventId),upcoming=futureSectors(race);
  let action=chooseAI(config,race.player,sector,race.opponent.dnf?Infinity:race.player.time-race.opponent.time,upcoming).card;
  if(['duel','timeattack'].includes(race.mode))action=chooseRacingLine(config,race.player,sector,action,upcoming[0]).card;
  race=resolveSector(race,action.id,action.lineId||'neutral');
 }
 return race;
}
function measure(group,config,eventId,weather,seed,level=null,label='stock'){
 const race=drive(config,eventId,weather,seed,level),outcome=raceOutcome(race);
 const career=storage.newCareer();career.car=config.car.id;career.ownedCars=[config.car.id];career.builds[config.car.id]=[...config.parts];career.purchased[config.car.id]=[...config.parts];
 // Respect the snapshotted engine/wear for pricing swaps and installed upgrades.
 career.engines.installed[config.car.id].engineId=config.engineId;career.wear[config.car.id]={...config.wear};
 const after=progress.awardRace(career,race).career,cost=garage.serviceCost(after);
 rows.push({group,event:eventId,mode:race.mode,car:config.car.id,pilot:config.pilot.id,weather,seed,level,label,time:race.player.time,score:race.player.drift?.score||0,medal:outcome.medal,won:outcome.won,dnf:!!race.player.dnf,falseStart:!!race.player.drag?.falseStart,wear:100-race.player.tires,oil:race.player.telemetry?.oil||0,focus:race.player.focus,prize:outcome.reward,cost,repeatNet:Math.round(outcome.reward*.5)-cost});
}
for(const event of EVENTS)for(const car of CARS)for(const pilot of PILOTS)for(const weather of ['dry','rain'])for(const seed of seeds)measure('catalog',configuration(car.id,pilot.id),event.id,weather,seed);
for(const eventId of ['haruna','yokohama-mile'])for(const car of CARS)for(const level of ['easy','equal','hard'])for(const weather of ['dry','rain'])for(const seed of seeds)measure('difficulty',configuration(car.id,'ren'),eventId,weather,seed,level);
const builds={street:['streetTires','pads'],track:['slicks','brakes','suspension','lsd'],wet:['wetTires','brakes','lsd'],power:['ecu','exhaust','turbo','cams','cooling','clutch']};
for(const car of ['ae86','s13','evo','nsx'])for(const [label,parts] of Object.entries(builds))for(const eventId of ['haruna','suzuka','fuji','yokohama','ebisu'])for(const weather of ['dry','rain'])for(const seed of seeds)measure('builds',configuration(car,'ren',parts),eventId,weather,seed,null,label);
for(const motor of ['ls3','1lr','w16','om606','6bt'])for(const eventId of ['suzuka','wangan','yokohama','yokohama-mile','ebisu'])for(const weather of ['dry','rain'])measure('swaps',configuration('ae86','ren',['ecu','turbo','cams','exhaust'],100,{},motor),eventId,weather,42,null,motor);
const campaigns=[];
for(const pilot of PILOTS){
 let career=storage.newCareer();career.pilot=pilot.id;
 const steps=[];
 for(let i=0;i<30;i++){
  const purchases=[];
  if(!career.purchased[career.car].includes('streetTires')&&Math.max(career.street,career.streetPeak||0,career.official)>=4&&career.money>=9000){career=garage.togglePart(career,'streetTires');purchases.push('streetTires');}
  if(career.car==='ae86'&&career.money>=50000){career=garage.selectCar(career,'s13');purchases.push('s13');}
  const cost=garage.serviceCost(career);
  let paidForService=0;
  if(cost<=career.money){career=garage.serviceCar(career);paidForService=cost;}else if(garage.recoveryNeeded(career)){const cash=career.money;career=garage.recoveryService(career);paidForService=cash-career.money;}
  const open=EVENTS.filter(e=>career.races>=e.unlockRaces&&career.street>=e.unlockStreet&&!(e.mode==='drift'&&['FF','AWD'].includes(CARS.find(c=>c.id===career.car).drive)));
  const event=open[i%open.length],runId='audit-'+pilot.id+'-'+i;
  const booked={fee:0};
  const cfg=player.playerConfiguration(configuration(career.car,career.pilot,career.builds[career.car],career.condition[career.car],career.setups[career.car],career.engines.installed[career.car].engineId,career.wear[career.car]),career.player);
  let race=drive(cfg,event.id,i%3===2?'rain':'dry',seeds[i%2],['duel','drag'].includes(event.mode)?'equal':null,runId);
  race.rewardScale=balance.payoutScale(career,event.id);
  const before=career.money;const award=progress.awardRace(career,race);career=storage.validateSave(award.career);
  steps.push({run:i+1,event:event.id,car:career.car,money:career.money,debt:career.repairDebt,paidForService,staff:booked.fee,earned:career.money-before,purchases,medal:raceOutcome(race).medal,won:raceOutcome(race).won,dnf:!!race.player.dnf});
 }
 campaigns.push({pilot:pilot.id,steps,finalMoney:career.money,repairReserve:garage.serviceCost(career),debt:career.repairDebt,car:career.car,xp:career.player.xp});
}
const summarize=a=>({runs:a.length,wins:a.filter(r=>r.won).length,gold:a.filter(r=>r.medal==='gold').length,dnf:a.filter(r=>r.dnf).length,meanPrize:Math.round(a.reduce((n,r)=>n+r.prize,0)/a.length),meanFullService:Math.round(a.reduce((n,r)=>n+r.cost,0)/a.length),meanRepeatNet:Math.round(a.reduce((n,r)=>n+r.repeatNet,0)/a.length)});
const catalog=EVENTS.map(e=>({event:e.id,...summarize(rows.filter(r=>r.group==='catalog'&&r.event===e.id))}));
const difficulty=['easy','equal','hard'].map(level=>({level,...summarize(rows.filter(r=>r.group==='difficulty'&&r.level===level))}));
const output={routeVersion:modern?3:1,scope:'All catalog cars/pilots, dry/rain, seeds 42/173, two-sector planner plus road line selection. Costs are actual complete service of all installed nodes plus body condition. Repeat net uses the 50% payout floor, no one-time bonuses ; campaigns include actual awards, wear, purchases and reloads. Small paired deterministic sample, not a statistical win-rate estimate.',totalRuns:rows.length,catalog,difficulty,campaigns,rows};
if(process.argv.includes('--json'))console.log(JSON.stringify(output));else{console.table(catalog);console.table(difficulty);console.table(campaigns.map(({steps,...c})=>c));console.log(`${rows.length} seeded races + 90 campaign starts. --json includes every run; --root PATH selects a comparison checkout.`);}
