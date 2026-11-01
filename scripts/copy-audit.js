// Review source-language copy without executing the game. Acorn is dev-only.
import {parse} from 'acorn';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../src/',import.meta.url));
export function copyInventory(){
 const result=[];
 // race-summary.js already selects complete RU/EN sentences by language; its
 // Russian plural suffixes are not standalone interface messages.
 for(const file of readdirSync(root).filter(f=>f.endsWith('.js')&&!['i18n.js','locale-en.js','locale-patterns.js','race-summary.js'].includes(f))){
  const ast=parse(readFileSync(root+file,'utf8'),{ecmaVersion:'latest',sourceType:'module',locations:true});
  const walk=node=>{if(!node||typeof node!=='object')return;
   const value=node.type==='Literal'&&typeof node.value==='string'?node.value:node.type==='TemplateElement'?node.value.cooked:null;
   if(value&&/[А-Яа-яЁё]/.test(value)){
    // Templates can begin/end inside tags. Only audit text and accessible labels.
    const attrs=[...value.matchAll(/(?:aria-label|title|placeholder)="([^"]*)/g)].map(m=>m[1]);
    for(const part of [...value.split(/<[^>]*>|[<>]/),...attrs]){const text=part.trim();if(/[А-Яа-яЁё]/.test(text)&&!/[=]["']|(?:class|id|data-[\w-]+)=/.test(text))result.push({file,line:node.loc.start.line,text});}
   }
   for(const [key,value]of Object.entries(node))if(key!=='loc'){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  };walk(ast);
 }
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(copyInventory(),null,2));
