import {labs} from '../content/loadContent';
import {L} from '../ui/labels';
import {M} from './labels';
export function metricSummary(id:string,m:Record<string,string|number>):string[]{
 if('fallback' in m)return [L.fallback+': '+m.fallback];
 if(id==='lab1')return [M.duration+': '+m.days+L.days,...labs.lab1.conditions.filter(c=>'rust_'+c.id in m).map(c=>`${c.label}: ${m['rust_'+c.id]} / 100 · ${M.rust}`)];
 if(id==='lab2')return [`1${L.round}: ${M.fitted} ${m.r1_correct}${L.piece} · ${m.r1_seconds}${L.seconds}`,`2${L.round}: ${M.fitted} ${m.r2_correct}${L.piece} · ${m.r2_seconds}${L.seconds}`,`${L.discard}: ${m.chips_discarded}${L.piece}`,`${L.storeChip}: ${m.chips_stored}${L.piece}`];
 if(id==='lab3'){try{const rows:unknown=JSON.parse(String(m.trials));if(!Array.isArray(rows))return [];return rows.map(r=>`${labs.lab3.adhesives.find(a=>a.id===r.adhesive)?.label??L.unknown} · ${labs.lab3.tools.find(t=>t.id===r.tool)?.label??L.unknown} · ${L.warm}: ${r.warm===true||r.warm==='true'?L.yes:L.no} · ${L.removed}: ${r.removed===true||r.removed==='true'?L.yes:L.no} · ${L.scratches} ${r.scratches}${M.count} · ${L.residue}: ${r.residue} · ${M.modelDuration} ${r.days}${L.days}`);}catch{return [];}}
 if(id==='lab4')return labs.lab4.samples.filter(s=>s.id in m).map(s=>`${s.label}: ${M.peeled} ${m[s.id]} / 25${M.cells}`);
 if('reinforcement'in m)return [L.reinforce+': '+(labs.lab5.partA.reinforcements.find(r=>r.id===m.reinforcement)?.label??L.unknown),`${L.remove}: ${m.removeSteps}${L.round}`,`${L.damage}: ${m.damagedBlocks}${M.blocks}`];
 return [`${L.proof}: ${m.floorsWithEvidence}${L.floor}`,`${L.imagined}: ${m.floorsImagined}${L.floor}`];
}
