import { readdirSync,readFileSync } from 'node:fs';
// 학생 화면 문구는 data/*.json, UI 라벨은 src/ui/labels.ts에만 둔다. 주석은 검사하지 않는다.
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(dir+'/'+x.name):[dir+'/'+x.name]);}
const stripComments=text=>text.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,'')).replace(/(^|[^:'"`])\/\/.*$/gm,'$1');
const errors=[];
for(const file of files('src').filter(f=>/\.ts$/.test(f)&&!f.endsWith('/labels.ts')&&!f.endsWith('/rules.ts'))){const lines=stripComments(readFileSync(file,'utf8')).split('\n');lines.forEach((line,i)=>{if(/[가-힣]/.test(line))errors.push(`${file}:${i+1}`);});}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Student copy: JSON; UI labels: labels.ts; PASS');
