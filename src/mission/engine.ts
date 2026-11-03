import raw from '../../data/missions.json' with {type: 'json'};
import {scenario, manuals} from '../content/loadContent';
import type {Case, ChoiceKey, Decision, ExpertId, Outcome} from '../content/types';

// 3D 미션: 사건 → 장소 → 단서('?') → 매뉴얼 카드로 풀기 → 결정 → 결과 → 실제 역사.
// 화면과 무관한 순수 상태 전이만 둔다(단위 테스트 대상).

export interface MissionClue {
  id: string; spot: string; text?: string; source?: 'lab';
  options: string[]; answer: string; fact: string; nudge: string;
}
export type Slot = 'main' | 'detail' | 'archive' | 'lab';
export type PlaceIcon = 'statue' | 'frame' | 'archive' | 'lab' | 'vase' | 'fragments' | 'mask' | 'beard' | 'gate' | 'paint' | 'pagoda';
/** lab: 이 장소에서 하는 실습 부분(main·A·B). after: 이 결정을 마쳐야 열린다. */
export interface MissionPlace {id: string; name: string; slot: Slot; icon: PlaceIcon; say: string; clues: string[]; lab?: string; after?: string}
export interface MissionData {
  caseId: string; call: string; mapSay: string; complete: string;
  places: MissionPlace[]; clues: MissionClue[]; decisions: {id: string; needs: string[]}[];
}
export const missions = raw.missions as MissionData[];

export type Screen = 'incident' | 'map' | 'place' | 'clue' | 'lab' | 'decision' | 'outcome' | 'history' | 'complete';
export const SCREENS: Screen[] = ['incident', 'map', 'place', 'clue', 'lab', 'decision', 'outcome', 'history', 'complete'];
export const NONE = 'none';

export interface Attempt {choice: ChoiceKey; reason: string}
export interface MissionState {
  version: 2;
  caseId: string;
  screen: Screen;
  place: string | null;
  clue: string | null;
  decision: string | null;
  opened: string[];                    // '?'를 열어 본 단서
  tries: Record<string, string[]>;     // 단서별로 고른 카드(순서대로)
  solved: string[];                    // 푼 단서
  attempts: Record<string, Attempt[]>; // 결정별 시도
  closed: string[];                    // 결과를 보고 넘어간 결정
  draft: {choice: ChoiceKey | ''; reason: string};
  delayedShown: boolean;
  labsDone: string[];                  // 실습을 마친 장소
  labWork: unknown;
}

export type MissionAction =
  | {t: 'start'} | {t: 'map'} | {t: 'back'}
  | {t: 'place'; id: string}
  | {t: 'open'; id: string}
  | {t: 'answer'; option: string}
  | {t: 'lab'} | {t: 'labWork'; work: unknown} | {t: 'labDone'}
  | {t: 'decision'; id: string}
  | {t: 'choose'; key: ChoiceKey}
  | {t: 'reason'; id: string}
  | {t: 'commit'} | {t: 'forward'} | {t: 'retry'} | {t: 'proceed'}
  | {t: 'history'} | {t: 'complete'};

export interface Effect {correct?: boolean; message?: 'locked' | 'placeLocked' | 'needChoice' | 'needReason'}

export function missionFor(caseId: string) {
  const m = missions.find(x => x.caseId === caseId);
  if (!m) throw new Error('mission ' + caseId);
  return m;
}
export const caseOf = (caseId: string) => scenario.cases.find(c => c.id === caseId) as Case;
export const decisionOf = (caseId: string, id: string) =>
  caseOf(caseId).nodes.find((n): n is Decision => n.type === 'decision' && n.id === id)!;
export const outcomeOf = (caseId: string, id: string) =>
  caseOf(caseId).nodes.find((n): n is Outcome => n.type === 'outcome' && n.id === id)!;

export interface Hint {
  id: string; kind: 'row' | 'idea' | 'journal';
  expert?: ExpertId; symbol: string; label: string;
  clue: string; cause?: string; action?: string; caseOrder?: number;
}
/**
 * 힌트 카드 세 가지: 매뉴얼 '단서 → 원인 → 처리' 표의 줄('metal:0'), 매뉴얼 '꼭 기억해요'('metal:k1'),
 * 앞 사건의 연구 일지 카드('journal:j-c2d1').
 */
export function hint(id: string): Hint | null {
  const [source, key] = id.split(':');
  if (source === 'journal') {
    for (const c of scenario.cases) {
      const d = c.nodes.find((n): n is Decision => n.type === 'decision' && n.journal.id === key);
      if (d) return {id, kind: 'journal', symbol: '✎', label: '', clue: d.journal.text, caseOrder: c.order};
    }
    return null;
  }
  const doc = manuals.manuals.find(x => x.id === source);
  const info = scenario.experts.find(x => x.id === source);
  if (!doc || !info || !key) return null;
  const base = {id, expert: source as ExpertId, symbol: info.symbol, label: info.label};
  if (key.startsWith('k')) {
    const idea = doc.keyIdeas[Number(key.slice(1))];
    return idea ? {...base, kind: 'idea', clue: idea} : null;
  }
  const row = doc.clues[Number(key)];
  return row ? {...base, kind: 'row', clue: row.clue, cause: row.cause, action: row.action} : null;
}

export function clueOf(s: MissionState, id: string) {
  return missionFor(s.caseId).clues.find(c => c.id === id)!;
}
export function clueText(caseId: string, clue: MissionClue) {
  return clue.text ?? (clue.source === 'lab' ? caseOf(caseId).lab!.fallbackEvidence : '');
}
export const placeOf = (s: MissionState, id: string) => missionFor(s.caseId).places.find(p => p.id === id)!;
export const placeOfClue = (s: MissionState, clueId: string) => missionFor(s.caseId).places.find(p => p.clues.includes(clueId))!;

/** 근거로 쓸 수 있는 사실: 푼 단서 중 상관없는 단서를 뺀 것 */
export const facts = (s: MissionState) =>
  missionFor(s.caseId).clues.filter(c => s.solved.includes(c.id) && c.answer !== NONE);

export function unlocked(s: MissionState, decisionId: string) {
  const gate = missionFor(s.caseId).decisions.find(d => d.id === decisionId);
  return !!gate && gate.needs.every(id => s.solved.includes(id));
}
export const lastAttempt = (s: MissionState, id: string) => s.attempts[id]?.at(-1);
export function lastOutcome(s: MissionState, id: string) {
  const a = lastAttempt(s, id);
  if (!a) return null;
  return outcomeOf(s.caseId, decisionOf(s.caseId, id).choices.find(c => c.key === a.choice)!.outcome);
}
export const placeLeft = (s: MissionState, p: MissionPlace) => p.clues.filter(id => !s.solved.includes(id)).length;
export const placeOpen = (s: MissionState, p: MissionPlace) => !p.after || s.closed.includes(p.after);
/** 실습 결과 단서는 그 장소의 실습을 마쳐야 열린다 */
const clueReady = (s: MissionState, id: string) => clueOf(s, id).source !== 'lab' || s.labsDone.includes(placeOfClue(s, id).id);
export const allClosed = (s: MissionState) => missionFor(s.caseId).decisions.every(d => s.closed.includes(d.id));

export function initialMission(caseId = 'case1'): MissionState {
  missionFor(caseId);
  return {
    version: 2, caseId, screen: 'incident', place: null, clue: null, decision: null,
    opened: [], tries: {}, solved: [], attempts: {}, closed: [],
    draft: {choice: '', reason: ''}, delayedShown: false, labsDone: [], labWork: null,
  };
}

/** 클리커 '다음' 한 번이 할 일. 고르기(A~D)가 필요한 화면에서는 null. */
export function primary(s: MissionState): MissionAction | null {
  const m = missionFor(s.caseId);
  switch (s.screen) {
    case 'incident': return {t: 'start'};
    case 'map': {
      if (allClosed(s)) return {t: 'history'};
      const gate = m.decisions.find(d => !s.closed.includes(d.id) && unlocked(s, d.id));
      if (gate) return {t: 'decision', id: gate.id};
      const place = m.places.find(p => placeOpen(s, p) && placeLeft(s, p) > 0);
      return place ? {t: 'place', id: place.id} : null;
    }
    case 'place': {
      const p = placeOf(s, s.place!);
      const unsolved = p.clues.find(id => !s.solved.includes(id) && clueReady(s, id));
      if (unsolved) return {t: 'open', id: unsolved};
      if (p.lab && !s.labsDone.includes(p.id)) return {t: 'lab'};
      return {t: 'map'};
    }
    case 'clue': return s.solved.includes(s.clue!) ? {t: 'back'} : null;
    case 'lab': return null;
    case 'decision': return s.draft.choice && s.draft.reason ? {t: 'commit'} : null;
    case 'outcome': {
      const o = lastOutcome(s, s.decision!)!;
      return o.delayed && !s.delayedShown ? {t: 'forward'} : {t: 'proceed'};
    }
    case 'history': return {t: 'complete'};
    case 'complete': return null;
  }
}

export function act(prev: MissionState, a: MissionAction): {state: MissionState; effect: Effect} {
  const s = structuredClone(prev);
  const effect: Effect = {};
  const m = missionFor(s.caseId);
  const go = (screen: Screen) => { s.screen = screen; };

  switch (a.t) {
    case 'start': if (s.screen === 'incident') go('map'); break;
    case 'map': s.place = null; s.clue = null; go('map'); break;
    case 'back':
      if (s.screen === 'clue' || s.screen === 'lab') { s.clue = null; go('place'); }
      else if (s.screen === 'place' || s.screen === 'decision') { s.place = null; s.decision = null; go('map'); }
      break;
    case 'place': {
      const p = m.places.find(x => x.id === a.id);
      if (!p) break;
      if (!placeOpen(s, p)) { effect.message = 'placeLocked'; break; }
      s.place = a.id; s.clue = null; go('place');
      break;
    }
    case 'open': {
      const clue = m.clues.find(c => c.id === a.id);
      if (!clue || !clueReady(s, a.id) || !placeOpen(s, placeOfClue(s, a.id))) break;
      if (!s.opened.includes(a.id)) s.opened.push(a.id);
      s.place = placeOfClue(s, a.id).id;
      s.clue = a.id;
      go('clue');
      break;
    }
    case 'answer': {
      if (s.screen !== 'clue' || !s.clue || s.solved.includes(s.clue)) break;
      const clue = clueOf(s, s.clue);
      if (!clue.options.includes(a.option)) break;
      (s.tries[clue.id] ??= []).push(a.option);
      effect.correct = a.option === clue.answer;
      if (effect.correct) s.solved.push(clue.id);
      break;
    }
    case 'lab': if (s.screen === 'place' && placeOf(s, s.place!).lab) go('lab'); break;
    case 'labWork': s.labWork = a.work; break;
    case 'labDone': {
      if (s.screen !== 'lab') break;
      if (!s.labsDone.includes(s.place!)) s.labsDone.push(s.place!);
      const clue = placeOf(s, s.place!).clues.find(id => clueOf(s, id).source === 'lab' && !s.solved.includes(id));
      if (clue) return act(s, {t: 'open', id: clue});
      go('place');
      break;
    }
    case 'decision':
      if (!m.decisions.some(d => d.id === a.id) || s.closed.includes(a.id)) break;
      if (!unlocked(s, a.id)) { effect.message = 'locked'; break; }
      s.decision = a.id;
      s.draft = {choice: '', reason: ''};
      go('decision');
      break;
    case 'choose':
      if (s.screen === 'decision' && decisionOf(s.caseId, s.decision!).choices.some(c => c.key === a.key)) s.draft.choice = a.key;
      break;
    case 'reason':
      if (s.screen === 'decision' && facts(s).some(f => f.id === a.id)) s.draft.reason = a.id;
      break;
    case 'commit': {
      if (s.screen !== 'decision') break;
      if (!s.draft.choice) { effect.message = 'needChoice'; break; }
      if (!s.draft.reason) { effect.message = 'needReason'; break; }
      (s.attempts[s.decision!] ??= []).push({choice: s.draft.choice, reason: s.draft.reason});
      s.delayedShown = false;
      go('outcome');
      break;
    }
    case 'forward': if (s.screen === 'outcome' && lastOutcome(s, s.decision!)?.delayed) s.delayedShown = true; break;
    case 'retry': {
      if (s.screen !== 'outcome' || !lastOutcome(s, s.decision!)?.retry) break;
      s.draft = {choice: '', reason: lastAttempt(s, s.decision!)!.reason};
      go('decision');
      break;
    }
    case 'proceed':
      if (s.screen !== 'outcome') break;
      if (!s.closed.includes(s.decision!)) s.closed.push(s.decision!);
      s.decision = null;
      go(allClosed(s) ? 'history' : 'map');
      break;
    case 'history': if (allClosed(s)) go('history'); break;
    case 'complete': if (s.screen === 'history') go('complete'); break;
  }
  return {state: s, effect};
}

/** 저장된 기록을 믿기 전에 모양과 id를 모두 확인한다. 하나라도 어긋나면 null. */
export function validMission(v: unknown): MissionState | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as MissionState;
  const m = missions.find(x => x.caseId === s.caseId);
  if (s.version !== 2 || !m || !SCREENS.includes(s.screen)) return null;
  const clueIds = m.clues.map(c => c.id), decisionIds = m.decisions.map(d => d.id), placeIds = m.places.map(p => p.id);
  const ids = (x: unknown, allowed: string[]) => Array.isArray(x) && x.every(id => allowed.includes(id));
  const nullable = (x: unknown, allowed: string[]) => x === null || allowed.includes(x as string);
  if (!ids(s.opened, clueIds) || !ids(s.solved, clueIds) || !ids(s.closed, decisionIds)) return null;
  if (!nullable(s.place, placeIds) || !nullable(s.clue, clueIds) || !nullable(s.decision, decisionIds)) return null;
  if (!s.tries || typeof s.tries !== 'object' || !Object.entries(s.tries).every(([k, x]) => clueIds.includes(k) && Array.isArray(x) && x.every(o => typeof o === 'string'))) return null;
  if (!s.attempts || typeof s.attempts !== 'object' || !Object.entries(s.attempts).every(([k, x]) =>
    decisionIds.includes(k) && Array.isArray(x) && x.every(a => ['A', 'B', 'C'].includes(a?.choice) && clueIds.includes(a?.reason)))) return null;
  if (!s.draft || !['', 'A', 'B', 'C'].includes(s.draft.choice) || !(s.draft.reason === '' || clueIds.includes(s.draft.reason))) return null;
  if (typeof s.delayedShown !== 'boolean' || !ids(s.labsDone, placeIds)) return null;
  // 화면마다 꼭 있어야 하는 것
  if (['place', 'clue', 'lab'].includes(s.screen) && !s.place) return null;
  if (s.screen === 'clue' && !s.clue) return null;
  if (['decision', 'outcome'].includes(s.screen) && !s.decision) return null;
  if (s.screen === 'outcome' && !s.attempts[s.decision!]?.length) return null;
  return s;
}
