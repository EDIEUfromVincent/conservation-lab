import {describe, it, expect} from 'vitest';
import {act, initial, teamIds, type Action} from '../../src/core/actions';
import {currentCase, decision, stageFor} from '../../src/core/caseRunner';
import {parseSession, validateSession, save, OldSessionError} from '../../src/core/persistence';
import {csv, columns} from '../../src/core/logger';
import {scenario, journalCards} from '../../src/content/loadContent';
import {checkProgram, blockingBugs} from '../../src/engine/programCheck';
import type {Session, Program} from '../../src/core/types';

function at(nodeId: string, caseIndex = 0) {
  const session = initial();
  const s = session.state;
  s.phase = 'CASE';
  s.caseIndex = caseIndex;
  s.caseCursor = currentCase(s).flow.indexOf(nodeId);
  s.stage = stageFor(s);
  return session;
}
function run(session: Session, ...actions: Action[]) {
  for (const a of actions) session = act(session, a).session;
  return session;
}

describe('사건 파일: 점수와 전환', () => {
  it('팀마다 따로 감점하고, 지연 결과는 한 번만, 투표 안 한 팀은 그대로', () => {
    let s = run(at('c1d2'), {type: 'vote', team: 1, choice: 'B'}, {type: 'reason', team: 1, key: 'lab'},
      {type: 'vote', team: 2, choice: 'B'}, {type: 'vote', team: 3, choice: 'A'}, {type: 'confirm'});
    expect(s.state.currentChoice).toBe('B');
    expect(s.state.teams[1].health.case1).toBe(10);
    expect(s.state.teams[3].health.case1).toBe(8);
    expect(s.state.teams[4].health.case1).toBe(10);
    expect(s.state.teams[1].evidencePoints).toBe(1);
    expect(run(s, {type: 'confirm'})).toEqual(s);
    s = run(s, {type: 'next'});
    expect(s.state.stage?.sub).toBe('delayed');
    expect(s.state.teams[3].health.case1).toBe(6);
    s = run(s, {type: 'next'});
    expect(s.state.stage?.kind).toBe('history');
  });
  it('동점이면 교사 결정, 표가 없으면 교사가 대신 고른다', () => {
    let s = at('c1d1');
    expect(act(s, {type: 'confirm'}).effect.modal).toBe('noVote');
    const teacher = act(s, {type: 'confirm', choice: 'A'}).session;
    expect(teacher.state.classPath[0].decidedBy).toBe('teacher');
    expect(teacher.state.teams[1].health.case1).toBe(10);
    s = run(s, {type: 'vote', team: 1, choice: 'A'}, {type: 'vote', team: 2, choice: 'B'});
    expect(act(s, {type: 'confirm'}).effect.modal).toBe('tie');
    s = run(s, {type: 'confirm', choice: 'B'});
    expect(s.state.classPath[0].choice).toBe('B');
  });
  it('재선택은 한 번, 앞선 감점은 되돌리지 않는다', () => {
    let s = run(at('c1d2'), {type: 'vote', team: 1, choice: 'A'}, {type: 'confirm'}, {type: 'next'}, {type: 'next'});
    expect(s.state.stage?.sub).toBe('retryOffer');
    s = run(s, {type: 'retry'}, {type: 'vote', team: 1, choice: 'A'}, {type: 'confirm'});
    expect(s.state.teams[1].health.case1).toBe(4);
    s = run(s, {type: 'next'});
    expect(s.state.stage?.kind).toBe('history');
    expect(s.state.classPath.map(p => p.attempt)).toEqual([1, 2]);
  });
  it('빈 예측은 막고, 예측 생략은 기록한다', () => {
    let s = at('predict');
    expect(act(s, {type: 'lock'}).effect.modal).toBe('noPrediction');
    s = run(s, {type: 'skipPrediction'});
    expect(s.state.stage?.kind).toBe('lab');
    expect(s.log.at(-1)?.event).toBe('skipped');
  });
  it('앞 사건 일지 태그는 일지가 생긴 뒤에만', () => {
    let s = run(at('c1d1'), {type: 'vote', team: 1, choice: 'B'});
    expect(act(s, {type: 'reason', team: 1, key: 'journal'}).effect.message).toBeTruthy();
    s.state.journal.push({cardId: 'j-c1d1', caseId: 'case1', decisionId: 'c1d1', classResult: 'solved'});
    s = run(s, {type: 'reason', team: 1, key: 'journal'});
    expect(s.state.draft[1]?.reasons).toEqual(['journal']);
  });
});

describe('연구 일지와 우리 반 알고리즘', () => {
  it('사건 정리(S19)에 들어오면 그 사건의 행동 카드가 반 결과와 함께 일지에 들어간다', () => {
    let s = run(at('c1d1'), {type: 'vote', team: 1, choice: 'A'}, {type: 'confirm'});
    for (let i = 0; i < 30 && s.state.stage?.kind !== 'wrap'; i++) {
      const st = s.state.stage!;
      if (st.kind === 'predict') s = run(s, {type: 'skipPrediction'});
      else if (st.kind === 'lab') s = run(s, {type: 'skipLab'}, {type: 'next'});
      else s = run(s, st.kind === 'decision' && st.sub === 'vote' ? {type: 'confirm', choice: 'B'} : {type: 'next'});
    }
    expect(s.state.journal.map(j => j.cardId)).toEqual(['j-c1d1', 'j-c1d2']);
    expect(s.state.journal[0].classResult).toBe('irreversible');
    expect(s.state.journal[1].classResult).toBe('solved');
  });
  it('카드를 묶음에 넣고 옮기고 빼며, 묶음 수는 최대를 넘지 않는다', () => {
    let s = initial();
    for (let i = 0; i < 8; i++) s = run(s, {type: 'addCluster'});
    expect(s.state.clusters).toHaveLength(scenario.algorithm.clusterMax);
    const [k1, k2] = s.state.clusters.map(c => c.id);
    s = run(s, {type: 'assignCard', key: 'j-c1d1', value: k1}, {type: 'assignCard', key: 'j-c1d1', value: k2});
    expect(s.state.clusters[0].cardIds).toEqual([]);
    expect(s.state.clusters[1].cardIds).toEqual(['j-c1d1']);
    s = run(s, {type: 'assignCard', key: 'j-c1d1', value: ''}, {type: 'assignCard', key: 'nope', value: k1});
    expect(s.state.clusters.flatMap(c => c.cardIds)).toEqual([]);
    s = run(s, {type: 'clusterName', key: k2, value: '살피고 기록하기'}, {type: 'clusterMove', key: k2, value: -1});
    expect(s.state.clusters[0].name).toBe('살피고 기록하기');
  });
  it('행동 카드는 11장이고 숨은 원칙 5종이 모두 들어 있다', () => {
    expect(journalCards).toHaveLength(11);
    expect(new Set(journalCards.map(c => c.hiddenPrinciple)).size).toBe(5);
  });
});

function program(over: Partial<Program['decisions'][number]> = {}): Program {
  return {
    heritage: {name: '첨성대', material: '돌', risk: '돌 틈이 벌어졌어요'}, version: 1,
    decisions: [{
      id: 'p1', owner: 1, situation: '돌 틈이 벌어졌어요. 어떻게 할까요?',
      choices: [
        {key: 'A', label: '사진으로 기록하고 틈을 잰다', result: 'solved', why: '먼저 살폈어요', stepId: 'k1'},
        {key: 'B', label: '시멘트로 메운다', result: 'irreversible', why: '뗄 수 없어요', stepId: ''},
        {key: 'C', label: '', result: '', why: '', stepId: ''},
      ],
      ...over,
    }],
  };
}
const steps = [{id: 'k1', name: '살피고 기록하기', cardIds: ['j-c1d1']}, {id: 'k2', name: '다시 뗄 수 있게', cardIds: ['j-c2d2']}];

describe('프로그램 자동 검사(B1~B6)', () => {
  it('완성된 결정은 막히는 버그가 없고, 안 쓴 단계만 경고(B5)', () => {
    const bugs = checkProgram(program(), steps, scenario.program);
    expect(blockingBugs(bugs)).toEqual([]);
    expect(bugs.map(b => [b.rule, b.stepName])).toEqual([['B5', '다시 뗄 수 있게']]);
  });
  it.each([
    ['B1', {situation: ''}],
    ['B2', {choices: [{key: 'A', label: '기록한다', result: 'solved', why: '', stepId: 'k1'}, {key: 'B', label: '', result: '', why: '', stepId: ''}]}],
    ['B3', {choices: [{key: 'A', label: '덮는다', result: 'worse', why: '', stepId: ''}, {key: 'B', label: '버린다', result: 'irreversible', why: '', stepId: ''}]}],
    ['B4', {choices: [{key: 'A', label: '기록한다', result: 'solved', why: '', stepId: ''}, {key: 'B', label: '버린다', result: 'worse', why: '', stepId: ''}]}],
    ['B6', {choices: [{key: 'A', label: '기록한다', result: 'solved', why: '', stepId: 'k1'}, {key: 'B', label: '기록한다', result: 'worse', why: '', stepId: ''}]}],
  ] as const)('%s를 찾는다', (rule, over) => {
    const bugs = checkProgram(program(over as never), steps, scenario.program);
    expect(bugs.some(b => b.rule === rule && b.severity === 'error')).toBe(true);
  });
  it('결정이 하나도 없으면 B1', () => {
    expect(checkProgram({...program(), decisions: []}, steps, scenario.program)[0].rule).toBe('B1');
  });
});

describe('저녁: 의뢰·프로그램·시험·AI 점검', () => {
  function evening() {
    let s = initial();
    s.state.phase = 'ALGORITHM';
    s.state.subScreen = 1;
    s = run(s, {type: 'addCluster'}, {type: 'assignCard', key: 'j-c1d1', value: 'k1'});
    s.state.teams[2].heritage = '첨성대';
    return run(s, {type: 'next'});
  }
  it('의뢰를 고르기 전에는 넘어가지 않고, BUILD에 들어가면 팀마다 결정 하나가 생긴다', () => {
    let s = evening();
    expect(s.state.phase).toBe('REQUEST');
    expect(act(s, {type: 'next'}).effect.message).toBeTruthy();
    s = run(s, {type: 'requestPick', value: '첨성대'}, {type: 'requestRisk', value: '돌 틈이 벌어졌어요'}, {type: 'next'});
    expect(s.state.phase).toBe('BUILD');
    expect(s.state.program.heritage).toEqual({name: '첨성대', material: '돌', risk: '돌 틈이 벌어졌어요'});
    expect(s.state.program.decisions.map(d => d.owner)).toEqual([1, 2, 3, 4]);
  });
  it('편집은 허용된 값만 받고, 시험은 다른 팀이 하며, 다시 실행하면 버전이 오른다', () => {
    let s = run(evening(), {type: 'requestPick', value: '첨성대'}, {type: 'next'});
    s = run(s,
      {type: 'programEdit', key: 'p1', value: {field: 'situation', text: '틈이 벌어졌어요'}},
      {type: 'programEdit', key: 'p1', choice: 'A', value: {field: 'label', text: '기록한다'}},
      {type: 'programEdit', key: 'p1', choice: 'A', value: {field: 'result', text: 'solved'}},
      {type: 'programEdit', key: 'p1', choice: 'A', value: {field: 'stepId', text: 'k1'}},
      {type: 'programEdit', key: 'p1', choice: 'A', value: {field: 'stepId', text: 'nope'}},
      {type: 'programEdit', key: 'p1', choice: 'B', value: {field: 'result', text: 'bad'}});
    const a = s.state.program.decisions[0].choices[0];
    expect(a).toMatchObject({label: '기록한다', result: 'solved', stepId: 'k1'});
    expect(s.state.program.decisions[0].choices[1].result).toBe('');
    s = run(s, {type: 'next'});
    expect(s.state.phase).toBe('TEST');
    expect(act(s, {type: 'next'}).effect.message).toBeTruthy();
    expect(act(s, {type: 'testVote', choice: 'C'}).effect.message).toBeTruthy();
    s = run(s, {type: 'testVote', choice: 'A'}, {type: 'testNote', value: 'B 길이 비었어요'});
    expect(s.state.testRuns[0]).toMatchObject({decisionId: 'p1', testerTeam: 2, choice: 'A', note: 'B 길이 비었어요', version: 1});
    for (let i = 0; i < 3; i++) s = run(s, {type: 'next'}, {type: 'testVote', choice: 'A'});
    // p2~p4는 빈 결정이라 시험할 길이 없다 → 다음으로 못 간다
    expect(s.state.phase).toBe('TEST');
    expect(s.state.testCursor).toBe(1);
  });
  it('믿음 투표 전후를 팀별로 남긴다', () => {
    let s = initial();
    s.state.phase = 'AI_CHECK';
    s = run(s, {type: 'trust', team: 1, key: 'before', value: 'trust'}, {type: 'trust', team: 1, key: 'after', value: 'distrust'},
      {type: 'trust', team: 2, key: 'before', value: 'maybe'});
    expect(s.state.aiCheck.trust).toEqual({1: {before: 'trust', after: 'distrust'}});
  });
});

/** 하루 전체를 키보드 행동만으로 끝까지 진행하며, 매 단계 저장·복원이 되는지 본다. */
function playDay(profile: '120' | '80', choice: 'A' | 'B' | 'C') {
  let session = initial(profile);
  const phases = new Set<string>();
  for (let i = 0; i < 400; i++) {
    expect(validateSession(session), `${session.state.phase} ${JSON.stringify(session.state.stage)}`).toBe(true);
    expect(parseSession(JSON.stringify(session))).toEqual(session);
    const s = session.state;
    phases.add(s.phase);
    if (s.phase === 'WRAPUP') break;
    if (s.stage?.kind === 'predict') { session = run(session, {type: 'skipPrediction'}); continue; }
    if (s.stage?.kind === 'lab') { session = run(session, {type: 'skipLab'}, {type: 'next'}); continue; }
    if (s.stage?.kind === 'decision' && s.stage.sub === 'vote') {
      const d = decision(s)!;
      const ch = d.choices.some(c => c.key === choice) ? choice : 'B';
      session = run(session, ...teamIds.map(team => ({type: 'vote', team, choice: ch})), {type: 'confirm'});
      continue;
    }
    if (s.phase === 'JOURNAL' && !s.clusters.length) {
      session = run(session, {type: 'addCluster'}, {type: 'addCluster'}, {type: 'addCluster'});
      s.journal.forEach((j, n) => { session = run(session, {type: 'assignCard', key: j.cardId, value: `k${(n % 3) + 1}`}); });
    }
    if (s.phase === 'REQUEST' && !s.program.heritage.name) session = run(session, {type: 'requestPick', value: scenario.heritagePick.examples[0].name});
    if (s.phase === 'BUILD') {
      for (const d of session.state.program.decisions) {
        session = run(session,
          {type: 'programEdit', key: d.id, value: {field: 'situation', text: `상황 ${d.id}`}},
          {type: 'programEdit', key: d.id, choice: 'A', value: {field: 'label', text: '기록한다'}},
          {type: 'programEdit', key: d.id, choice: 'A', value: {field: 'result', text: 'solved'}},
          {type: 'programEdit', key: d.id, choice: 'A', value: {field: 'stepId', text: 'k1'}},
          {type: 'programEdit', key: d.id, choice: 'B', value: {field: 'label', text: '덮어 버린다'}},
          {type: 'programEdit', key: d.id, choice: 'B', value: {field: 'result', text: 'irreversible'}});
      }
    }
    if (s.phase === 'TEST') session = run(session, {type: 'testVote', choice: 'B'});
    if (s.phase === 'DEBUG') session = run(session, {type: 'retest'});
    session = run(session, {type: 'next'});
  }
  return {session, phases};
}

describe('하루 전체와 저장', () => {
  for (const profile of ['120', '80'] as const) for (const choice of ['A', 'B', 'C'] as const) {
    it(`${profile}분 · ${choice}: 퇴근 보고까지 가고 매 단계 복원할 수 있다`, () => {
      const {session, phases} = playDay(profile, choice);
      expect(session.state.phase).toBe('WRAPUP');
      expect(phases.has('BREAK')).toBe(profile === '80');
      for (const p of ['JOURNAL', 'ALGORITHM', 'REQUEST', 'BUILD', 'TEST', 'DEBUG', 'AI_CHECK']) expect(phases.has(p), p).toBe(true);
      expect(session.state.skippedDecisions.sort()).toEqual(['c2d1', 'c3d3', 'c4d2']);
      // 건너뛴 결정의 카드도 일지에 들어온다(docs/12 §3.3)
      expect(session.state.journal).toHaveLength(11);
      expect(session.state.journal.filter(j => j.classResult === null)).toHaveLength(3);
      expect(session.state.testRuns).toHaveLength(4);
      expect(session.state.program.version).toBe(2);
    });
  }
  it.each([null, {}, {schemaVersion: 2}, {schemaVersion: 2, state: [], log: []}])('잘못된 기록 %j는 거부', bad => {
    expect(() => parseSession(JSON.stringify(bad))).toThrow();
  });
  it('재설계 이전(schemaVersion 1) 기록은 OldSessionError', () => {
    expect(() => parseSession(JSON.stringify({schemaVersion: 1, state: {}, log: []}))).toThrow(OldSessionError);
  });
  it('안쪽이 잘못된 상태는 거부한다', () => {
    const s = initial();
    const mutations: ((x: Session) => void)[] = [
      x => { x.state.teams[1].health.case1 = NaN; },
      x => { x.state.phase = 'CASE'; },
      x => { x.state.clusters = [{id: 'k1', name: '', cardIds: ['j-없음']}]; },
      x => { x.state.program.decisions = [{id: 'p1', owner: 1, situation: '', choices: [{key: 'A', label: '', result: '', why: '', stepId: 'k9'}]}]; },
      x => { x.state.aiCheck.trust = {1: {before: 'maybe' as never}}; },
      x => { (x.state as unknown as Record<string, unknown>).algorithmNotes = []; },
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(s);
      mutate(copy);
      expect(validateSession(copy)).toBe(false);
    }
  });
  it('localStorage가 막혀도 저장 실패만 알린다', () => {
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, get() { throw Error('denied'); }});
    expect(save(initial())).toBe(false);
    delete (globalThis as Record<string, unknown>).localStorage;
  });
  it('CSV: BOM, 따옴표, 수식 주입 방어', () => {
    const session = run(initial(), {type: 'next'}, {type: 'next'}, {type: 'morningNote', key: '0', value: '=1,"x"\n'});
    const output = csv(session.log);
    expect(output.startsWith('﻿' + columns.join(','))).toBe(true);
    expect(output).toContain("'=1");
    expect(output).toContain('""x""');
  });
});
