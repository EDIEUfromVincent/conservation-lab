import data from '../../data/expedition.json' with {type:'json'};
import {scenario,manuals} from '../content/loadContent';
export {data as expeditionContent};
export function sourceEvidence(caseId:string,tool:string){const c=scenario.cases.find(c=>c.id===caseId)!;if(tool==='manual')return manuals.manuals.find(v=>v.id===c.lead)!.keyIdeas[0];const station=data.stations.find(s=>s.caseId===caseId)!;const ref=station[tool==='photo'?'photo':'lens'];const index=Number(ref.match(/\[(\d+)\]/)![1]);return c.brief.lines[index];}
