import test from 'node:test';import assert from 'node:assert/strict';
import {newCareer} from '../src/storage.js';import {configuration,createRace,simulate,availableCards,resolveSector} from '../src/engine.js';import {sectorAt,CARDS,PARTS} from '../src/data.js';
import {thermalStatus,roadHeatEffects} from '../src/thermal-status.js';import {cardComparison,cardMetricsHTML} from '../src/race-ui.js';import {comparePart,partComparisonHTML} from '../src/part-comparison.js';import {finishOverviewHTML} from '../src/finish-view.js';import {serviceCost,togglePart} from '../src/garage.js';import {unlockEverything} from '../src/balance.js';import {createLesson,resolveLesson} from '../src/driving-school.js';import {schoolCoachHTML} from '../src/driving-school-view.js';import {mainSectorReason} from '../src/sector-feedback.js';
const cfg=configuration('ae86','ren');
test('instruments warn at actual road fade thresholds and describe mode-specific consequences',()=>{
 const base={brakes:105,oil:125,coolant:105,tireTemp:120,tires:100};assert.equal(thermalStatus(base).messages.length,0);assert.equal(thermalStatus(base).lamps.tireTemp,false);
 const hot={...base,brakes:118,oil:132,coolant:106},status=thermalStatus(hot);assert.ok(status.lamps.brakes&&status.lamps.oil&&status.lamps.coolant);assert.match(status.messages.join(' '),/тормозного потенциала/);const effects=roadHeatEffects(hot);assert.ok(effects.brakes<1&&effects.power<1);
 const state={...createRace(cfg).player,heat:118,telemetry:{oil:132,coolant:106}},sector=sectorAt(1,'dry'),result=simulate(cfg,state,sector,CARDS[0]);assert.ok(result.reasons.some(s=>s.includes(Math.round(effects.brakes*100)+'%')));
 const drift=thermalStatus({...base,oil:116,tireTemp:96},'drift');assert.match(drift.messages.join(' '),/риск срыва/);assert.match(drift.messages.join(' '),/95°C/);assert.ok(!drift.lamps.brakes);assert.match(thermalStatus({...base,oil:106},'drag').messages.join(' '),/мощность/);
});
test('card comparison shows real repetition cost before selection without modifying race resources',()=>{
 const r=createRace(cfg),card=CARDS.find(c=>c.id==='attack'),sector=sectorAt(1,'dry'),state={...r.player,recentActions:['attack','breathe','attack'],strain:3},snapshot=structuredClone(state),m=cardComparison(cfg,state,sector,card);assert.equal(m.repeat.repeats,2);assert.ok(m.extra>0);assert.match(cardMetricsHTML(m),/Повтор ×3/);assert.match(cardMetricsHTML(m),/ещё −/);assert.deepEqual(state,snapshot);
 const breathe=CARDS.find(c=>c.id==='breathe'),recovery=cardComparison(cfg,{...state,recentActions:['breathe']},sector,breathe);assert.match(cardMetricsHTML(recovery),/восстановление слабее/);
 for(const id of ['yokohama','yokohama-mile','ebisu']){const race=createRace(cfg,'dry',id),s=sectorAt(0,'dry',id);for(const card of availableCards(cfg,race.mode,id))assert.doesNotThrow(()=>cardComparison(cfg,race.player,s,card));}
});
test('parts comparison predicts the same replacement, price and state as installation and never spends during inspection',()=>{
 let c=unlockEverything(newCareer());c.builds.ae86=['streetTires'];c.purchased.ae86=c.purchased.ae86.filter(id=>id!=='slicks');c.wear.ae86.slicks=20;const snapshot=structuredClone(c),q=comparePart(c,'slicks'),after=togglePart(c,'slicks');assert.deepEqual(q.after,after.builds.ae86);assert.deepEqual(q.removed,['streetTires']);assert.equal(q.cost,c.money-after.money);assert.ok(q.rows.some(r=>r[0]==='Мокрое сцепление'&&r[2]<r[1]));assert.ok(partComparisonHTML(c,'slicks').includes(PARTS.find(p=>p.id==='streetTires').name));assert.deepEqual(c,snapshot);
 for(const p of PARTS)assert.doesNotThrow(()=>partComparisonHTML(c,p.id));const installed=comparePart(after,'slicks');assert.equal(installed.cost,0);assert.ok(!installed.after.includes('slicks'));
});
test('finish overview separates credited money and an unpaid service quote and supplies a concrete next step',()=>{
 const c=newCareer();c.condition.ae86=50;c.money=100;const r={config:cfg,player:{focus:20},outcome:{reward:5000},debtPaid:1000},snapshot=structuredClone(c),html=finishOverviewHTML(c,r);assert.ok(html.includes('4 000')||html.includes('4 000'));assert.match(html,/До сервиса не хватает/);assert.match(html,/Сервис ещё не оплачен/);assert.match(html,/data-next="recovery"/);assert.ok(serviceCost(c)>c.money);assert.deepEqual(c,snapshot);
 assert.match(finishOverviewHTML(c,{...r,journeyReport:{bonus:1000,debtPaid:500},challengeReport:{reward:2000,debtPaid:0}}),/6[  ]500/);
 c.money=100000;assert.match(finishOverviewHTML(c,r),/data-next="maintenance"/);c.condition.ae86=100;assert.match(finishOverviewHTML(c,r),/data-next="retry"/);c.championships.active={};assert.match(finishOverviewHTML(c,{...r,season:{}}),/data-next="season"/);
});
test('school task checks update from the same actions that qualify the lesson',()=>{
 const c=newCareer();let r=createLesson(c,0);assert.match(schoolCoachHTML(r),/◯ Попробовать атаку/);r=resolveLesson(r,'balanced');r=resolveLesson(r,'attack');assert.match(schoolCoachHTML(r),/✓ Попробовать атаку/);assert.match(schoolCoachHTML(r),/◯ Восстановить фокус/);r=resolveLesson(r,'balanced');r=resolveLesson(r,'breathe');assert.match(schoolCoachHTML(r),/✓ Восстановить фокус/);
 c.school.step=3;const exam=schoolCoachHTML(createLesson(c,3));assert.match(exam,/проверка на финише/);assert.ok(!exam.includes('✓'));
});
test('the last sector identifies the biggest recorded penalty rather than guessing a cause',()=>{
 const r=mainSectorReason({impact:{breakdown:{repetition:.8,strain:.3,grip:.2,execution:.1,tactic:-.4}},reasons:[]});assert.match(r,/Повтор приёма \+0.80 с/);assert.match(mainSectorReason({reasons:['Разворот: ошибка']}),/Разворот/);
});
