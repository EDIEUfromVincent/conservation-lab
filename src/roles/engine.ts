import raw from '../../data/roles.json' with {type: 'json'};
import type {Panel} from './webtoon';

// 역할 변신 갈래길: 길(역할)마다 웹툰 4컷 → 퀴즈 → 변신. 화면과 무관한 순수 상태 전이.

export type RoleId = 'record' | 'analyze' | 'material' | 'undo';
export const ROLE_IDS: RoleId[] = ['record', 'analyze', 'material', 'undo'];
export interface Quiz {q: string; options: string[]; answer: number; why: string}
export interface Role {id: RoleId; name: string; motto: string; color: string; tool: string; does: string[]; webtoon: Panel[]; quiz: Quiz[]}
export const rolesData = raw as {title: string; intro: string; done: string; roles: Role[]};
export const roles = rolesData.roles;
export const roleOf = (id: string) => roles.find(r => r.id === id);
/** 갈래길 끝 문의 자리(3D 무대의 네 자리) */
export const ROLE_SLOT: Record<RoleId, 'main' | 'detail' | 'archive' | 'lab'> = {record: 'archive', analyze: 'main', material: 'detail', undo: 'lab'};

export type RolesScreen = 'intro' | 'map' | 'webtoon' | 'quiz' | 'transform' | 'done';
export const ROLES_SCREENS: RolesScreen[] = ['intro', 'map', 'webtoon', 'quiz', 'transform', 'done'];
export interface RolesState {
  version: 1;
  screen: RolesScreen;
  role: RoleId | null;
  q: number;                          // 지금 문제 번호
  solved: boolean;                    // 지금 문제를 맞혔는지
  tries: Record<string, number[]>;    // '역할:문제'별 고른 보기
  done: RoleId[];
  wearing: RoleId | null;             // 지금 입은 역할 옷
}
export type RolesAction =
  | {t: 'start'} | {t: 'map'} | {t: 'enter'; role: RoleId} | {t: 'toQuiz'}
  | {t: 'answer'; option: number} | {t: 'next'} | {t: 'finish'};

export const initialRoles = (): RolesState =>
  ({version: 1, screen: 'intro', role: null, q: 0, solved: false, tries: {}, done: [], wearing: null});

export function primary(s: RolesState): RolesAction | null {
  switch (s.screen) {
    case 'intro': return {t: 'start'};
    case 'map': {
      const next = ROLE_IDS.find(id => !s.done.includes(id));
      return next ? {t: 'enter', role: next} : null;
    }
    case 'webtoon': return {t: 'toQuiz'};
    case 'quiz': return s.solved ? {t: 'next'} : null;
    case 'transform': return {t: 'finish'};
    case 'done': return null;
  }
}

export function act(prev: RolesState, a: RolesAction): {state: RolesState; correct?: boolean} {
  const s = structuredClone(prev);
  let correct: boolean | undefined;
  const role = s.role ? roleOf(s.role)! : null;
  switch (a.t) {
    case 'start': if (s.screen === 'intro') s.screen = 'map'; break;
    case 'map': s.screen = s.done.length === ROLE_IDS.length ? 'done' : 'map'; s.role = null; break;
    case 'enter':
      if (!ROLE_IDS.includes(a.role)) break;
      Object.assign(s, {screen: 'webtoon', role: a.role, q: 0, solved: false});
      break;
    case 'toQuiz': if (s.screen === 'webtoon') Object.assign(s, {screen: 'quiz', q: 0, solved: false}); break;
    case 'answer': {
      if (s.screen !== 'quiz' || !role || s.solved) break;
      const quiz = role.quiz[s.q];
      if (!Number.isInteger(a.option) || a.option < 0 || a.option >= quiz.options.length) break;
      (s.tries[`${role.id}:${s.q}`] ??= []).push(a.option);
      correct = a.option === quiz.answer;
      s.solved = correct;
      break;
    }
    case 'next':
      if (s.screen !== 'quiz' || !role || !s.solved) break;
      if (s.q + 1 < role.quiz.length) Object.assign(s, {q: s.q + 1, solved: false});
      else {
        s.screen = 'transform';
        if (!s.done.includes(role.id)) s.done.push(role.id);
        s.wearing = role.id;
      }
      break;
    case 'finish':
      if (s.screen !== 'transform') break;
      s.role = null;
      s.screen = s.done.length === ROLE_IDS.length ? 'done' : 'map';
      break;
  }
  return {state: s, correct};
}

/** 저장 기록 검사: 하나라도 어긋나면 null */
export function validRoles(v: unknown): RolesState | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as RolesState;
  const isRole = (x: unknown) => ROLE_IDS.includes(x as RoleId);
  if (s.version !== 1 || !ROLES_SCREENS.includes(s.screen)) return null;
  if (!(s.role === null || isRole(s.role)) || !(s.wearing === null || isRole(s.wearing))) return null;
  if (!Array.isArray(s.done) || !s.done.every(isRole) || typeof s.solved !== 'boolean') return null;
  if (!Number.isInteger(s.q) || s.q < 0 || (s.role && s.q >= roleOf(s.role)!.quiz.length)) return null;
  if (!s.tries || typeof s.tries !== 'object' || !Object.values(s.tries).every(x => Array.isArray(x) && x.every(Number.isInteger))) return null;
  if (['webtoon', 'quiz', 'transform'].includes(s.screen) && !s.role) return null;
  return s;
}
