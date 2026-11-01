import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,sectorAt} from '../src/data.js';
import {configuration,freshState,simulate,createRace,resolveSector} from '../src/engine.js';
import {executionRoll} from '../src/execution.js';
import {lineCard} from '../src/racing-lines.js';
import {qualitativeForecast} from '../src/tactics.js';
import {sectorFeedbackHTML,sectorDetailsHTML} from '../src/sector-feedback.js';
const config=configuration('ae86','ren');
test('road time breakdown sums to actual time across tactics, repeats, lines and execution',()=>{
 for(const id of ['balanced','attack','power','late','defend'])for(const wet of ['dry','rain'])for(const line of ['neutral','inside','wide-exit']){
  const s={...freshState(config),focus:75,velocity:35,recentActions:[id,id],strain:3},sector=sectorAt(1,wet,'haruna');
  const result=simulate(config,s,sector,lineCard(CARDS.find(c=>c.id===id),line),executionRoll(42,1,'player',75));
  assert.ok(Math.abs(Object.values(result.breakdown).reduce((a,b)=>a+b,0)-result.time)<1e-8);assert.ok(result.breakdown.repetition>=0);assert.ok(result.breakdown.strain>=0);
 }
});
test('defending measurably delays the opponent, reports it, and still permits a faster rival to pass',()=>{
 let r=createRace(config,'dry','haruna','defense',42);r.index=1;r.player.time=-.1;r.rival=configuration('r32','aki',['tires']);
 const clean=resolveSector(structuredClone(r),'balanced'),defense=resolveSector(r,'defend');
 assert.ok(Math.abs(defense.history[0].aiTime-clean.history[0].aiTime-.35)<1e-8);assert.equal(defense.history[0].impact.rivalDelay,.35);
 assert.ok(defense.player.time>defense.opponent.time);assert.match(defense.history[0].reasons.join(' '),/Защита сработала/);
 assert.match(sectorDetailsHTML(defense.history[0]),/не запрет обгона/);
 assert.ok(Math.abs(Object.values(defense.history[0].impact.breakdown).reduce((a,b)=>a+b,0)+defense.history[0].impact.playerDelay-defense.history[0].playerTime)<1e-8);
});
test('high focus retains repeated attack tempo and the forecast explains its focus cost',()=>{
 const card=CARDS.find(c=>c.id==='attack'),state={...freshState(config),focus:80,recentActions:['attack','power','attack','power'],strain:3},sector=sectorAt(1,'dry','haruna');
 const p=simulate(config,state,sector,card);const f=qualitativeForecast(config,state,sector,card,p);
 assert.equal(p.breakdown.repetition,0);assert.equal(p.breakdown.strain,0);assert.ok(p.time<simulate(config,state,sector,CARDS[0]).time);assert.match(f.habit,/только расход/);assert.match(f.warning,/нагрузка на фокус/);
});
test('sector feedback shows actual times and escapes imported text without inventing a rival in solo runs',()=>{
 const row={sector:'<img>',card:'<script>',playerTime:15,aiTime:null,reasons:['<unsafe>'],lineId:'late-apex',aiLineId:'neutral',aiCard:'—',focus:70,impact:{focusBefore:80,gapChange:null,breakdown:{base:15,tactic:0,grip:0,repetition:0,strain:0,execution:0},playerDelay:0,rivalDelay:0}};
 assert.equal(sectorFeedbackHTML(null),'');assert.match(sectorFeedbackHTML(row),/Поздний апекс/);assert.ok(!sectorDetailsHTML(row).includes('<unsafe>'));assert.ok(!sectorDetailsHTML(row).includes('<img>'));assert.match(sectorDetailsHTML(row),/80 → 70/);
});

test('learning duel is approachable with classic lines while equal rivals still optimize lines',()=>{
 let wins=0;
 for(let seed=1;seed<=24;seed++){
  let r=createRace(config,'dry','haruna','learning-'+seed,seed,'easy');
  while(!r.finished){r=resolveSector(r,'balanced');assert.equal(r.history.at(-1).aiLineId,'neutral');assert.ok(r.opponent.focus>=0&&r.opponent.focus<=r.rival.pilot.focus);}
  wins+=r.player.time<r.opponent.time;
 }
 assert.ok(wins>=20,'simple clean driving should be viable against a learning rival');
 let r=createRace(config,'dry','haruna','equal',42,'equal');while(!r.finished)r=resolveSector(r,'balanced');assert.ok(r.history.some(row=>row.aiLineId!=='neutral'));
});
test('old easy-duel records remain archived separately, new profile and other modes roundtrip',async()=>{
 const {newCareer,validateSave}=await import('../src/storage.js');const {raceRecord,recordKey,bestFor}=await import('../src/progress.js');
 let r=createRace(config,'dry','haruna','save-learning',42,'easy');while(!r.finished)r=resolveSector(r,'balanced');
 const record=raceRecord(r),old={...structuredClone(record),key:record.key.replace(';opponent=learning-1','')},c=newCareer();const older={...structuredClone(old),key:old.key.replace(/^8\|/,'6|')};c.bests=[older,old,record];
 const loaded=validateSave(c);assert.equal(loaded.bests.length,3);assert.ok(loaded.bests.some(b=>b.key===older.key));assert.ok(loaded.bests.some(b=>b.key===old.key));assert.equal(bestFor(loaded,r.config,r.eventId,r.weather).key,record.key);
 assert.ok(!recordKey({...config,rivalLevel:'equal'},'haruna','dry').includes('learning'));assert.ok(!recordKey({...config,rivalLevel:'easy'},'yokohama','dry').includes('learning'));
});

test('paired conditions isolate choice impact and show the next-entry tradeoff',()=>{
 const r=createRace(config,'dry','haruna','agency',42,'equal');r.index=1;r.player.velocity=25;r.player.time=10;r.opponent.time=10;
 const clean=resolveSector(structuredClone(r),'balanced','neutral'),attack=resolveSector(structuredClone(r),'attack','neutral'),late=resolveSector(structuredClone(r),'balanced','late-apex');
 assert.ok(Math.abs(clean.history[0].impact.decisionGain)<1e-8);assert.ok(attack.history[0].impact.decisionGain>0);
 assert.ok(late.history[0].impact.decisionGain<0);assert.ok(late.history[0].impact.nextSpeedGain>0);
 assert.ok(Math.abs(attack.history[0].impact.decisionGain-(clean.history[0].playerTime-attack.history[0].playerTime))<1e-8);
 assert.match(sectorDetailsHTML(late.history[0]),/одинаковые машина/);assert.match(sectorFeedbackHTML(late.history[0]),/следующий вход/);
});

test('decisions change matched-seed outcomes against an equal rival without relying on rerolls',async()=>{
 const {chooseAI,chooseRacingLine,futureSectors}=await import('../src/engine.js');let baselineWins=0,plannedWins=0,timeGain=0;
 for(let seed=1;seed<=12;seed++){
  let baseline=createRace(config,'dry','haruna','matched-'+seed,seed,'equal'),planned=structuredClone(baseline);
  while(!baseline.finished)baseline=resolveSector(baseline,'balanced');
  while(!planned.finished){const s=sectorAt(planned.index,planned.weather,planned.eventId),up=futureSectors(planned),card=chooseAI(config,planned.player,s,planned.player.time-planned.opponent.time,up).card,line=chooseRacingLine(config,planned.player,s,card,up[0]).card.lineId;planned=resolveSector(planned,card.id,line);}
  baselineWins+=baseline.player.time<baseline.opponent.time;plannedWins+=planned.player.time<planned.opponent.time;timeGain+=baseline.player.time-planned.player.time;
 }
 assert.equal(baselineWins,0);assert.ok(plannedWins>=5);assert.ok(timeGain/12>3);
});
