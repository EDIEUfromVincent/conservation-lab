import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const gate=join(process.env.FRAME_GATE_DIR??join(homedir(),'.codex/skills/inquiry-science-webapp/scripts/4d'),'gate.mjs');
mkdirSync('output',{recursive:true});
const result=spawnSync(process.execPath,[gate,'frame-lab','--json','output/frame-gate.json'],{env:{...process.env,PLAYWRIGHT_CORE:process.env.PLAYWRIGHT_CORE??resolve('node_modules/playwright-core/index.mjs')},encoding:'utf8'});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
writeFileSync('docs/FRAME_GATE_REPORT.txt',(result.stdout??'')+(result.stderr??''));process.exit(result.status??1);
