import {describe, it, expect} from 'vitest';
import {validateRoles} from '../../src/content/rules';
import {act, initialRoles, primary, roles, rolesData, validRoles, ROLE_IDS, type RolesAction, type RolesState} from '../../src/roles/engine';
import {SCENE_NAMES} from '../../src/roles/webtoon';

const run = (s: RolesState, ...a: RolesAction[]) => a.reduce((x, y) => act(x, y).state, s);

describe('역할 변신 데이터', () => {
  it('네 역할 · 웹툰 4컷 · 퀴즈 규칙을 지킨다', () => {
    expect(validateRoles(rolesData, SCENE_NAMES)).toEqual([]);
  });
  it('그릴 수 없는 장면과 보기 밖 정답을 잡는다', () => {
    const broken = structuredClone(rolesData);
    broken.roles[0].webtoon[0].scene = 'dragon';
    broken.roles[1].quiz[0].answer = 9;
    const errors = validateRoles(broken, SCENE_NAMES).join();
    expect(errors).toMatch(/record scene dragon/);
    expect(errors).toMatch(/analyze quiz/);
  });
});

describe('역할 변신 진행', () => {
  it('클리커와 맞는 보기만으로 네 역할 모두 변신한다', () => {
    let s = initialRoles();
    for (let i = 0; i < 100 && s.screen !== 'done'; i++) {
      if (s.screen === 'quiz' && !s.solved) s = run(s, {t: 'answer', option: roles.find(r => r.id === s.role)!.quiz[s.q].answer});
      else s = run(s, primary(s)!);
    }
    expect(s.screen).toBe('done');
    expect(s.done).toEqual(ROLE_IDS);
    expect(s.wearing).toBe('undo');
  });
  it('다른 보기를 고르면 넘어가지 않고 고른 기록이 남는다', () => {
    let s = run(initialRoles(), {t: 'start'}, {t: 'enter', role: 'analyze'}, {t: 'toQuiz'});
    const wrong = act(s, {t: 'answer', option: 1});
    expect(wrong.correct).toBe(false);
    expect(primary(wrong.state)).toBeNull();
    s = run(wrong.state, {t: 'answer', option: 0});
    expect(s.tries['analyze:0']).toEqual([1, 0]);
    expect(primary(s)).toEqual({t: 'next'});
  });
  it('어긋난 저장 기록은 버린다', () => {
    const s = run(initialRoles(), {t: 'start'}, {t: 'enter', role: 'record'});
    expect(validRoles(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(validRoles({...s, role: 'wizard'})).toBeNull();
    expect(validRoles({...s, q: 9})).toBeNull();
    expect(validRoles(null)).toBeNull();
  });
});
