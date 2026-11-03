import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../data/scenario.schema.json';
import {scenario,manuals,labs} from '../src/content/loadContent';
import {validateContent, validateMissions} from '../src/content/rules';
import {missions} from '../src/mission/engine';
import {L} from '../src/ui/labels';
import {expeditionContent,sourceEvidence} from "../src/expedition/evidence";
const ajv=new Ajv2020({allErrors:true,strict:false});
const valid=ajv.validate(schema,scenario);
const result=validateContent(scenario,manuals,labs);
if(expeditionContent.stations.length!==5||new Set(expeditionContent.stations.map(s=>s.caseId)).size!==5)result.errors.push('[EXPEDITION] stations');
for(const s of expeditionContent.stations)for(const tool of ['photo','lens']){try{if(!sourceEvidence(s.caseId,tool))result.errors.push('[EXPEDITION] sourceRef '+s.caseId);}catch{result.errors.push('[EXPEDITION] sourceRef '+s.caseId);}}
result.errors.push(...validateMissions(missions,scenario,manuals));
if(!valid)result.errors.push(ajv.errorsText());
if(/문화재|정답|오답|틀렸/.test(JSON.stringify(L)))result.errors.push('[LABEL] prohibited words');
console.log(`오류 ${result.errors.length}건, 경고 ${result.warnings.length}건`);
result.errors.forEach(x=>console.error(x));result.warnings.forEach(x=>console.warn(x));
process.exitCode=result.errors.length?1:0;
