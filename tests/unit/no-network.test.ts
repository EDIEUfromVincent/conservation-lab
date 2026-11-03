import {it,expect} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
it('has no runtime network clients or remote asset tags',()=>{for(const file of files('src')){const source=readFileSync(file,'utf8');expect(source,file).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|(?:src|href)\s*=\s*["']https?:/);}});
it('theme text contrasts exceed 4.5:1 on paper',()=>{const luminance=(hex:string)=>{const rgb=hex.match(/\w\w/g)!.map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};for(const color of ['2b2a27','625e55','236247','80500d','a13232','326c62','365f7d','98513e','72577b'])expect((luminance('f6f1e7')+.05)/(luminance(color)+.05),color).toBeGreaterThan(4.5);});
