import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const html=readFileSync(resolve(root,'index.html'),'utf8');
const version=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version;
const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const tag=new URL(imports['./src/app.js'],'http://localhost').searchParams.get('v');
function resolveModule(specifier,base,baseDocument){
 const url=new URL(specifier,base).href;
 for(const [key,value] of Object.entries(imports))if(new URL(key,baseDocument).href===url)return new URL(value,baseDocument).href;
 return url;
}
for(const path of ['/','/Tokyo_Streets/'])test(`browser import map pins every transitive module despite stale cache / ${path}`,()=>{
 const baseDocument='http://localhost:5173'+path;
 assert.ok(tag.startsWith(version+'-'));
 assert.ok(html.includes(`style.css?v=${tag}`));
 const files=readdirSync(resolve(root,'src')).filter(f=>f.endsWith('.js'));
 const cachedGarage=new URL('src/garage.js',baseDocument).href;
 const visited=new Set(),queue=[new URL(`src/app.js?v=${tag}`,baseDocument).href];
 while(queue.length){
  const url=queue.shift();if(visited.has(url))continue;visited.add(url);
  assert.equal(new URL(url).searchParams.get('v'),tag);
  const name=new URL(url).pathname.split('/').at(-1),source=readFileSync(resolve(root,'src',name),'utf8');
  for(const [,specifier] of source.matchAll(/from\s*['"]([^'"]+)['"]/g))queue.push(resolveModule(specifier,url,baseDocument));
 }
 assert.ok(visited.size>=20);assert.ok(!visited.has(cachedGarage));
 assert.ok([...visited].some(url=>url===cachedGarage+`?v=${tag}`));
 for(const file of files)assert.equal(imports[`./src/${file}`],`./src/${file}?v=${tag}`);
});
test('failed import displays a readable startup error without clearing the career',async()=>{
 const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 assert.ok(source.includes(`import('./src/app.js?v=${tag}')`));
 const fields={'#startup-error':{},'#startup-retry':{}},app={innerHTML:'',querySelector:key=>fields[key]};
 let saved='existing-career',reloaded=false;
 const document={querySelector:()=>app},location={reload:()=>{reloaded=true;}},console={error(){}};
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const code=source.replace(/import\('[^']+'\)/,"Promise.reject(new Error('Missing module recoveryService'))");
 await new AsyncFunction('document','location','console','localStorage',code)(document,location,console,{clear(){saved='';},removeItem(){saved='';}});
 await Promise.resolve();assert.ok(app.innerHTML.includes('role="alert"'));assert.equal(fields['#startup-error'].textContent,'Missing module recoveryService');assert.equal(saved,'existing-career');
 fields['#startup-retry'].onclick();assert.equal(reloaded,true);
});
