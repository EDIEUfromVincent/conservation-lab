import type {Cluster, Program, ProgramChoice} from '../core/types';

export type BugRule = 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6';
export interface Bug {
  rule: BugRule;
  /** 문제가 있는 결정. 프로그램 전체 문제(B5)면 null */
  decisionId: string | null;
  choiceKey?: string;
  /** B5에서 메시지의 {step}에 들어갈 단계 이름 */
  stepName?: string;
  severity: 'error' | 'warn';
}
export interface CheckConfig {choiceRange: number[]}

/** 학생이 무언가를 적은 선택지만 '쓰인 길'로 본다. 비워 둔 C는 길이 아니다. */
export const usedChoices = (choices: ProgramChoice[]) =>
  choices.filter(c => c.label.trim() || c.result || c.why.trim() || c.stepId);

/**
 * 선택 그래프 프로그램 자동 검사(docs/12 §6.3).
 * ✕ 결과도 다음 결정으로 이어지므로 막다른 길 검사는 필요 없다(실행기가 항상 다음으로 간다).
 */
export function checkProgram(program: Program, steps: Cluster[], config: CheckConfig): Bug[] {
  const bugs: Bug[] = [];
  const stepIds = new Set(steps.map(s => s.id));
  if (!program.decisions.length) bugs.push({rule: 'B1', decisionId: null, severity: 'error'});
  for (const d of program.decisions) {
    const used = usedChoices(d.choices);
    const blank = !d.situation.trim() || used.some(c => !c.label.trim() || !c.result);
    if (blank) bugs.push({rule: 'B1', decisionId: d.id, severity: 'error'});
    if (used.length < config.choiceRange[0]) bugs.push({rule: 'B2', decisionId: d.id, severity: 'error'});
    if (used.length && !used.some(c => c.result === 'solved')) bugs.push({rule: 'B3', decisionId: d.id, severity: 'error'});
    for (const c of used) {
      if (c.result === 'solved' && !stepIds.has(c.stepId)) bugs.push({rule: 'B4', decisionId: d.id, choiceKey: c.key, severity: 'error'});
    }
    const labels = used.map(c => c.label.trim()).filter(Boolean);
    if (new Set(labels).size !== labels.length) bugs.push({rule: 'B6', decisionId: d.id, severity: 'error'});
  }
  const usedSteps = new Set(program.decisions.flatMap(d => d.choices.map(c => c.stepId)));
  for (const step of steps) {
    if (!usedSteps.has(step.id)) bugs.push({rule: 'B5', decisionId: null, stepName: step.name, severity: 'warn'});
  }
  return bugs;
}

export const blockingBugs = (bugs: Bug[]) => bugs.filter(b => b.severity === 'error');
