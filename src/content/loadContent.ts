import raw from '../../data/scenario.json' with {type: 'json'};
import manuals from '../../data/manuals.json' with {type: 'json'};
import labs from '../../data/labs.config.json' with {type: 'json'};
import type {Case, Decision, HeritageExample, JournalCard} from './types';

export const scenario = raw as Omit<typeof raw, 'cases' | 'heritagePick'> & {
  cases: Case[];
  heritagePick: Omit<typeof raw.heritagePick, 'examples'> & {examples: HeritageExample[]};
};
export {manuals, labs};
export const cases = scenario.cases;

/** 사건 순서대로 모든 행동 카드. 연구 일지 벽(S20)과 비교(S21)에 쓴다. */
export const journalCards: (JournalCard & {caseId: string; decisionId: string})[] = cases.flatMap(c =>
  c.nodes
    .filter((n): n is Decision => n.type === 'decision')
    .map(d => ({...d.journal, caseId: c.id, decisionId: d.id})),
);
