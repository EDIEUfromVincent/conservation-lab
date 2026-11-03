import {describe, it, expect} from 'vitest';
import {scenario, manuals} from '../../src/content/loadContent';
import {validateMissions} from '../../src/content/rules';
import {roles} from '../../src/roles/engine';
import {
  act, initialMission, primary, missions, missionFor, hint, facts, unlocked, validMission, lastOutcome, decisionOf, caseOf, NONE,
  type MissionAction, type MissionState,
} from '../../src/mission/engine';

const run = (s: MissionState, ...actions: MissionAction[]) => actions.reduce((x, a) => act(x, a).state, s);
const m = missionFor('case1');

/** 클리커 '다음'과 맞는 카드·첫 사실만으로 끝까지 간다. 결정마다 key를 고르고, 없는 키면 A를 고른다. */
function playThrough(key: 'A' | 'B' | 'C', caseId = 'case1') {
  const mission = missionFor(caseId);
  let s = run(initialMission(caseId), {t: 'pickExpert', id: caseOf(caseId).lead});
  for (let i = 0; i < 300 && s.screen !== 'complete'; i++) {
    if (s.screen === 'clue' && !s.solved.includes(s.clue!)) s = run(s, {t: 'answer', option: mission.clues.find(c => c.id === s.clue)!.answer});
    else if (s.screen === 'lab') s = run(s, {t: 'labDone'});
    else if (s.screen === 'decision') {
      const k = decisionOf(caseId, s.decision!).choices.some(c => c.key === key) ? key : 'A';
      s = run(s, {t: 'choose', key: k}, {t: 'reason', id: facts(s)[0].id}, {t: 'commit'});
    } else {
      const p = primary(s);
      if (!p) throw new Error(`stuck at ${caseId} ${s.screen}`);
      s = run(s, p);
    }
  }
  return s;
}

describe('3D 미션 데이터', () => {
  it('규칙 검사를 통과한다', () => {
    expect(validateMissions(missions, scenario, manuals, roles)).toEqual([]);
  });
  it('단서마다 보기 안에 상관없는 단서 카드가 있고, 힌트 카드는 매뉴얼 표의 실제 줄이다', () => {
    for (const c of m.clues) {
      expect(c.options).toContain(NONE);
      for (const o of c.options.filter(o => o !== NONE)) expect(hint(o), o).not.toBeNull();
    }
  });
  it('잘못된 정답·없는 카드·장소 밖 단서를 잡는다', () => {
    const broken = structuredClone(missions);
    broken[0].clues[0].answer = 'glass:0';
    broken[0].clues[1].options.push('metal:9');
    broken[0].places[0].clues.push('c1-rust');
    broken[1].clues[0].options[0] = 'journal:j-c3d1';   // 뒤 사건의 일지는 힌트로 쓸 수 없다
    const errors = validateMissions(broken, scenario, manuals).join('\n');
    expect(errors).toMatch(/c1-green answer not in options/);
    expect(errors).toMatch(/unknown hint metal:9/);
    expect(errors).toMatch(/c1-rust must be in exactly one place/);
    expect(errors).toMatch(/c2-pieces unknown hint journal:j-c3d1/);
  });
});

describe('3D 미션 진행', () => {
  it('결정은 필요한 사실을 모두 알아내기 전까지 잠겨 있다', () => {
    let s = run(initialMission(), {t: 'pickExpert', id: 'metal'}, {t: 'start'});
    const tryOpen = act(s, {t: 'decision', id: 'c1d1'});
    expect(tryOpen.effect.message).toBe('locked');
    expect(tryOpen.state.screen).toBe('map');
    s = run(s, {t: 'place', id: 'outside'}, {t: 'open', id: 'c1-green'}, {t: 'answer', option: 'metal:1'});
    expect(unlocked(s, 'c1d1')).toBe(true);
    expect(unlocked(s, 'c1d2')).toBe(false);
  });

  it('다른 카드를 고르면 풀리지 않고, 고른 순서가 남는다', () => {
    let s = run(initialMission(), {t: 'pickExpert', id: 'metal'}, {t: 'start'}, {t: 'place', id: 'outside'}, {t: 'open', id: 'c1-green'});
    const wrong = act(s, {t: 'answer', option: 'metal:2'});
    expect(wrong.effect.correct).toBe(false);
    expect(primary(wrong.state)).toBeNull();
    s = run(wrong.state, {t: 'answer', option: 'metal:1'});
    expect(s.tries['c1-green']).toEqual(['metal:2', 'metal:1']);
    expect(s.solved).toContain('c1-green');
  });

  it('상관없는 단서는 풀어도 근거 사실로 쓰지 않는다', () => {
    const s = run(initialMission(), {t: 'pickExpert', id: 'metal'}, {t: 'start'}, {t: 'place', id: 'outside'}, {t: 'open', id: 'c1-sign'}, {t: 'answer', option: NONE});
    expect(s.solved).toEqual(['c1-sign']);
    expect(facts(s)).toEqual([]);
  });

  it('실습을 마치기 전에는 실습 결과 단서를 열 수 없다', () => {
    let s = run(initialMission(), {t: 'pickExpert', id: 'metal'}, {t: 'start'}, {t: 'place', id: 'lab'});
    expect(primary(s)).toEqual({t: 'lab'});
    expect(run(s, {t: 'open', id: 'c1-lab'}).screen).toBe('place');
    s = run(s, {t: 'lab'}, {t: 'labDone'});
    expect(s.screen).toBe('clue');
    expect(s.clue).toBe('c1-lab');
  });

  it('근거 사실 없이 결정할 수 없다', () => {
    let s = run(initialMission(), {t: 'pickExpert', id: 'metal'}, {t: 'start'}, {t: 'place', id: 'outside'}, {t: 'open', id: 'c1-green'}, {t: 'answer', option: 'metal:1'},
      {t: 'map'}, {t: 'decision', id: 'c1d1'}, {t: 'choose', key: 'B'});
    expect(act(s, {t: 'commit'}).effect.message).toBe('needReason');
    s = run(s, {t: 'reason', id: 'c1-sign'});
    expect(s.draft.reason).toBe('');
  });

  it('나빠진 결과는 시간을 빨리 감은 뒤 다시 고를 수 있다', () => {
    let s = playThrough('B');
    expect(s.screen).toBe('complete');
    s = run(initialMission(), {t: 'pickExpert', id: 'metal'}, {t: 'start'});
    for (const [place, clue, card] of [['inside', 'c1-rust', 'metal:0'], ['inside', 'c1-contact', 'metal:3']])
      s = run(s, {t: 'place', id: place}, {t: 'open', id: clue}, {t: 'answer', option: card});
    s = run(s, {t: 'place', id: 'lab'}, {t: 'lab'}, {t: 'labDone'}, {t: 'answer', option: 'metal:3'},
      {t: 'map'}, {t: 'decision', id: 'c1d2'}, {t: 'choose', key: 'A'}, {t: 'reason', id: 'c1-contact'}, {t: 'commit'});
    expect(lastOutcome(s, 'c1d2')!.result).toBe('worse');
    expect(primary(s)).toEqual({t: 'forward'});
    s = run(s, {t: 'forward'}, {t: 'retry'});
    expect(s.screen).toBe('decision');
    expect(s.draft.reason).toBe('c1-contact');
    s = run(s, {t: 'choose', key: 'B'}, {t: 'commit'}, {t: 'proceed'});
    expect(s.attempts.c1d2.map(a => a.choice)).toEqual(['A', 'B']);
    expect(s.closed).toEqual(['c1d2']);
  });

  it.each(missions.map(x => x.caseId))('%s: 클리커와 맞는 카드만으로 모든 결과 노드에 갈 수 있다', caseId => {
    const mission = missionFor(caseId);
    const seen = new Set<string>();
    for (const k of ['A', 'B', 'C'] as const) {
      const s = playThrough(k, caseId);
      expect(s.screen).toBe('complete');
      expect(s.solved).toHaveLength(mission.clues.length);
      for (const g of mission.decisions) seen.add(lastOutcome(s, g.id)!.id);
    }
    const all = mission.decisions.flatMap(g => decisionOf(caseId, g.id).choices.map(c => c.outcome));
    expect([...seen].sort()).toEqual(all.sort());
  });

  it('앞 결정을 마쳐야 열리는 장소가 있다(사건 3 수염 이음매)', () => {
    let s = run(initialMission('case3'), {t: 'pickExpert', id: 'adhesive'}, {t: 'start'});
    const tryGo = act(s, {t: 'place', id: 'joint'});
    expect(tryGo.effect.message).toBe('placeLocked');
    s = run(s, {t: 'place', id: 'showcase'}, {t: 'open', id: 'c3-beard'}, {t: 'answer', option: 'journal:j-c2d1'},
      {t: 'map'}, {t: 'decision', id: 'c3d1'}, {t: 'choose', key: 'B'}, {t: 'reason', id: 'c3-beard'}, {t: 'commit'}, {t: 'proceed'},
      {t: 'place', id: 'joint'});
    expect(s.screen).toBe('place');
  });

  it('힌트 카드는 매뉴얼 표 줄, 꼭 기억해요, 앞 사건의 연구 일지 세 가지다', () => {
    expect(hint('metal:0')).toMatchObject({kind: 'row', cause: expect.any(String)});
    expect(hint('glass:k3')).toMatchObject({kind: 'idea'});
    expect(hint('journal:j-c2d1')).toMatchObject({kind: 'journal', caseOrder: 2});
    expect(hint('metal:k9')).toBeNull();
    expect(hint('journal:j-zz')).toBeNull();
  });
});

describe('사건 발생: 전문가 보내기', () => {
  it('주도 전문가를 골라야 조사를 시작하고, 함께 일할 전문가와 다른 전문가는 알려 준다', () => {
    let s = initialMission('case1');
    expect(primary(s)).toBeNull();
    expect(act(s, {t: 'start'}).effect.message).toBe('needExpert');
    const support = act(s, {t: 'pickExpert', id: 'adhesive'});
    expect(support.effect).toMatchObject({correct: false, support: true});
    const other = act(support.state, {t: 'pickExpert', id: 'glass'});
    expect(other.effect).toMatchObject({correct: false, support: false});
    s = run(other.state, {t: 'pickExpert', id: 'metal'});
    expect(s.expertTries).toEqual(['adhesive', 'glass', 'metal']);
    expect(primary(s)).toEqual({t: 'start'});
  });
});

describe('네 역할', () => {
  it.each(missions.map(x => x.caseId))('%s: 기록·분석·재료·되돌리기 단서가 모두 있다', caseId => {
    expect(new Set(missionFor(caseId).clues.map(c => c.role))).toEqual(new Set(['record', 'analyze', 'material', 'undo']));
  });
  it('역할 변신에서 배운 줄도 힌트 카드가 된다', () => {
    expect(hint('role:record:1')).toMatchObject({kind: 'role', label: '기록'});
    expect(hint('role:record:9')).toBeNull();
  });
  it('역할이 빠진 사건을 잡는다', () => {
    const broken = structuredClone(missions);
    broken[0].clues.forEach(c => { if (c.role === 'undo') c.role = 'record'; });
    expect(validateMissions(broken, scenario, manuals).join()).toMatch(/case1 has no undo clue/);
  });
});

describe('3D 미션 저장 기록', () => {
  it('진행 중 기록은 그대로 읽고, 어긋난 기록은 버린다', () => {
    const s = run(initialMission(), {t: 'pickExpert', id: 'metal'}, {t: 'start'}, {t: 'place', id: 'outside'}, {t: 'open', id: 'c1-green'});
    expect(validMission(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(validMission({...s, expertTries: []})).toBeNull();
    expect(validMission({...s, screen: 'boss'})).toBeNull();
    expect(validMission({...s, solved: ['c9']})).toBeNull();
    expect(validMission({...s, clue: null})).toBeNull();
    expect(validMission({...s, attempts: {c1d1: [{choice: 'D', reason: 'c1-green'}]}})).toBeNull();
    expect(validMission(null)).toBeNull();
  });
});
