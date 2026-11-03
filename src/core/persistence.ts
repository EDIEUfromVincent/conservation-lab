import type {Session} from './types';
import {cases, scenario, journalCards} from '../content/loadContent';
import type {Decision} from '../content/types';

export const KEY = 'cons-lab:current';
export let storageError = false;
export let loadError = false;

export function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    storageError = true;
    return null;
  }
}
export function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    storageError = false;
    return true;
  } catch {
    storageError = true;
    return false;
  }
}
export function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    storageError = true;
    return false;
  }
}

type Dict = Record<string, unknown>;
const obj = (v: unknown): v is Dict => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, min = 0, max = 1e15) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const int = (v: unknown, min: number, max: number) => finite(v, min, max) && Number.isInteger(v);
const str = (v: unknown, max = 20000) => typeof v === 'string' && v.length <= max;
const bool = (v: unknown) => typeof v === 'boolean';
const oneOf = (v: unknown, list: readonly unknown[]) => list.includes(v);
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
const dictionary = (v: unknown, check: (v: unknown, k: string) => boolean) =>
  obj(v) && Object.entries(v).every(([k, x]) => !BAD_KEYS.includes(k) && check(x, k));
const list = (v: unknown, max: number, check: (v: unknown) => boolean) => Array.isArray(v) && v.length <= max && v.every(check);
function safeTree(v: unknown, depth = 0): boolean {
  if (depth > 15) return false;
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'string') return v.length <= 30000;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length <= 30000 && v.every(x => safeTree(x, depth + 1));
  return dictionary(v, x => safeTree(x, depth + 1));
}
const sameKeys = (v: Dict, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => k in v);

const PHASES = ['SETUP', 'INTRO', 'VIDEO', 'HERITAGE_PICK', 'EXPERT_STUDY', 'TEAM_SETUP', 'CASE', 'BREAK', 'JOURNAL',
  'ALGORITHM', 'REQUEST', 'BUILD', 'TEST', 'DEBUG', 'AI_CHECK', 'REFLECT', 'WRAPUP'];
const TEAMS = ['1', '2', '3', '4'];
const KEYS = ['A', 'B', 'C'];
const RESULTS = ['solved', 'worse', 'irreversible'];
const STATE_KEYS = ['schemaVersion', 'sessionId', 'startedAt', 'profile', 'phase', 'phaseStartedAt', 'subScreen', 'caseIndex',
  'caseCursor', 'stage', 'teams', 'classPath', 'draft', 'selectedTeam', 'currentChoice', 'predictions', 'predictionLocked',
  'labResults', 'labSkipped', 'labWork', 'retryUsed', 'skippedDecisions', 'morningNotes', 'heritageTally', 'customHeritage',
  'practice', 'journal', 'clusters', 'program', 'testRuns', 'testCursor', 'aiCheck', 'settings', 'teamSetupChecked', 'expertPassed'];
const allDecisions = cases.flatMap(c => c.nodes.filter((n): n is Decision => n.type === 'decision'));
const cardIds = new Set(journalCards.map(c => c.id));

function validStage(s: Dict): boolean {
  if (s.phase !== 'CASE') return s.stage === null;
  const c = cases[s.caseIndex as number];
  const st = s.stage;
  if (!c || !obj(st)) return false;
  if (!oneOf(st.kind, ['brief', 'experts', 'predict', 'lab', 'decision', 'historyJoin', 'history', 'wrap'])
    || !int(st.line, 1, 10) || !oneOf(st.attempt, [1, 2]) || !oneOf(st.sub, ['vote', 'outcome', 'delayed', 'retryOffer'])
    || !oneOf(st.part, ['', 'A', 'B']) || !str(st.nodeId, 50)) return false;
  if ((s.caseCursor as number) >= c.flow.length) return false;
  const item = c.flow[s.caseCursor as number];
  const expected = item.startsWith('lab') ? 'lab' : c.nodes.find(n => n.id === item)?.type ?? item;
  if (st.kind !== expected) return false;
  if (st.kind === 'lab' && st.part !== (item.split(':')[1] ?? '')) return false;
  if (['decision', 'historyJoin'].includes(st.kind as string) && !c.nodes.some(n => n.id === st.nodeId && n.type === st.kind)) return false;
  if (st.kind === 'decision') {
    const d = c.nodes.find(n => n.id === st.nodeId) as Decision;
    if (st.sub !== 'vote' && !d.choices.some(ch => ch.key === s.currentChoice)) return false;
    if (obj(s.draft) && Object.values(s.draft).some(v => !obj(v) || !d.choices.some(ch => ch.key === v.choice))) return false;
  }
  return true;
}

function validProgram(p: unknown, clusterIds: Set<string>): boolean {
  if (!obj(p) || !obj(p.heritage) || !str(p.heritage.name, 30) || !str(p.heritage.material, 50) || !str(p.heritage.risk, 80)) return false;
  if (!int(p.version, 1, 10000)) return false;
  return list(p.decisions, 4, d => obj(d) && str(d.id, 10) && oneOf(d.owner, [1, 2, 3, 4]) && str(d.situation, 120)
    && list(d.choices, 3, c => obj(c) && oneOf(c.key, KEYS) && str(c.label, 120) && str(c.why, 120)
      && oneOf(c.result, ['', ...RESULTS]) && (c.stepId === '' || clusterIds.has(c.stepId as string))));
}

export function validateSession(v: unknown): v is Session {
  if (!obj(v) || v.schemaVersion !== 2 || !obj(v.state) || !Array.isArray(v.log) || !safeTree(v)) return false;
  const s = v.state;
  if (!sameKeys(s, STATE_KEYS)) return false;
  if (s.schemaVersion !== 2 || !str(s.sessionId, 100) || !finite(s.startedAt) || !finite(s.phaseStartedAt)) return false;
  if (!oneOf(s.profile, ['80', '120']) || !oneOf(s.phase, PHASES)) return false;
  if (!int(s.caseIndex, -1, cases.length - 1) || !int(s.caseCursor, 0, 20) || !int(s.subScreen, 0, 3)) return false;
  if (!oneOf(s.selectedTeam, [1, 2, 3, 4]) || !oneOf(s.currentChoice, ['', ...KEYS])) return false;
  if (s.phase === 'CASE' && (s.caseIndex as number) < 0) return false;
  if (!validStage(s)) return false;

  const vote = (x: unknown) => obj(x) && oneOf(x.choice, KEYS) && Array.isArray(x.reasons)
    && x.reasons.every(r => scenario.reasonTags.some(t => t.id === r));
  if (!dictionary(s.draft, (x, k) => TEAMS.includes(k) && vote(x))) return false;

  if (!obj(s.teams) || Object.keys(s.teams).length !== 4) return false;
  for (const id of [1, 2, 3, 4]) {
    const t = s.teams[id];
    if (!obj(t) || t.id !== id || !str(t.name, 20) || !str(t.heritage, 30) || !obj(t.health)) return false;
    if (!scenario.cases.every(c => finite((t.health as Dict)[c.id], 0, 10))) return false;
    if (!list(t.badges, 20, b => scenario.principles.some(p => p.id === b)) || !finite(t.evidencePoints, 0, 1000)) return false;
    const votesOk = dictionary(t.votes, (votes, key) => {
      const d = allDecisions.find(n => n.id === key);
      return !!d && list(votes, 2, x => vote(x) && d.choices.some(c => c.key === (x as Dict).choice)
        && oneOf((x as Dict).result, RESULTS) && finite((x as Dict).delta, -10, 0) && finite((x as Dict).at));
    });
    if (!votesOk) return false;
  }

  const pathOk = list(s.classPath, 30, p => {
    if (!obj(p)) return false;
    const d = cases.find(c => c.id === p.caseId)?.nodes.find(n => n.id === p.nodeId);
    return d?.type === 'decision' && d.choices.some(c => c.key === p.choice) && oneOf(p.attempt, [1, 2])
      && oneOf(p.decidedBy, ['majority', 'teacher']) && oneOf(p.result, RESULTS) && p.step === d.step && finite(p.at)
      && dictionary(p.tally, x => finite(x, 0, 4));
  });
  if (!pathOk) return false;

  const predictionsOk = dictionary(s.predictions, (x, k) => {
    const lab = scenario.cases.find(c => c.lab?.id === k)?.lab;
    return !!lab && dictionary(x, (val, t) => TEAMS.includes(t)
      && (Array.isArray(val) ? val.length <= 4 && val.every(y => str(y, 200)) : str(val, 200) || finite(val, 0, 100)));
  });
  if (!predictionsOk) return false;
  for (const key of ['predictionLocked', 'labSkipped', 'retryUsed', 'teamSetupChecked', 'expertPassed']) {
    if (!dictionary(s[key], bool)) return false;
  }
  if (!dictionary(s.labResults, x => dictionary(x, val => str(val) || finite(val, -1e6, 1e6)))) return false;
  if (!dictionary(s.labWork, x => safeTree(x))) return false;
  if (!list(s.skippedDecisions, 20, x => allDecisions.some(d => d.id === x && d.optional))) return false;

  // 하루 서사·귀납
  if (!list(s.morningNotes, 10, x => str(x, 200))) return false;
  if (!dictionary(s.heritageTally, x => int(x, 0, 16)) || !list(s.customHeritage, 20, x => str(x, 30))) return false;
  if (!dictionary(s.practice, (x, k) => TEAMS.includes(k) && oneOf(x, KEYS))) return false;
  if (!list(s.journal, 30, j => obj(j) && cardIds.has(j.cardId as string) && str(j.caseId, 20) && str(j.decisionId, 20)
    && (j.classResult === null || oneOf(j.classResult, RESULTS)))) return false;
  if (!list(s.clusters, scenario.algorithm.clusterMax, c => obj(c) && str(c.id, 10) && str(c.name, 30)
    && list(c.cardIds, 30, id => cardIds.has(id as string)))) return false;
  const clusterIds = new Set((s.clusters as {id: string}[]).map(c => c.id));

  // 프로그램
  if (!validProgram(s.program, clusterIds)) return false;
  if (!list(s.testRuns, 200, r => obj(r) && str(r.decisionId, 10) && oneOf(r.testerTeam, [1, 2, 3, 4]) && oneOf(r.choice, KEYS)
    && str(r.note, 200) && int(r.version, 1, 10000) && bool(r.resolved))) return false;
  if (!int(s.testCursor, 0, 3)) return false;

  // AI 점검
  const ai = s.aiCheck;
  if (!obj(ai) || !finite(ai.answerIndex, 0, 100) || !obj(ai.pastedAnswer)) return false;
  if (!str(ai.pastedAnswer.model, 200) || !str(ai.pastedAnswer.date, 50) || !str(ai.pastedAnswer.text)) return false;
  if (!dictionary(ai.stepChecks, (x, k) => clusterIds.has(k) && oneOf(x, ['kept', 'missed', 'unknown']))) return false;
  const trustValue = (x: unknown) => x === undefined || oneOf(x, ['trust', 'unsure', 'distrust']);
  if (!dictionary(ai.trust, (x, k) => TEAMS.includes(k) && obj(x) && trustValue(x.before) && trustValue(x.after))) return false;

  const settings = s.settings;
  if (!obj(settings)) return false;
  for (const k of ['quickLabs', 'skipOptional', 'showTeacherPanel', 'showRanking', 'paused']) if (!bool(settings[k])) return false;
  if (!str(settings.manualBaseUrl, 2000) || !str(settings.videoUrl, 2000) || !finite(settings.timerOffsetSec, -100000, 100000)
    || !finite(settings.pausedAt) || !finite(settings.pausedMs)) return false;

  const logText = ['t', 'phase', 'case_id', 'node_id', 'event', 'value', 'reasons', 'result', 'step', 'note'];
  const logNumOrText = ['team', 'health_after', 'planned_s', 'actual_s'];
  return v.log.length <= 30000 && v.log.every(e => obj(e) && logText.every(k => str(e[k], 30000)) && finite(e.elapsed_s)
    && logNumOrText.every(k => str(e[k], 100) || finite(e[k], -100000, 1e9)));
}

/** 옛 형식(schemaVersion 1, 재설계 이전)은 화면 흐름이 달라 이어서 진행할 수 없다. */
export class OldSessionError extends Error {}
export function parseSession(text: string): Session {
  if (text.length > 8 * 1024 * 1024) throw Error('size');
  const value: unknown = JSON.parse(text);
  if (obj(value) && value.schemaVersion === 1) throw new OldSessionError('v1');
  if (!validateSession(value)) throw Error('invalid');
  return value;
}
export function load(): Session | null {
  try {
    const text = safeGet(KEY);
    return text ? parseSession(text) : null;
  } catch {
    loadError = true;
    return null;
  }
}
export function save(session: Session) {
  return safeSet(KEY, JSON.stringify(session));
}
