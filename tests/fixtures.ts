import {act, initial, teamIds, type Action} from '../src/core/actions';
import {decision} from '../src/core/caseRunner';
import {scenario} from '../src/content/loadContent';
import type {Phase, Session} from '../src/core/types';

export function run(session: Session, ...actions: Action[]) {
  for (const a of actions) session = act(session, a).session;
  return session;
}

const STEP_NAMES = ['살피고 기록하기', '진짜 까닭 찾기', '다시 뗄 수 있게'];

/** 엔진 행동만으로 하루를 진행해 원하는 단계·하위 화면의 상태를 만든다(레이아웃 캡처·단위 테스트용). */
export function playUntil(target: Phase | null, profile: '120' | '80' = '120', choice: 'A' | 'B' | 'C' = 'B', subScreen = 0) {
  let session = initial(profile);
  for (let i = 0; i < 400; i++) {
    const s = session.state;
    if (s.phase === 'WRAPUP') return session;
    if (s.phase === 'TEAM_SETUP') {
      const names = scenario.heritagePick.examples.map(x => x.name);
      for (const t of teamIds) session = run(session, {type: 'teamHeritage', team: t, value: names[t % 2]}, {type: 'vote', team: t, choice: 'A'});
      session = run(session, {type: 'tally', key: names[1], value: 1}, {type: 'tally', key: names[1], value: 1}, {type: 'tally', key: names[0], value: 1});
    }
    if (s.phase === 'VIDEO' && s.subScreen === 0) {
      session = run(session,
        {type: 'morningNote', key: '0', value: '조명을 비추고 돋보기로 봤어요'},
        {type: 'morningNote', key: '1', value: '돋보기, 조명, 공책'},
        {type: 'morningNote', key: '2', value: '그림을 그리고 적었어요'});
    }
    if (s.stage?.kind === 'predict') { session = run(session, {type: 'skipPrediction'}); continue; }
    if (s.stage?.kind === 'lab') { session = run(session, {type: 'skipLab'}, {type: 'next'}); continue; }
    if (s.stage?.kind === 'decision' && s.stage.sub === 'vote') {
      const d = decision(s)!;
      const ch = d.choices.some(c => c.key === choice) ? choice : 'B';
      session = run(session, ...teamIds.map(team => ({type: 'vote', team, choice: ch} as Action)), {type: 'reason', team: 1, key: 'lab'}, {type: 'confirm'});
      continue;
    }
    if (s.phase === 'JOURNAL' && !s.clusters.length) {
      session = run(session, {type: 'addCluster'}, {type: 'addCluster'}, {type: 'addCluster'});
      const group: Record<string, string> = {P1: 'k1', P5: 'k1', P2: 'k2', P4: 'k2', P3: 'k3'};
      for (const d of scenario.cases.flatMap(c => c.nodes)) {
        if (d.type === 'decision') session = run(session, {type: 'assignCard', key: d.journal.id, value: group[d.journal.hiddenPrinciple]});
      }
    }
    if (s.phase === 'ALGORITHM' && s.subScreen === 0) {
      session.state.clusters.forEach((c, n) => { session = run(session, {type: 'clusterName', key: c.id, value: STEP_NAMES[n]}); });
    }
    if (s.phase === 'REQUEST' && !s.program.heritage.name) {
      session = run(session, {type: 'requestPick', value: scenario.heritagePick.examples[1].name}, {type: 'requestRisk', value: '비바람에 돌 틈이 벌어졌어요'});
    }
    if (s.phase === 'BUILD' && !s.program.decisions[0]?.situation) {
      const texts = [
        ['돌 틈이 벌어졌어요. 무엇부터 할까요?', '사진을 찍고 틈의 길이를 잰다', '바로 시멘트로 메운다'],
        ['틈의 까닭을 어떻게 찾을까요?', '비가 스미는 길을 살펴본다', '틈만 보고 결론 낸다'],
        ['틈을 무엇으로 메울까요?', '나중에 뗄 수 있는 재료를 시험한다', '가장 센 접착제를 붓는다'],
        ['떨어진 돌 조각은 어떻게 할까요?', '번호를 달고 보관한다', '작은 조각은 버린다'],
      ];
      session.state.program.decisions.forEach((d, n) => {
        const [situation, good, bad] = texts[n];
        session = run(session,
          {type: 'programEdit', key: d.id, value: {field: 'situation', text: situation}},
          {type: 'programEdit', key: d.id, choice: 'A', value: {field: 'label', text: good}},
          {type: 'programEdit', key: d.id, choice: 'A', value: {field: 'result', text: 'solved'}},
          {type: 'programEdit', key: d.id, choice: 'A', value: {field: 'why', text: '원래 모습을 지켰어요'}},
          {type: 'programEdit', key: d.id, choice: 'A', value: {field: 'stepId', text: `k${(n % 3) + 1}`}},
          {type: 'programEdit', key: d.id, choice: 'B', value: {field: 'label', text: bad}},
          {type: 'programEdit', key: d.id, choice: 'B', value: {field: 'result', text: n === 1 ? '' : 'irreversible'}});
      });
    }
    if (s.phase === 'TEST' && !s.testRuns.some(r => r.decisionId === s.program.decisions[s.testCursor].id)) {
      session = run(session, {type: 'testVote', choice: 'B'});
      if (s.testCursor === 1) session = run(session, {type: 'testNote', value: 'B 길의 결과가 비어 있어요'});
    }
    if (s.phase === 'AI_CHECK') {
      session = run(session,
        {type: 'pasteAI', value: {model: '(교사 입력 예시)', date: '2026-11-03', text: '1. 먼저 사진을 찍어 상태를 기록해요.\n2. 틈에 시멘트를 채워 단단히 고정해요.\n3. 전문가와 상의해요.'}},
        ...teamIds.map(t => ({type: 'trust', team: t, key: 'before', value: t < 3 ? 'trust' : 'unsure'} as Action)));
      if (s.subScreen === 1) session.state.clusters.forEach((c, n) => { session = run(session, {type: 'aiStep', key: c.id, value: n === 1 ? 'missed' : 'kept'}); });
      if (s.subScreen === 2) for (const t of teamIds) session = run(session, {type: 'trust', team: t, key: 'after', value: 'unsure'});
    }
    // 단계마다 채울 것을 채운 뒤에 멈춘다
    if (target && s.phase === target && s.subScreen === subScreen) return session;
    session = run(session, {type: 'next'});
  }
  return session;
}
