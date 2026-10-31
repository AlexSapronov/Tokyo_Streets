import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,PILOTS,EVENTS,CARDS,getEvent,sectorAt,eventLength} from '../src/data.js';
import {configuration,createRace,resolveSector,chooseAI,futureSectors,medalTargets,raceOutcome,disabledReason} from '../src/engine.js';
import {newCareer,validateSave} from '../src/storage.js';
import {recordKey,bestFor,awardRace,raceRecord,unlocked,progressAtTime,checkpointFractions} from '../src/progress.js';
import {vehicleSVG,topVehicleSVG} from '../src/vehicles.js';
function complete(carId='ae86',pilotId='ren',weather='mixed',eventId='haruna') {
  let race=createRace(configuration(carId,pilotId),weather,eventId,null,42);
  while(!race.finished) {
    const sector=sectorAt(race.index,weather,eventId);
    const decision=chooseAI(race.config,race.player,sector,race.player.time-race.opponent.time,futureSectors(race));
    race=resolveSector(race,decision.card.id);
  }
  return race;
}
test('all 189 car/driver/weather/route configurations finish or correctly stop after a run-off',()=>{
  for(const event of EVENTS)for(const car of CARS)for(const pilot of PILOTS)for(const weather of ['dry','rain','mixed']){
    const race=complete(car.id,pilot.id,weather,event.id);
    if(race.player.dnf)assert.ok(race.history.length<=event.sectors.length);else assert.equal(race.history.length,event.sectors.length);
    assert.ok(Number.isFinite(race.player.time));
    assert.ok(race.player.focus>=0&&race.player.tires>=0);
  }
});
test('routes have different distances, elevation and duel opposition',()=>{
  assert.equal(eventLength(getEvent('haruna')),2770);
  assert.equal(eventLength(getEvent('tsukuba')),2045);
  assert.ok(getEvent('akagi').sectors.some(sector=>sector.slope>0));
  assert.equal(createRace(configuration('ae86','ren'),'dry','akagi').rival.car.id,'ae86');
});
test('three-sector planner is deterministic, legal and can choose a different action from myopic AI',()=>{
  let observed=false;
  const config=configuration('ae86','ren');
  for(const event of EVENTS){
    let race=createRace(config,'rain',event.id);
    while(!race.finished){
      const sector=sectorAt(race.index,'rain',event.id),gap=race.player.time-race.opponent.time;
      const near=chooseAI(config,race.player,sector,gap),plan=chooseAI(config,race.player,sector,gap,futureSectors(race));
      assert.deepEqual(plan,chooseAI(config,race.player,sector,gap,futureSectors(race)));
      assert.equal(disabledReason(plan.card,sector,race.player,config,gap),'');
      assert.ok(plan.plan.length<=3&&plan.plan.length>=1);
      if(plan.card.id!==near.card.id)observed=true;
      race=resolveSector(race,plan.card.id);
    }
  }
  assert.ok(observed,'Planning must have an observable effect');
});
test('time attack has no AI or positional actions and keeps target times ordered for every weather',()=>{
  const race=createRace(configuration('ae86','aki'),'mixed','tsukuba');
  for(const id of ['defend','draft','study','dive']){
    const reason=disabledReason(CARDS.find(card=>card.id===id),sectorAt(1,'mixed','tsukuba'),race.player,race.config,0);
    assert.match(reason,/одиночной/);
  }
  assert.throws(()=>resolveSector(race,'study'),/одиночной/);
  const final=complete('evo','ren','dry','tsukuba');
  assert.ok(final.history.every(row=>row.aiTime===null&&row.gap===null&&row.aiPlan.length===0));
  assert.equal(final.opponent.time,0);
  for(const weather of ['dry','rain','mixed']){
    const targets=medalTargets('tsukuba',weather);
    assert.ok(targets.gold<targets.silver&&targets.silver<targets.bronze);
    const t={...final,weather};
    for(const [level,time] of Object.entries(targets))assert.equal(raceOutcome({...t,player:{...t.player,time}}).medal,level);
    assert.equal(raceOutcome({...t,player:{...t.player,time:targets.bronze+1}}).medal,null);
  }
});
test('unlocking and rewards progress independently, and completed runs cannot be awarded twice',()=>{
  let career=newCareer();assert.ok(unlocked(getEvent('haruna'),career));assert.ok(!unlocked(getEvent('akagi'),career));assert.ok(!unlocked(getEvent('tsukuba'),career));
  const race=complete(),before=structuredClone(career),award=awardRace(career,race);
  assert.deepEqual(career,before);assert.equal(award.career.money,career.money+raceOutcome(race).reward);
  assert.equal(award.career.races,1);assert.equal(award.career.official,0);
  assert.throws(()=>awardRace(award.career,award.race),/повторно/);
  assert.throws(()=>awardRace(career,createRace(configuration('ae86','ren'))),/повторно/);
  career=awardRace(award.career,race).career;assert.ok(unlocked(getEvent('tsukuba'),career));
  career.street=12;assert.ok(unlocked(getEvent('akagi'),career));
  const official=awardRace(career,complete('ae86','ren','dry','tsukuba'));
  assert.equal(official.career.street,career.street);assert.ok(official.career.official>career.official);
});
test('leaderboard key distinguishes event, weather, pilot and parts, independent of part order',()=>{
  const config=configuration('ae86','ren',['brakes','lsd']);
  const key=recordKey(config,'haruna','dry');
  assert.equal(key,recordKey(configuration('ae86','ren',['lsd','brakes']),'haruna','dry'));
  assert.notEqual(key,recordKey(config,'akagi','dry'));assert.notEqual(key,recordKey(config,'haruna','rain'));
  assert.notEqual(key,recordKey(configuration('ae86','yui',['brakes','lsd']),'haruna','dry'));
  assert.notEqual(key,recordKey(configuration('ae86','ren',[]),'haruna','dry'));
});
test('only faster runs replace a build record and traces survive validated saves',()=>{
  const race=complete(),a=awardRace(newCareer(),race);
  assert.equal(a.career.bests.length,1);
  const slower=structuredClone(race);slower.player.time+=1;slower.history[0].playerTime+=1;
  const b=awardRace(a.career,slower);assert.equal(b.isBest,false);assert.equal(b.career.bests[0].time,race.player.time);
  const faster=structuredClone(race);faster.player.time-=.1;faster.history[0].playerTime-=.1;
  const c=awardRace(b.career,faster);assert.equal(c.isBest,true);assert.equal(c.career.bests.length,1);
  assert.equal(bestFor(c.career,race.config,race.eventId,race.weather).time,faster.player.time);
  const loaded=validateSave(c.career);assert.deepEqual(loaded.bests,c.career.bests);assert.deepEqual(loaded.records,c.career.records);
});
test('v1 migration preserves money, unlock counters, purchases and history without inventing replay data',()=>{
  const raw={...newCareer(),version:1,money:32100,races:5,street:20,car:'chaser',ownedCars:['ae86','chaser'],
    purchased:{ae86:[],chaser:['brakes'],evo:[]},builds:{ae86:[],chaser:['brakes'],evo:[]},
    records:[{car:'Chaser Tourer V JZX100',time:100,won:true}]};
  delete raw.bests;delete raw.eventId;
  const result=validateSave(raw);assert.equal(result.version,2);assert.equal(result.money,32100);
  assert.equal(result.car,'chaser');assert.deepEqual(result.builds.chaser,['brakes']);
  assert.equal(result.records.length,1);assert.deepEqual(result.bests,[]);assert.ok(unlocked(getEvent('akagi'),result));
});
test('corrupt ghost traces are rejected individually without destroying career',()=>{
  const race=complete(),record=raceRecord(race);
  for(const broken of [{...record,time:1},{...record,sectorTimes:[1,2]},
    {...record,actions:Array(8).fill('<script>')},{...record,eventId:'bad'},
    {...record,sectorTimes:Array(8).fill(Infinity)}]){
    const loaded=validateSave({...newCareer(),money:12345,bests:[broken,record]});
    assert.equal(loaded.money,12345);assert.equal(loaded.bests.length,1);
  }
});
test('ghost timing interpolates by sector length, clamps before start/after finish, and preserves checkpoints',()=>{
  const event=getEvent('haruna'),times=event.sectors.map(()=>10),points=checkpointFractions(event.id);
  assert.equal(progressAtTime(times,-1,event.id),0);assert.equal(progressAtTime(times,1000,event.id),1);
  assert.equal(progressAtTime(times,10,event.id),points[1]);
  assert.ok(Math.abs(progressAtTime(times,5,event.id)-points[1]/2)<1e-9);
  assert.equal(progressAtTime([],100,event.id),0);
  for(const event of EVENTS){const fractions=checkpointFractions(event.id);assert.equal(fractions.at(-1),1);assert.equal(fractions.length,event.sectors.length+1);}
});
test('vehicle bodies and road sprites are distinct SVG assets with no external URLs',()=>{
  const meshes=CARS.map(vehicleSVG),sprites=CARS.map(topVehicleSVG);
  assert.equal(new Set(meshes).size,3);assert.equal(new Set(sprites).size,3);
  for(const asset of [...meshes,...sprites]){assert.ok(asset.includes('<svg'));assert.ok(!asset.includes('undefined'));assert.ok(!asset.includes('NaN'));assert.ok(!/href=/.test(asset));}
});
