import {scenario} from '../content/loadContent';
import type {AppState, Stage} from './types';
import type {Decision, Outcome} from '../content/types';

export const currentCase = (s: AppState) => scenario.cases[Math.max(0, s.caseIndex)];
export const decision = (s: AppState) =>
  currentCase(s).nodes.find(n => n.id === s.stage?.nodeId && n.type === 'decision') as Decision | undefined;
export const outcome = (s: AppState, choice: string) => {
  const d = decision(s);
  return currentCase(s).nodes.find(n => n.id === d?.choices.find(c => c.key === choice)?.outcome) as Outcome | undefined;
};
export const labKey = (s: AppState) => currentCase(s).lab!.id + (s.stage?.part ? ':' + s.stage.part : '');
export function stageFor(s: AppState): Stage {
  const c = currentCase(s);
  const item = c.flow[s.caseCursor];
  const base = {line: 1, nodeId: '', attempt: 1 as const, sub: 'vote' as const, part: ''};
  if (item?.startsWith('lab')) return {...base, kind: 'lab', part: item.split(':')[1] ?? ''};
  if (['brief', 'experts', 'predict', 'history', 'wrap'].includes(item)) return {...base, kind: item as Stage['kind']};
  const n = c.nodes.find(n => n.id === item);
  return {...base, kind: n?.type === 'decision' ? 'decision' : n?.type === 'historyJoin' ? 'historyJoin' : 'wrap', nodeId: n?.id ?? ''};
}
