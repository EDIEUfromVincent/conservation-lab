import {scenario, journalCards} from '../content/loadContent';
import type {ChoiceKey, Decision, ResultType, TeamId} from '../content/types';
import type {AppState, Phase, ProfileId, ProgramChoice, ProgramDecision, Session, StepCheck, TrustValue} from './types';
import {append} from './logger';
import {planned} from './timer';
import {currentCase, decision, outcome, stageFor, labKey} from './caseRunner';
import {applyVote, clampHealth} from './scoring';
import {checkProgram, blockingBugs} from '../engine/programCheck';
import {L} from '../ui/labels';

export const teamIds: TeamId[] = [1, 2, 3, 4];
export const CHOICE_KEYS: ChoiceKey[] = ['A', 'B', 'C'];

/** 하루의 순서(docs/12 §3.2). CASE와 BREAK는 사건 흐름이 따로 넘긴다. */
export const PHASE_ORDER: Phase[] = [
  'SETUP', 'INTRO', 'VIDEO', 'HERITAGE_PICK', 'EXPERT_STUDY', 'TEAM_SETUP', 'CASE',
  'JOURNAL', 'ALGORITHM', 'REQUEST', 'BUILD', 'TEST', 'DEBUG', 'AI_CHECK', 'REFLECT', 'WRAPUP',
];
/** 단계 안의 하위 화면 수. next()가 마지막 하위 화면에서 다음 단계로 간다. */
const SUB_SCREENS: Partial<Record<Phase, number>> = {ALGORITHM: 2, AI_CHECK: 3};

export function emptyChoice(key: ChoiceKey): ProgramChoice {
  return {key, label: '', result: '', why: '', stepId: ''};
}
export function emptyDecision(owner: TeamId): ProgramDecision {
  return {id: `p${owner}`, owner, situation: '', choices: CHOICE_KEYS.map(emptyChoice)};
}
/** 시험하는 팀: 1팀 결정은 2팀이, …, 4팀 결정은 1팀이(docs/12 §6.4) */
export const testerOf = (owner: TeamId) => ((owner % 4) + 1) as TeamId;

export function initial(profile: ProfileId = '120'): Session {
  const now = Date.now();
  const p = scenario.profiles[profile];
  const teams = Object.fromEntries(teamIds.map(id => [id, {
    id, name: `${id}${L.team}`,
    health: Object.fromEntries(scenario.cases.map(c => [c.id, scenario.healthStart])),
    votes: {}, badges: [], evidencePoints: 0, heritage: '',
  }])) as unknown as AppState['teams'];
  return {
    schemaVersion: 2,
    log: [],
    state: {
      schemaVersion: 2,
      sessionId: new Date(now).toISOString() + '-' + Math.random().toString(36).slice(2, 6),
      startedAt: now, profile, phase: 'SETUP', phaseStartedAt: now, subScreen: 0,
      caseIndex: -1, caseCursor: 0, stage: null, teams, classPath: [], draft: {}, selectedTeam: 1, currentChoice: '',
      predictions: {}, predictionLocked: {}, labResults: {}, labSkipped: {}, labWork: {}, retryUsed: {}, skippedDecisions: [],
      morningNotes: scenario.video.watchFor.map(() => ''),
      heritageTally: {}, customHeritage: [], practice: {},
      journal: [], clusters: [],
      program: {heritage: {name: '', material: '', risk: ''}, decisions: [], version: 1},
      testRuns: [], testCursor: 0,
      aiCheck: {answerIndex: 0, pastedAnswer: {model: '', date: '', text: ''}, stepChecks: {}, trust: {}},
      settings: {
        quickLabs: p.quickLabs, skipOptional: p.skipOptional, showTeacherPanel: false,
        manualBaseUrl: scenario.expertStudy.manualBaseUrl, videoUrl: scenario.video.url, showRanking: false,
        timerOffsetSec: 0, paused: false, pausedAt: 0, pausedMs: 0,
      },
      teamSetupChecked: {}, expertPassed: {},
    },
  };
}

export type Action = {type: string; team?: TeamId; choice?: string; value?: unknown; key?: string};
export interface Effect {message?: string; modal?: 'tie' | 'lab' | 'noVote' | 'noPrediction'; ties?: string[]}

/** 의뢰 후보 유산 목록: 예시 + 교사가 더한 것 */
export function heritageOptions(s: AppState) {
  return [
    ...scenario.heritagePick.examples,
    ...s.customHeritage.map(name => ({name, place: '', material: '', experts: [] as string[]})),
  ];
}

export function act(session: Session, a: Action): {session: Session; effect: Effect} {
  const copy = structuredClone(session);
  const s = copy.state;
  const log = copy.log;
  let effect: Effect = {};
  const event = (name: string, extra: Parameters<typeof append>[3] = {}) => append(log, s, name, extra);

  const enterPhase = (p: Phase) => {
    const actual = Math.floor((Date.now() - s.phaseStartedAt) / 1000);
    s.phase = p;
    s.phaseStartedAt = Date.now();
    s.subScreen = 0;
    Object.assign(s.settings, {paused: false, pausedMs: 0, timerOffsetSec: 0});
    event('phase_enter', {planned_s: planned(s), actual_s: actual});
    if (p === 'BUILD') ensureProgram();
    if (p === 'TEST') s.testCursor = 0;
  };

  const ensureProgram = () => {
    if (s.program.decisions.length) return;
    const count = scenario.program.maxDecisions;
    s.program.decisions = teamIds.slice(0, count).map(emptyDecision);
  };

  /** 사건 정리(S19)에 들어올 때 그 사건의 행동 카드를 일지에 넣는다(docs/12 §5.2·§5.3). */
  const addJournal = () => {
    const c = currentCase(s);
    for (const d of c.nodes.filter((n): n is Decision => n.type === 'decision')) {
      if (s.journal.some(j => j.cardId === d.journal.id)) continue;
      const path = s.classPath.filter(p => p.nodeId === d.id).at(-1);
      s.journal.push({cardId: d.journal.id, caseId: c.id, decisionId: d.id, classResult: path?.result ?? null});
      event('journal_card', {node_id: d.id, value: d.journal.id, result: path?.result ?? ''});
    }
  };

  const enterStage = () => {
    let stage = stageFor(s);
    while (stage.kind === 'decision' && s.settings.skipOptional && decisionById(stage.nodeId)?.optional) {
      s.skippedDecisions.push(stage.nodeId);
      event('skipped', {node_id: stage.nodeId});
      s.caseCursor++;
      stage = stageFor(s);
    }
    s.stage = stage;
    s.draft = {};
    if (stage.kind === 'history' || stage.kind === 'historyJoin') event('history_shown');
    if (stage.kind === 'wrap') addJournal();
  };
  const decisionById = (id: string) =>
    currentCase(s).nodes.find((n): n is Decision => n.id === id && n.type === 'decision');

  const startCase = (index: number) => {
    s.caseIndex = index;
    s.caseCursor = 0;
    enterPhase('CASE');
    enterStage();
  };

  const nextFlow = () => {
    s.caseCursor++;
    if (s.caseCursor < currentCase(s).flow.length) {
      enterStage();
      return;
    }
    const finished = currentCase(s).id;
    s.stage = null;
    if (s.caseIndex === scenario.cases.length - 1) {
      enterPhase('JOURNAL');
      return;
    }
    if (scenario.profiles[s.profile].breakAfterCase === finished) {
      enterPhase('BREAK');
      return;
    }
    startCase(s.caseIndex + 1);
  };

  const showDelayed = () => {
    const st = s.stage!;
    if (st.sub !== 'outcome' || st.attempt !== 1) return false;
    const has = Boolean(outcome(s, s.currentChoice)?.delayed)
      || teamIds.some(t => s.draft[t] && outcome(s, s.draft[t]!.choice)?.delayed);
    if (!has) return false;
    st.sub = 'delayed';
    for (const t of teamIds) {
      const v = s.draft[t];
      const o = v && outcome(s, v.choice);
      if (!o?.delayed) continue;
      const id = currentCase(s).id;
      s.teams[t].health[id] = clampHealth(s.teams[t].health[id] + o.delayed.extraDelta);
      event('delayed_shown', {team: t, value: o.delayed.text, health_after: s.teams[t].health[id], result: o.result});
    }
    return true;
  };

  const confirm = (tie?: string) => {
    const d = decision(s);
    const st = s.stage;
    if (!d || st?.sub !== 'vote') return;
    const tally: Record<string, number> = {};
    for (const v of Object.values(s.draft)) if (v) tally[v.choice] = (tally[v.choice] ?? 0) + 1;
    const max = Math.max(0, ...Object.values(tally));
    const ties = Object.keys(tally).filter(k => tally[k] === max);
    if (!max && !d.choices.some(c => c.key === tie)) {
      effect = {modal: 'noVote'};
      return;
    }
    if (ties.length > 1 && !ties.includes(tie ?? '')) {
      effect = {modal: 'tie', ties};
      return;
    }
    const byTeacher = !max || ties.length > 1;
    const choice = byTeacher ? tie! : ties[0];
    const o = outcome(s, choice)!;
    const caseId = currentCase(s).id;
    s.currentChoice = choice;
    s.classPath.push({
      caseId, nodeId: d.id, attempt: st.attempt, choice: choice as ChoiceKey, result: o.result,
      decidedBy: byTeacher ? 'teacher' : 'majority', step: d.step, tally, at: Date.now(),
    });
    for (const t of teamIds) {
      const v = s.draft[t];
      if (!v) {
        event('vote', {team: t, value: L.missing});
        continue;
      }
      const result = outcome(s, v.choice)!;
      const score = applyVote(v, result);
      const team = s.teams[t];
      team.health[caseId] = clampHealth(team.health[caseId] + score.delta);
      if (score.badge && !team.badges.includes(score.badge)) team.badges.push(score.badge);
      team.evidencePoints += score.evidencePoint;
      (team.votes[d.id] ??= []).push({...v, result: result.result, delta: score.delta, at: Date.now()});
      event('vote', {team: t, value: v.choice, reasons: v.reasons.join(';'), result: result.result, health_after: team.health[caseId], step: d.step});
    }
    event(st.attempt === 2 ? 'retry' : 'decision', {value: choice, result: o.result, step: d.step});
    event('outcome', {value: o.id, result: o.result});
    st.sub = 'outcome';
  };

  const nextInCase = () => {
    const st = s.stage!;
    const c = currentCase(s);
    if (st.kind === 'brief' && st.line < c.brief.lines.length) {
      st.line++;
      return;
    }
    if (st.kind === 'predict' && !s.predictionLocked[c.lab!.id]) {
      effect.modal = 'noPrediction';
      return;
    }
    if (st.kind === 'lab' && !s.labResults[labKey(s)]) {
      effect.modal = 'lab';
      return;
    }
    if (st.kind === 'decision') {
      if (st.sub === 'vote') return confirm();
      if (st.sub === 'outcome' && showDelayed()) return;
      if (st.sub === 'delayed' && outcome(s, s.currentChoice)?.retry && !s.retryUsed[st.nodeId]) {
        st.sub = 'retryOffer';
        return;
      }
    }
    nextFlow();
  };

  const next = () => {
    if (s.phase === 'WRAPUP') return;
    if (s.phase === 'CASE') return nextInCase();
    if (s.phase === 'BREAK') return startCase(s.caseIndex + 1);
    const subCount = SUB_SCREENS[s.phase] ?? 1;
    if (s.subScreen < subCount - 1) {
      s.subScreen++;
      if (s.phase === 'ALGORITHM') event('algorithm_compare');
      return;
    }
    if (s.phase === 'REQUEST' && !s.program.heritage.name) {
      effect.message = L.needRequest;
      return;
    }
    if (s.phase === 'TEST') {
      const d = s.program.decisions[s.testCursor];
      if (d && !s.testRuns.some(r => r.decisionId === d.id && r.version === s.program.version)) {
        effect.message = L.needTest;
        return;
      }
      if (s.testCursor < s.program.decisions.length - 1) {
        s.testCursor++;
        return;
      }
    }
    if (s.phase === 'TEAM_SETUP') return startCase(0);
    enterPhase(PHASE_ORDER[PHASE_ORDER.indexOf(s.phase) + 1]);
  };

  const prev = () => {
    if (s.stage?.kind === 'brief' && s.stage.line > 1) s.stage.line--;
    else if (s.stage?.kind === 'decision' && s.stage.sub === 'vote') delete s.draft[s.selectedTeam];
    else if (s.phase !== 'CASE' && s.subScreen > 0) s.subScreen--;
    else if (s.phase === 'TEST' && s.testCursor > 0) s.testCursor--;
    else effect.message = L.locked;
  };

  const programDecision = (id?: string) => s.program.decisions.find(d => d.id === id);

  switch (a.type) {
    case 'next': next(); break;
    case 'prev': prev(); break;
    case 'profile':
      if (s.phase === 'SETUP' && (a.value === '80' || a.value === '120')) {
        s.profile = a.value;
        s.settings.quickLabs = scenario.profiles[a.value].quickLabs;
        s.settings.skipOptional = scenario.profiles[a.value].skipOptional;
      }
      break;
    case 'selectTeam': s.selectedTeam = a.team!; break;

    // ── 사건 파일(S10~S19) ──
    case 'vote': {
      if (s.phase === 'TEAM_SETUP') {
        const t = a.team ?? s.selectedTeam;
        if (CHOICE_KEYS.includes(a.choice as ChoiceKey)) s.practice[t] = a.choice as ChoiceKey;
        break;
      }
      if (s.phase === 'TEST') return act(copy, {type: 'testVote', choice: a.choice});
      const d = decision(s);
      if (s.stage?.kind !== 'decision' || s.stage.sub !== 'vote') break;
      if (!d?.choices.some(c => c.key === a.choice)) {
        effect.message = L.invalidChoice;
        break;
      }
      const t = a.team ?? s.selectedTeam;
      s.draft[t] = {choice: a.choice as ChoiceKey, reasons: s.draft[t]?.reasons ?? []};
      break;
    }
    case 'reason': {
      const v = s.draft[a.team ?? s.selectedTeam];
      if (!v || s.stage?.sub !== 'vote') break;
      if (a.key === 'journal' && !s.journal.length) {
        effect.message = L.journalLater;
        break;
      }
      v.reasons = v.reasons.includes(a.key!) ? v.reasons.filter(x => x !== a.key) : [...v.reasons, a.key!];
      break;
    }
    case 'confirm': confirm(a.choice); break;
    case 'fast': if (s.phase === 'CASE' && !showDelayed()) next(); break;
    case 'retry':
      if (s.stage?.sub === 'retryOffer' && !s.retryUsed[s.stage.nodeId]) {
        s.retryUsed[s.stage.nodeId] = true;
        s.stage.attempt = 2;
        s.stage.sub = 'vote';
        s.draft = {};
      }
      break;
    case 'predict': {
      if (s.stage?.kind !== 'predict') break;
      const lab = currentCase(s).lab!;
      const t = a.team ?? s.selectedTeam;
      if (s.predictionLocked[lab.id]) break;
      const values = (s.predictions[lab.id] ??= {});
      if (a.value === null) {
        delete values[t];
        break;
      }
      const option = lab.predict.options?.[Number(a.value)];
      if (lab.predict.type === 'rank' && option) {
        const prevRank = Array.isArray(values[t]) ? (values[t] as string[]) : [];
        values[t] = prevRank.includes(option) ? prevRank.filter(x => x !== option) : [...prevRank, option];
      } else if (option) values[t] = option;
      else if (lab.predict.type === 'number' && typeof a.value === 'number') values[t] = a.value;
      break;
    }
    case 'lock': {
      if (s.stage?.kind !== 'predict') break;
      const lab = currentCase(s).lab!;
      const values = s.predictions[lab.id] ?? {};
      const valid = Object.values(values).some(v =>
        lab.predict.type === 'rank' ? Array.isArray(v) && v.length === lab.predict.options?.length : v !== undefined);
      if (!valid) {
        effect.modal = 'noPrediction';
        break;
      }
      if (!s.predictionLocked[lab.id]) {
        for (const [t, v] of Object.entries(values)) event('prediction', {team: Number(t), value: JSON.stringify(v)});
        s.predictionLocked[lab.id] = true;
      }
      next();
      break;
    }
    case 'skipPrediction':
      if (s.stage?.kind === 'predict') {
        const id = currentCase(s).lab!.id;
        s.predictionLocked[id] = true;
        delete s.predictions[id];
        event('skipped', {value: id, note: 'prediction'});
        next();
      }
      break;
    case 'labError':
      event('error', {value: String(a.value)});
      if (s.stage?.kind === 'lab') {
        const key = labKey(s);
        s.labSkipped[key] = true;
        s.labResults[key] = {evidence: currentCase(s).lab!.fallbackEvidence};
      }
      break;
    case 'labReport':
      if (s.stage?.kind === 'lab' && !s.labResults[labKey(s)]) {
        s.labResults[labKey(s)] = a.value as Record<string, string | number>;
        event('lab_metric', {value: JSON.stringify(a.value)});
      }
      break;
    case 'labWork': s.labWork[a.key!] = a.value; break;
    case 'skipLab':
      if (s.stage?.kind === 'lab') {
        const key = labKey(s);
        s.labSkipped[key] = true;
        s.labResults[key] = {evidence: currentCase(s).lab!.fallbackEvidence};
        event('skipped', {value: key});
      }
      break;
    case 'skipDecision':
      if (decision(s)?.optional && s.stage?.sub === 'vote') {
        s.skippedDecisions.push(s.stage.nodeId);
        event('skipped');
        nextFlow();
      }
      break;

    // ── 아침(S02~S05) ──
    case 'morningNote': {
      const i = Number(a.key);
      if (i >= 0 && i < s.morningNotes.length) {
        s.morningNotes[i] = String(a.value).slice(0, 200);
        event('morning_note', {value: s.morningNotes[i]});
      }
      break;
    }
    case 'tally': {
      const name = a.key!;
      if (!heritageOptions(s).some(h => h.name === name)) break;
      s.heritageTally[name] = Math.max(0, Math.min(16, (s.heritageTally[name] ?? 0) + Number(a.value)));
      break;
    }
    case 'addHeritage': {
      const name = String(a.value).trim().slice(0, 30);
      if (name && !heritageOptions(s).some(h => h.name === name)) s.customHeritage.push(name);
      break;
    }
    case 'teamHeritage': {
      const name = String(a.value);
      if (heritageOptions(s).some(h => h.name === name)) s.teams[a.team!].heritage = name;
      event('team_heritage', {team: a.team, value: name});
      break;
    }

    // ── 연구 일지와 우리 반 알고리즘(S20·S21) ──
    case 'addCluster':
      if (s.clusters.length < scenario.algorithm.clusterMax) {
        const id = 'k' + (Math.max(0, ...s.clusters.map(c => Number(c.id.slice(1)))) + 1);
        s.clusters.push({id, name: '', cardIds: []});
      }
      break;
    case 'removeCluster':
      s.clusters = s.clusters.filter(c => c.id !== a.key);
      break;
    case 'assignCard': {
      const card = a.key!;
      if (!journalCards.some(c => c.id === card)) break;
      for (const c of s.clusters) c.cardIds = c.cardIds.filter(id => id !== card);
      const target = s.clusters.find(c => c.id === a.value);
      if (target) target.cardIds.push(card);
      event('cluster_move', {value: card, note: String(a.value ?? '')});
      break;
    }
    case 'clusterName': {
      const c = s.clusters.find(c => c.id === a.key);
      if (c) {
        c.name = String(a.value).slice(0, 30);
        event('algorithm_step', {value: c.name, note: c.id});
      }
      break;
    }
    case 'clusterMove': {
      const i = s.clusters.findIndex(c => c.id === a.key);
      const j = i + Number(a.value);
      if (i >= 0 && j >= 0 && j < s.clusters.length) [s.clusters[i], s.clusters[j]] = [s.clusters[j], s.clusters[i]];
      break;
    }

    // ── 저녁 의뢰와 프로그램(S30~S33) ──
    case 'requestPick': {
      const h = heritageOptions(s).find(h => h.name === a.value);
      if (!h) break;
      s.program.heritage.name = h.name;
      s.program.heritage.material = h.material;
      event('request', {value: h.name});
      break;
    }
    case 'requestRisk':
      s.program.heritage.risk = String(a.value).slice(0, 80);
      event('request_risk', {value: s.program.heritage.risk});
      break;
    case 'programEdit': {
      const d = programDecision(a.key);
      const {field, text} = (a.value ?? {}) as {field?: string; text?: string};
      if (!d || typeof text !== 'string') break;
      const limit = 120;
      if (field === 'situation') d.situation = text.slice(0, limit);
      else {
        const ch = d.choices.find(c => c.key === a.choice);
        if (!ch) break;
        if (field === 'label') ch.label = text.slice(0, limit);
        else if (field === 'why') ch.why = text.slice(0, limit);
        else if (field === 'result' && ['', 'solved', 'worse', 'irreversible'].includes(text)) ch.result = text as ResultType | '';
        else if (field === 'stepId' && (text === '' || s.clusters.some(c => c.id === text))) ch.stepId = text;
        else break;
      }
      event('program_edit', {node_id: d.id, team: d.owner, value: text, note: [field, a.choice].filter(Boolean).join(':')});
      break;
    }
    case 'testVote': {
      const d = s.program.decisions[s.testCursor];
      const ch = d?.choices.find(c => c.key === a.choice);
      if (!d || !ch || !(ch.label.trim() || ch.result)) {
        effect.message = L.invalidChoice;
        break;
      }
      s.testRuns = s.testRuns.filter(r => !(r.decisionId === d.id && r.version === s.program.version));
      s.testRuns.push({decisionId: d.id, testerTeam: testerOf(d.owner), choice: ch.key, note: '', version: s.program.version, resolved: false});
      event('program_test', {node_id: d.id, team: testerOf(d.owner), value: ch.key, result: ch.result});
      break;
    }
    case 'testNote': {
      const d = s.program.decisions[s.testCursor];
      const run = d && s.testRuns.find(r => r.decisionId === d.id && r.version === s.program.version);
      if (run) {
        run.note = String(a.value).slice(0, 200);
        if (run.note) event('bug_found', {node_id: d.id, team: run.testerTeam, value: run.note, note: 'tester'});
      }
      break;
    }
    case 'resolveNote': {
      const run = s.testRuns[Number(a.key)];
      if (run?.note) {
        run.resolved = !run.resolved;
        if (run.resolved) event('bug_fixed', {node_id: run.decisionId, value: run.note, note: 'tester'});
      }
      break;
    }
    case 'retest': {
      const bugs = checkProgram(s.program, s.clusters, scenario.program);
      s.program.version++;
      event('program_retest', {value: String(s.program.version), result: String(blockingBugs(bugs).length), note: bugs.map(b => b.rule).join(';')});
      break;
    }

    // ── AI 점검(S34) ──
    case 'aiStep':
      if (s.clusters.some(c => c.id === a.key) && ['kept', 'missed', 'unknown'].includes(String(a.value))) {
        s.aiCheck.stepChecks[a.key!] = a.value as StepCheck;
        event('ai_check', {step: a.key, value: String(a.value)});
      }
      break;
    case 'trust': {
      const when = a.key === 'after' ? 'after' : 'before';
      if (!['trust', 'unsure', 'distrust'].includes(String(a.value))) break;
      const t = a.team ?? s.selectedTeam;
      (s.aiCheck.trust[t] ??= {})[when] = a.value as TrustValue;
      event('ai_trust', {team: t, value: String(a.value), note: when});
      break;
    }
    case 'pasteAI': s.aiCheck.pastedAnswer = a.value as AppState['aiCheck']['pastedAnswer']; break;

    // ── 교사 도구 ──
    case 'panel': s.settings.showTeacherPanel = !s.settings.showTeacherPanel; break;
    case 'pause':
      if (s.settings.paused) {
        s.settings.pausedMs += Date.now() - s.settings.pausedAt;
        s.settings.paused = false;
      } else {
        s.settings.paused = true;
        s.settings.pausedAt = Date.now();
      }
      break;
    case 'timer': s.settings.timerOffsetSec += Number(a.value); break;
    case 'setting': Object.assign(s.settings, {[a.key!]: a.value}); break;
    case 'teamName': s.teams[a.team!].name = String(a.value).slice(0, 20); break;
    case 'teamChecked': s.teamSetupChecked[a.key!] = !s.teamSetupChecked[a.key!]; break;
    case 'expertPassed': s.expertPassed[a.key!] = !s.expertPassed[a.key!]; break;
    case 'export': event('export', {value: String(a.value)}); break;
  }
  return {session: copy, effect};
}
