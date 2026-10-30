import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,PILOTS,PARTS,getEvent,sectorAt} from '../src/data.js';
import {DRIFT_CARDS} from '../src/drift-data.js';
import {freshDriftState,simulateDrift,driftReason,DRIFT_WEIGHTS} from '../src/drift.js';
import {configuration,createRace,resolveSector,chooseAI,futureSectors,raceOutcome,availableCards} from '../src/engine.js';
import {awardRace,raceRecord,recordKey,bestFor} from '../src/progress.js';
import {newCareer,validateSave} from '../src/storage.js';
import {qualitativeForecast} from '../src/tactics.js';
import {driftFrame,replayIndex} from '../src/replay.js';
import {finishRace,assertState,generator} from './helpers.js';
const cfg=configuration('ae86','ren'),card=id=>DRIFT_CARDS.find(card=>card.id===id);
const sector=(i,weather='dry')=>sectorAt(i,weather,'ebisu');
const clean=['drift-feint','drift-modulate','drift-smooth','drift-unwind','drift-feint','drift-modulate','drift-smooth','drift-unwind'];
const entry=(config=cfg)=>simulateDrift(config,freshDriftState(config),sector(0),card('drift-feint')).next;

test('drift session has two full four-phase chains and a permanently visible discipline set',()=>{
 assert.deepEqual(getEvent('ebisu').sectors.map(clip=>clip.phase),['init','hold','transition','exit','init','hold','transition','exit']);
 assert.equal(availableCards(cfg,'drift').length,13);assert.equal(Object.values(DRIFT_WEIGHTS).reduce((a,b)=>a+b,0),1);
 assert.ok(availableCards(cfg,'drift').every(card=>card.id.startsWith('drift-')));
});
test('foreign actions, wrong phases and costly actions are rejected without changing the race',()=>{
 const race=createRace(cfg,'dry','ebisu'),copy=structuredClone(race);
 assert.throws(()=>resolveSector(race,'balanced'),/недоступна/);assert.throws(()=>resolveSector(race,'drag-warm'),/недоступна/);
 assert.throws(()=>resolveSector(race,'drift-smooth'),/фазе/);assert.deepEqual(race,copy);
 assert.match(driftReason({id:'attack'},sector(0),race.player,cfg),/не используется/);
 assert.throws(()=>simulateDrift(cfg,{...race.player,focus:0},sector(0),card('drift-clutch')),/концентрации/);
});
test('holding and transitions require a real drift; stabilization remains available at zero focus',()=>{
 const state=freshDriftState(cfg);
 assert.match(driftReason(card('drift-modulate'),sector(1),state,cfg),/устойчивого заноса/);
 assert.match(driftReason(card('drift-smooth'),sector(2),state,cfg),/устойчивого заноса/);
 for(let i=0;i<8;i++)assert.equal(driftReason(card('drift-reset'),sector(i),{...state,focus:0},cfg),'');
});
test('judging weights, documented deductions, aggregate score and resource bounds agree',()=>{
 const race=finishRace(cfg,'mixed','ebisu',clean);assertState(assert,race);
 const d=race.player.drift;assert.equal(d.clips.length,8);
 assert.ok(Math.abs(d.score-d.clips.reduce((sum,clip)=>sum+clip.points,0))<1e-9);
 for(const clip of d.clips){
  const weighted=clip.line*.35+clip.angle*.25+clip.speed*.2+clip.continuity*.2;
  assert.ok(Math.abs(weighted-clip.penalty-clip.points)<1e-8);
  for(const key of ['line','angle','speed','continuity','points','penalty'])assert.ok(clip[key]>=0&&clip[key]<=100);
 }
 assert.equal(d.completedChains,2);assert.equal(d.peakCombo,4);assert.equal(d.active,false);
 assert.ok(race.history.every(row=>row.aiTime===null&&row.gap===null&&row.aiPlan.length===0));
});
test('precise angle can outscore maximum angle, so speed or spectacle alone is insufficient',()=>{
 const state=entry();const precise=simulateDrift(cfg,state,sector(1),card('drift-modulate'));
 const angle=simulateDrift(cfg,state,sector(1),card('drift-angle'));
 assert.ok(angle.clip.angleDegrees>precise.clip.angleDegrees);assert.ok(angle.clip.points<precise.clip.points);
});
test('a real spin breaks the chain, yields zero points and consumes extra tires',()=>{
 const config=configuration('chaser','aki'),state=freshDriftState(config);
 state.focus=70;state.tires=10;state.heat=190;
 const result=simulateDrift(config,state,sector(0,'rain'),card('drift-clutch'));
 assert.equal(result.clip.spin,true);assert.equal(result.clip.points,0);assert.equal(result.next.drift.active,false);
 assert.equal(result.next.drift.combo,0);assert.equal(result.next.drift.spins,1);assert.equal(result.next.drift.breaks,1);
 assert.ok(result.reasons.some(reason=>reason.includes('Разворот')));assert.ok(result.next.tires<state.tires);
});
test('recovery can restart a lost drift, with an explicit continuity and scoring cost',()=>{
 const initial=freshDriftState(cfg),reset=simulateDrift(cfg,initial,sector(0),card('drift-reset')).next;
 const recovered=simulateDrift(cfg,reset,sector(1),card('drift-recover'));
 assert.equal(recovered.next.drift.active,true);assert.equal(recovered.clip.continuity,0);assert.ok(recovered.clip.penalty>0);
 assert.ok(recovered.clip.points>0);assert.ok(recovered.reasons.some(reason=>reason.includes('Возврат')));
});
test('stabilizing preserves the car but deliberately sacrifices the entire clip',()=>{
 const state=entry(),result=simulateDrift(cfg,state,sector(1),card('drift-reset'));
 assert.equal(result.clip.points,0);assert.equal(result.next.drift.active,false);assert.equal(result.next.drift.combo,0);
 assert.ok(result.next.focus>state.focus);assert.ok(result.next.heat<state.heat);
});
test('transition must change direction to retain continuity',()=>{
 const state=simulateDrift(cfg,entry(),sector(1),card('drift-modulate')).next;
 const linked=simulateDrift(cfg,state,sector(2),card('drift-smooth'));
 const wrong=simulateDrift(cfg,state,{...sector(2),direction:state.drift.direction},card('drift-smooth'));
 assert.equal(linked.clip.linked,true);assert.equal(wrong.clip.linked,false);assert.equal(wrong.clip.continuity,0);
 assert.ok(linked.clip.points>wrong.clip.points);
});
test('AWD yaw response differs from FR on the exact same power and mass fixture',()=>{
 const fr=configuration('evo','ren'),awd=structuredClone(fr);fr.car={...fr.car,drive:'FR'};
 const a=simulateDrift(fr,freshDriftState(fr),sector(0),card('drift-feint'));
 const b=simulateDrift(awd,freshDriftState(awd),sector(0),card('drift-feint'));
 assert.ok(a.clip.angleDegrees>b.clip.angleDegrees);assert.ok(b.reasons.some(reason=>reason.includes('AWD')));
});
test('LSD improves line control, cooling reduces heat, and hot tires lose grip',()=>{
 const state=entry(),base=simulateDrift(cfg,state,sector(1),card('drift-modulate'));
 const lsd=configuration('ae86','ren',['lsd']),improved=simulateDrift(lsd,state,sector(1),card('drift-modulate'));
 assert.ok(improved.clip.line>base.clip.line);assert.ok(improved.reasons.some(reason=>reason.includes('LSD')));
 const cooled=simulateDrift(configuration('ae86','ren',['cooling']),state,sector(1),card('drift-modulate'));
 assert.ok(cooled.next.heat<base.next.heat);
 const hot=structuredClone(state);hot.drift.temperature=155;
 const overheated=simulateDrift(cfg,hot,sector(1),card('drift-modulate'));
 assert.ok(overheated.risk>base.risk);assert.ok(overheated.reasons.some(reason=>reason.includes('Перегретые шины')));
});
test('feint responds to mass and brake entry responds to brake equipment',()=>{
 const heavy=configuration('ae86','ren');heavy.car={...heavy.car,mass:1550};
 const lighter=simulateDrift(cfg,freshDriftState(cfg),sector(0),card('drift-feint'));
 const heavier=simulateDrift(heavy,freshDriftState(heavy),sector(0),card('drift-feint'));
 assert.ok(lighter.clip.angleDegrees>heavier.clip.angleDegrees);
 const brakes=configuration('ae86','ren',['brakes']);
 assert.notEqual(simulateDrift(brakes,freshDriftState(brakes),sector(0),card('drift-handbrake')).clip.angleDegrees,
   simulateDrift(cfg,freshDriftState(cfg),sector(0),card('drift-handbrake')).clip.angleDegrees);
});
for(const car of CARS)for(const pilot of PILOTS)for(const weather of ['dry','mixed','rain']){
 test(`drift complete/reward/save/replay / ${car.id} / ${pilot.id} / ${weather}`,()=>{
  const config=configuration(car.id,pilot.id),race=finishRace(config,weather,'ebisu',null,'drift-matrix');
  assertState(assert,race);assert.deepEqual(race,finishRace(config,weather,'ebisu',null,'drift-matrix'));
  assert.ok(race.player.drift.score>=0&&race.player.drift.score<=800);
  const award=awardRace(newCareer(),race),loaded=validateSave(award.career),record=loaded.bests[0];
  assert.deepEqual(record,raceRecord(race));assert.ok(loaded.official>0);assert.equal(loaded.street,0);assert.equal(loaded.wins,0);
  assert.throws(()=>awardRace(loaded,race),/повторно/);
  const replay=finishRace(configuration(record.carId,record.pilotId,record.parts,record.condition),weather,'ebisu',record.actions);
  assert.equal(replay.player.drift.score,record.drift.score);assert.deepEqual(replay.history.map(row=>row.playerTime),record.sectorTimes);
 });
}
test('medal boundaries award score rather than the shortest elapsed time',()=>{
 const race=finishRace(cfg,'dry','ebisu');
 for(const [medal,points] of Object.entries(getEvent('ebisu').medals)){
  const fixture=structuredClone(race);fixture.player.drift.score=points;fixture.player.time=999;
  assert.equal(raceOutcome(fixture).medal,medal);assert.equal(raceOutcome(fixture).won,false);
 }
 const empty=finishRace(cfg,'dry','ebisu',Array(8).fill('drift-reset'));
 assert.equal(empty.player.drift.score,0);assert.equal(raceOutcome(empty).medal,null);assert.equal(raceOutcome(empty).reward,5500);
 assert.equal(validateSave(awardRace(newCareer(),empty).career).bests[0].drift.score,0);
});
test('higher score replaces a faster record, while lower score and slower ties cannot replace it',()=>{
 const original=finishRace(cfg,'dry','ebisu'),first=awardRace(newCareer(),original);
 const better=structuredClone(original);better.player.time+=100;better.history[0].playerTime+=100;
 better.player.drift.score+=.5;better.player.drift.clips[0].points+=.5;better.player.drift.clips[0].line+=.5/.35;
 const second=awardRace(first.career,better);assert.equal(second.isBest,true);
 assert.equal(bestFor(second.career,cfg,'ebisu','dry').drift.score,better.player.drift.score);
 assert.equal(awardRace(second.career,original).isBest,false);
 const tie=structuredClone(better);tie.player.time+=1;tie.history[0].playerTime+=1;
 assert.equal(awardRace(second.career,tie).isBest,false);
 const loaded=validateSave({...second.career,bests:[raceRecord(original),raceRecord(better)]});
 assert.equal(loaded.bests.length,1);assert.equal(loaded.bests[0].drift.score,better.player.drift.score);
});
test('a faster equal-score record wins the tie breaker',()=>{
 const race=finishRace(cfg,'dry','ebisu'),first=awardRace(newCareer(),race),faster=structuredClone(race);
 faster.player.time-=.1;faster.history[0].playerTime-=.1;
 assert.equal(awardRace(first.career,faster).isBest,true);
});
test('malformed drift telemetry is rejected per record without resetting the wallet',()=>{
 const good=raceRecord(finishRace(cfg,'dry','ebisu'));
 const variants=[null,{...good.drift,clips:[]},{...good.drift,score:Infinity},{...good.drift,score:900},
  {...good.drift,peakCombo:8},{...good.drift,direction:9},{...good.drift,active:'yes'},{...good.drift,combo:-1},{...good.drift,completedChains:3},{...good.drift,breaks:-1},{...good.drift,spins:9},{...good.drift,angle:100},{...good.drift,combo:4,peakCombo:1},{...good.drift,temperature:500},{...good.drift,combo:NaN}];
 for(const drift of variants){const loaded=validateSave({...newCareer(),money:12345,bests:[{...good,drift},good]});assert.equal(loaded.money,12345);assert.equal(loaded.bests.length,1);}
 for(const change of [{phase:'wrong'},{direction:0},{points:NaN},{angle:101},{velocity:0},{spin:'yes'},{valid:null},{linked:7},{points:0}]){
  const drift=structuredClone(good.drift);Object.assign(drift.clips[0],change);
  assert.equal(validateSave({...newCareer(),bests:[{...good,drift}]}).bests.length,0);
 }
});
test('qualitative drift forecast does not reveal exact judging points or execution time',()=>{
 const state=freshDriftState(cfg),c=card('drift-feint'),prediction=simulateDrift(cfg,state,sector(0),c);
 const forecast=qualitativeForecast(cfg,state,sector(0),c,prediction);
 assert.ok(['Точная связка','Рабочая линия','Потеря качества'].includes(forecast.pace));
 assert.ok(!JSON.stringify(forecast).includes(prediction.clip.points.toFixed(2)));assert.ok(!JSON.stringify(forecast).includes(prediction.time.toFixed(2)));
 const reset=card('drift-reset');assert.match(qualitativeForecast(cfg,state,sector(0),reset,simulateDrift(cfg,state,sector(0),reset)).warning,/прервёт/);
});
test('drift AI optimizes judging quality with legal actions rather than simply choosing fastest execution',()=>{
 const race=createRace(cfg,'dry','ebisu'),s=sector(0),choice=chooseAI(cfg,race.player,s,0,futureSectors(race));
 const fastest=availableCards(cfg,'drift').filter(c=>!driftReason(c,s,race.player,cfg)).map(c=>simulateDrift(cfg,race.player,s,c)).sort((a,b)=>a.time-b.time)[0];
 assert.ok(choice.result.clip.points>fastest.clip.points);
});
test('all 64 equipment builds finish drift with bounded resources and a valid record',()=>{
 for(let mask=0;mask<64;mask++){
  const parts=PARTS.filter((_,i)=>mask&(1<<i)).map(part=>part.id),config=configuration('evo','ren',parts);
  const race=finishRace(config,'mixed','ebisu');assertState(assert,race);
  assert.equal(validateSave(awardRace(newCareer(),race).career).bests.length,1);
 }
});
test('seeded 100 random legal drift runs never deadlock and all input states stay immutable',()=>{
 const random=generator(1986);
 for(let run=0;run<100;run++){
  const config=configuration(CARS[run%3].id,PILOTS[run%3].id,[],35+random()*65);let race=createRace(config,run%2?'rain':'dry','ebisu');
  while(!race.finished){
   const s=sectorAt(race.index,race.weather,'ebisu'),cards=DRIFT_CARDS.filter(c=>!driftReason(c,s,race.player,config));assert.ok(cards.length>0);
   const copy=structuredClone(race),choice=cards[Math.floor(random()*cards.length)];const next=resolveSector(race,choice.id);
   assert.deepEqual(race,copy);race=next;
  }
  assertState(assert,race);assert.ok(race.player.drift.score>=0&&race.player.drift.score<=800);
 }
});
test('replay frame sampling retains drift yaw, records completed points, and clamps at the finish',()=>{
 const record=raceRecord(finishRace(cfg,'dry','ebisu',clean)),first=record.sectorTimes[0];
 assert.equal(driftFrame(null,0),null);assert.equal(replayIndex([],0),0);
 const before=driftFrame(record,first/2);assert.equal(before.score,0);assert.ok(Math.abs(before.yaw)>.1);
 const next=driftFrame(record,first);assert.ok(next.score>0);assert.equal(next.index,1);
 const finish=driftFrame(record,record.time+1e-6);assert.equal(finish.score,record.drift.score);assert.equal(finish.index,7);
 assert.equal(replayIndex([0,2,8,3],0),1);assert.equal(replayIndex([0,2,8,3],2),2);assert.equal(replayIndex([0,2,8,3],14),3);
 assert.equal(recordKey(cfg,'ebisu','dry').split('|')[0],'drift-1');
});
