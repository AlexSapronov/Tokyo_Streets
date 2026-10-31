import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIAL_CUPS,buildValue} from '../src/special-cups.js';
import {CUPS,getCup,regulationReason,enterCup,prepareStage,bookCupRace,cupUnlockReason} from '../src/championship.js';
import {configuration,chooseAI,resolveSector,futureSectors} from '../src/engine.js';
import {newCareer,validateSave} from '../src/storage.js';
import {awardRace} from '../src/progress.js';
import {sectorAt} from '../src/data.js';
import {freshWear} from '../src/wear.js';
import {MAIN_MILESTONES} from '../src/journey.js';
const rich=car=>({...newCareer(),money:1000000,races:20,street:100,car,ownedCars:[car]});
test('special series leave five-step main progression intact and all NPC builds meet their regulation',()=>{
 assert.equal(CUPS.length,5);assert.equal(SPECIAL_CUPS.length,5);
 for(const cup of SPECIAL_CUPS){assert.equal(getCup(cup.id),cup);for(const [,,car,pilot,,parts,engine] of cup.roster)assert.equal(regulationReason(configuration(car,pilot,parts,100,{},engine),cup),'',cup.id+' / '+car);}
 const c=rich('ae86');c.championships.completed=SPECIAL_CUPS.map(c=>c.id);assert.ok(MAIN_MILESTONES.every(m=>m.value(c)===0));
 assert.match(cupUnlockReason(newCareer(),SPECIAL_CUPS[0]),/финиша/);const early=rich('ae86');early.races=3;early.street=0;assert.match(cupUnlockReason(early,SPECIAL_CUPS[1]),/трассу/);
});
test('limits use installed mass, factory motor, catalog budget and healthy power, so wear never buys entry',()=>{
 const [na,light,ff,factory,budget]=SPECIAL_CUPS;
 assert.match(regulationReason(configuration('chaser','ren'),na),/Лимит|атмосфер/);
 assert.match(regulationReason(configuration('evo','ren'),light),/массы|Лимит/);
 assert.match(regulationReason(configuration('ae86','ren'),ff),/FF/);
 assert.match(regulationReason(configuration('ae86','ren',[],100,{},'1uz'),factory),/заводская/);
 assert.equal(regulationReason(configuration('ae86','ren',['tires','brakes']),budget),'');
 assert.match(regulationReason(configuration('ae86','ren',['tires','brakes','suspension']),budget),/стоимости/);
 const worn={...freshWear(),engine:15};assert.match(regulationReason(configuration('ek9','ren',['ecu','cams'],100,{},null,worn),na),/исправной/);
 assert.equal(buildValue(configuration('ae86','ren',[],100)),18000);assert.ok(buildValue(configuration('ae86','ren',[],100,{},'1uz'))>60000);
});
for(const [id,car] of [['special-na','ae86'],['special-light','mx5'],['special-ff','ek9'],['special-factory','s13'],['special-budget','ae86']])test('special season completes and survives reload / '+id,()=>{
 let c=enterCup(rich(car),id,'attempt-'+id);const cup=getCup(id);
 for(let i=0;i<cup.stages.length;i++){
  c=prepareStage(c);c.condition[car]=100;c.wear[car]=freshWear();
  const start=bookCupRace(c,id+'-'+i);let race=start.race;
  while(!race.finished){const action=chooseAI(race.config,race.player,sectorAt(race.index,race.weather,race.eventId),race.player.time-race.opponent.time,futureSectors(race));race=resolveSector(race,action.card.id);}
  const result=awardRace(start.career,race);c=validateSave(result.career);
  if(i===0){assert.equal(c.championships.active.cupId,id);assert.equal(c.championships.active.stage,1);}else{assert.equal(c.championships.active,null);assert.equal(c.championships.history[0].cupId,id);}
 }
});
test('special regulation is rechecked at stage start and rejection leaves career unchanged',()=>{
 const c=enterCup(rich('ae86'),'special-light','mass-test');c.engines.installed.ae86.engineId='6bt';const before=structuredClone(c);
 assert.throws(()=>bookCupRace(c,'too-heavy'),/массы/);assert.deepEqual(c,before);
});
