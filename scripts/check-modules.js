// Link the browser's complete module graph without running DOM or Canvas code.
// Syntax checks alone do not catch imports of renamed or removed exports.
import {SourceTextModule} from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../src/',import.meta.url);
const names=readdirSync(root).filter(name=>name.endsWith('.js')).sort();
const modules=new Map(names.map(name=>{
 const url=new URL(name,root);
 return [url.href,new SourceTextModule(readFileSync(url,'utf8'),{identifier:url.href})];
}));
const entry=new SourceTextModule(names.map(name=>`import ${JSON.stringify(new URL(name,root).href)};`).join('\n'),{identifier:new URL('module-check.js',root).href});
await entry.link((specifier,parent)=>{
 const url=new URL(specifier,parent.identifier),module=modules.get(url.href);
 if(!module)throw new Error('Unmapped module '+specifier+' imported by '+fileURLToPath(parent.identifier));
 return module;
});
console.log(`Linked ${modules.size} modules: all imports and exports match`);
