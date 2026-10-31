import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRace,raceSummaryHTML} from '../src/race-summary.js';

const event={sectors:[{type:'straight'},{type:'corner'},{type:'corner'},{type:'corner'}],medals:{gold:600,silver:500,bronze:400}};
const row=(index,playerTime,aiTime,reasons=[],other={})=>({index,sector:['Старт','Первый правый','Шпилька','Связка'][index],playerTime,aiTime,reasons,...other});
const duel=(overrides={})=>({
 mode:'duel',history:[
  row(0,9,10),
  row(1,11,9,['Перегрев: эффективность тормозов 90%']),
  row(2,16,13,['Повтор приёма 2: нагрузка растёт экспоненциально, потеря 0.28 с']),
  row(3,12,10,['Перегрев: эффективность тормозов 80%','Предел сцепления превышен: +0.20 с'],{slip:.2})
 ],player:{time:48},opponent:{time:42},...overrides
});
test('losing duel highlights real sector deficits and brake fade',()=>{
 const summary=summarizeRace(duel(),{won:false},event);
 assert.match(summary.title,/Соперник/);
 assert.match(summary.lead,/6\.00 с/);
 assert.match(summary.facts[0],/поворотах.*7\.00 с/);
 assert.ok(summary.facts.some(f=>f.includes('Шпилька')&&f.includes('3.00')));
 assert.ok(summary.facts.some(f=>f.includes('80%')));
 assert.ok(summary.facts.length<=3);
});
test('winning duel uses the race result and highlights the decisive gain',()=>{
 const race=duel({player:{time:40},opponent:{time:42},history:[
  row(0,8,10),row(1,9,10),row(2,12,13),row(3,11,9)
 ]});
 const result=summarizeRace(race,{won:true},event);
 assert.match(result.title,/Победа/);
 assert.match(result.lead,/2\.00 с/);
 assert.ok(result.facts.some(f=>f.includes('Старт')));
});
test('DNF and false starts are not described as a normal time loss',()=>{
 const dnf=summarizeRace(duel({player:{time:23,dnf:{damage:20}},history:[row(0,10,9),row(1,13,9)]}),{won:false},event);
 assert.match(dnf.title,/Сход/);assert.match(dnf.lead,/Первый правый/);
 const falseStart=summarizeRace({mode:'drag',history:[],player:{time:10,drag:{falseStart:true}},opponent:{time:11}}, {won:false},event);
 assert.match(falseStart.title,/Фальстарт/);
 assert.doesNotMatch(falseStart.lead,/позже/);
 const rivalDnf=summarizeRace(duel({opponent:{time:40,dnf:{reason:'off track'}}}),{won:true},event);
 assert.match(rivalDnf.title,/Победа/);assert.match(rivalDnf.lead,/сошёл/);
});
test('time attack explains a medal margin or a missed target',()=>{
 const base={mode:'timeattack',player:{time:95},history:[],targets:{gold:90,silver:100,bronze:110}};
 const silver=summarizeRace(base,{medal:'silver'},event);
 assert.match(silver.title,/Серебро/);assert.match(silver.lead,/5\.00 с/);
 const miss=summarizeRace({...base,player:{time:112}},{medal:null},event);
 assert.match(miss.lead,/2\.00 с/);
});
test('drift summary uses clips, broken chains and the scoring threshold',()=>{
 const race={mode:'drift',player:{time:70,drift:{score:285,spins:1,breaks:2}},
 history:[{sector:'Клип 1',index:0,drift:{points:20}},{sector:'Клип 2',index:1,drift:{points:70}}]};
 const result=summarizeRace(race,{medal:null},event);
 assert.match(result.lead,/115\.0 балла/);
 assert.ok(result.facts.some(f=>f.includes('Разворотов: 1')));
 assert.ok(result.facts.some(f=>f.includes('Клип 2')));
});
test('drag launch reaction and wheelspin are based on actual telemetry',()=>{
 const race={mode:'drag',player:{time:11,drag:{reaction:.123}},opponent:{time:12},
 history:[row(0,0,0),row(1,2,2.3,['Пробуксовка 17%: часть момента потеряна'])]};
 const result=summarizeRace(race,{won:true},event);
 assert.ok(result.facts.some(f=>f.includes('0.123 с')));
 assert.ok(result.facts.some(f=>f.includes('Пробуксовка')));
});
test('English recap and HTML escaping are supported',()=>{
 const summary=summarizeRace(duel(),{won:false},event,'en');
 assert.match(summary.title,/rival/);
 assert.match(summary.facts[0],/Corners cost you/);
 const html=raceSummaryHTML({title:'<img src=x>',lead:'<&"',facts:['<script>alert(1)</script>']});
 assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('<img src=x>'));
 assert.match(html,/&lt;script&gt;/);
});
test('missing opponent splits do not create fictional gaps',()=>{
 const race={mode:'duel',history:[row(0,12,null)],player:{time:12},opponent:{}};
 const result=summarizeRace(race,{won:false},event);
 assert.equal(result.facts.length,0);
 assert.ok(result.lead.length>0);
});
