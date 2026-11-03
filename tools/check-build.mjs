import { readdirSync, statSync, readFileSync } from 'node:fs';
const files=readdirSync('dist');
if(files.length!==1||files[0]!=='index.html') throw Error('Expected single dist/index.html');
const size=statSync('dist/index.html').size;
if(size>5*1024*1024) throw Error('Build exceeds 5 MB');
if(!readFileSync('dist/index.html','utf8').includes("connect-src 'none'")) throw Error('Missing offline CSP');
console.log(`Single HTML: ${size.toLocaleString()} bytes`);
