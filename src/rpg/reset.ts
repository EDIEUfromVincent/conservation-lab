import {el, button} from '../ui/dom';
import {rpg} from './hero';
import './style.css';

// 학생용 '다시하기': 이번 활동만 지우거나(사건 하나·미니게임 하나·갈래길 등), 이 기기의 모든 기록을 지우고 처음부터.
// 브라우저 기본 대화상자 대신 앱 안 창을 쓴다. 열려 있는 동안 키를 먼저 가로챈다(1·2·3, Esc).

export type ResetScope = 'case' | 'missions' | 'roles' | 'game' | 'games';
const PREFIX = 'cons-lab:';
const START = '?mode=roles';

/** 이 기기에 남은 이 앱의 기록을 모두 지운다(저장소를 못 쓰면 조용히 넘어간다) */
export function clearAll() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) keys.push(k); }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* 저장소를 쓸 수 없어도 수업은 계속된다 */
  }
}

/** HUD에 넣는 '↺ 다시하기' 버튼. activity는 이번 활동 기록만 지우는 함수 */
export function resetButton(stage: HTMLElement, scope: ResetScope, activity: () => void, compact = false) {
  return button(compact ? '↺' : `↺ ${rpg.reset.button}`, () => openReset(stage, scope, activity),
    {class: 'ms-pill rs-btn' + (compact ? ' rs-compact' : ''), 'data-testid': 'reset', 'aria-label': rpg.reset.button, title: rpg.reset.button});
}

export function openReset(stage: HTMLElement, scope: ResetScope, activity: () => void) {
  if (stage.querySelector('.rs-modal')) return;
  const R = rpg.reset;
  const scrim = el('div', {class: 'ms-scrim rs-scrim'});
  const box = el('section', {class: 'ms-card rs-modal pop', role: 'dialog', 'aria-label': R.title, 'data-testid': 'reset-modal'});
  stage.append(scrim, box);
  let keys: Record<string, () => void> = {};
  const close = () => { window.removeEventListener('keydown', onKey, true); scrim.remove(); box.remove(); };
  const choice = (n: number, label: string, note: string, fn: () => void, id: string, primary = false) => {
    keys[String(n)] = fn;
    const b = button('', fn, {class: 'ms-choice rs-choice' + (primary ? ' rs-danger' : ''), 'data-testid': id});
    b.append(el('span', {class: 'ms-letter'}, String(n)), el('span', {class: 'rs-text'}, el('strong', {}, label), note ? el('span', {}, note) : null));
    return b;
  };
  const first = () => {
    keys = {};
    box.replaceChildren(el('h1', {}, `↺ ${R.title}`),
      choice(1, R.activity, R.scopes[scope], () => { activity(); location.reload(); }, 'reset-activity'),
      choice(2, R.all, R.allNote, confirmAll, 'reset-all'),
      choice(3, R.cancel, '', close, 'reset-cancel'));
  };
  const confirmAll = () => {
    keys = {};
    box.replaceChildren(el('h1', {}, `⚠ ${R.all}`), el('p', {class: 'rs-warn'}, R.allWarn),
      choice(1, R.allYes, '', () => { clearAll(); location.search = START; }, 'reset-yes', true),
      choice(2, R.allNo, '', first, 'reset-no'));
  };
  function onKey(e: KeyboardEvent) {
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    const fn = keys[e.key];
    if (fn) { e.preventDefault(); fn(); }
  }
  window.addEventListener('keydown', onKey, true);
  first();
}
