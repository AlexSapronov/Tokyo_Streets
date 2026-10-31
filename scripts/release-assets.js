// One version for the complete ES module graph; Python's server needs no changes.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version;
const files=readdirSync(resolve(root,'src')).filter(name=>name.endsWith('.js')).sort();
const hash=createHash('sha256');
for(const name of files)hash.update(name).update(readFileSync(resolve(root,'src',name)));
hash.update(readFileSync(resolve(root,'style.css')));
const tag=version+'-'+hash.digest('hex').slice(0,12);
const imports=Object.fromEntries(files.map(name=>[`./src/${name}`,`./src/${name}?v=${tag}`]));
const block=`<!-- release-assets:start -->\n<script type="importmap">\n${JSON.stringify({imports},null,2)}\n</script>\n<script type="module">\nimport('./src/app.js?v=${tag}').catch(error => {\n  console.error('Tokyo Streets startup failed:', error);\n  const app=document.querySelector('#app');\n  app.innerHTML='<section class="panel" role="alert"><h1>Не удалось запустить игру</h1><p>Обновите файлы игры через git pull и перезагрузите страницу. Сохранение не удалено.</p><p>Если ошибка повторится, скопируйте текст ниже:</p><pre id="startup-error"></pre><button id="startup-retry" class="primary">Перезагрузить страницу</button></section>';\n  app.querySelector('#startup-error').textContent=String(error.message||error);\n  app.querySelector('#startup-retry').onclick=()=>location.reload();\n});\n</script>\n<!-- release-assets:end -->`;
const file=resolve(root,'index.html'),html=readFileSync(file,'utf8');
const pattern=/<!-- release-assets:start -->[\s\S]*?<!-- release-assets:end -->/;
let next=pattern.test(html)?html.replace(pattern,block):html.replace('<script type="module" src="src/app.js"></script>',block);
next=next.replace(/href="style\.css(?:\?v=[^"]*)?"/,`href="style.css?v=${tag}"`);
if(!next.includes(block))throw Error('Release entry marker is missing');
if(process.argv.includes('--check')){
 if(html!==next)throw Error('Module versions are stale: run npm run release:assets');
 console.log(`All ${files.length} modules pinned to ${tag}`);
}else{writeFileSync(file,next);console.log(`Pinned ${files.length} modules to ${tag}`);}
