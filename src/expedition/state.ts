import {scenario} from '../content/loadContent';
import type {Decision} from '../content/types';
export const EXPEDITION_KEY='cons-lab:expedition';
export interface Investigation {phase:'inspect'|'predict'|'lab'|'decide'|'exhibit';evidence:{tool:string;spot:number;text:string}[];prediction:string;work:Record<string,unknown>;metrics:Record<string,Record<string,string|number>>;decisions:{node:string;choice:string;reason:string}[];reflection:string;complete:boolean;pending:boolean}
export interface Expedition {version:1;team:number;color:number;position:{x:number;z:number};missions:Record<string,Investigation>}
export const newExpedition=():Expedition=>({version:1,team:1,color:0,position:{x:0,z:7},missions:{}});
export const newInvestigation=():Investigation=>({phase:'inspect',evidence:[],prediction:'',work:{},metrics:{},decisions:[],reflection:'',complete:false,pending:false});
export const decisionsFor=(id:string)=>scenario.cases.find(c=>c.id===id)!.nodes.filter((n):n is Decision=>n.type==='decision');
export function expeditionCSV(s:Expedition){const cell=(v:unknown)=>{const text=String(v);return '"'+(/^[=+\-@\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};const rows=Object.entries(s.missions).flatMap(([id,m])=>m.decisions.map(d=>{const node=decisionsFor(id).find(n=>n.id===d.node)!,outcome=scenario.cases.find(c=>c.id===id)!.nodes.find(n=>n.id===node.choices.find(ch=>ch.key===d.choice)!.outcome);return [id,m.evidence.length,d.node,d.choice,outcome?.type==='outcome'?outcome.result:'',d.reason,m.reflection];}));return '\uFEFFstation,evidence_count,node_id,choice,result,reason,reflection\r\n'+rows.map(row=>row.map(cell).join(',')).join('\r\n');}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length<=4000;
const safe=(v:unknown,depth=0):boolean=>depth<15&&(v===null||typeof v==='boolean'||text(v)||typeof v==='number'&&Number.isFinite(v)||Array.isArray(v)&&v.length<2000&&v.every(x=>safe(x,depth+1))||object(v)&&Object.keys(v).length<2000&&Object.entries(v).every(([k,x])=>!['__proto__','prototype','constructor'].includes(k)&&safe(x,depth+1)));
export function validExpedition(v:unknown):v is Expedition{
 if(!object(v)||Object.keys(v).some(k=>!['version','team','color','position','missions'].includes(k)))return false;
 if(!object(v)||!safe(v)||v.version!==1||![1,2,3,4].includes(v.team as number)||![0,1,2].includes(v.color as number)||!object(v.position)||!['x','z'].every(k=>typeof v.position==='object'&&Math.abs((v.position as Record<string,number>)[k])<=13)||!object(v.missions))return false;
 return Object.entries(v.missions).every(([id,m])=>{if(!scenario.cases.some(c=>c.id===id)||!object(m)||!['inspect','predict','lab','decide','exhibit'].includes(m.phase as string)||!Array.isArray(m.evidence)||m.evidence.length>9||!m.evidence.every(e=>object(e)&&['photo','lens','manual'].includes(e.tool as string)&&[0,1,2].includes(e.spot as number)&&text(e.text))||!text(m.prediction)||!text(m.reflection)||typeof m.complete!=='boolean'||!object(m.work)||!object(m.metrics)||!Array.isArray(m.decisions))return false;
 if(Object.keys(m).some(k=>!['phase','evidence','prediction','work','metrics','decisions','reflection','complete','pending'].includes(k))||typeof m.pending!=='boolean'||m.pending&&(!m.decisions.length||m.phase!=='decide'))return false;
 if(m.phase!=='inspect'&&new Set(m.evidence.map(e=>(e as {tool:string}).tool)).size<2)return false;
 if(['decide','exhibit'].includes(m.phase as string)&&!(id==='case5'?['A','B']:['main']).every(k=>object((m.metrics as Record<string,unknown>)[k])))return false;
 const ds=decisionsFor(id);if(m.decisions.length>ds.length||!m.decisions.every((d,i)=>object(d)&&d.node===ds[i].id&&ds[i].choices.some(c=>c.key===d.choice)&&text(d.reason)&&d.reason.trim().length>0))return false;
 return (!m.complete||m.phase==='exhibit'&&m.decisions.length===ds.length)&&(['inspect','predict'].includes(m.phase as string)||m.prediction.trim().length>0);});
}
