import {safeGet, safeSet} from '../core/persistence';
import {el, button, add} from '../ui/dom';
import {fitStage} from '../ui/stage';
import {RL} from '../roles/labels';
import {webtoon, roleIcon} from '../roles/webtoon';
import {act, initialRoles, primary, roles, roleOf, rolesData, validRoles, ROLE_IDS, ROLE_SLOT, type RoleId, type RolesAction, type RolesState} from '../roles/engine';
import {mountScene, type SceneHandle} from '../mission/scene';
import {joystick} from '../mission/joystick';
import {rankBadge, starredCases} from '../mission/progress';
import '../mission/style.css';
import '../roles/style.css';

const KEY = 'cons-lab:roles';
const LETTERS = ['A', 'B', 'C', 'D'];

/** 역할 변신 갈래길(?mode=roles). 네 갈래길 끝 문으로 들어가 웹툰 → 퀴즈 → 변신. */
export function mountRoles(root: HTMLElement) {
  document.title = RL.docTitle;
  let state = load();
  const view = {picked: -1, near: null as string | null};

  const stage = el('div', {id: 'stage', class: 'ms rl'});
  const world = el('div', {class: 'ms-world'});
  const hud = el('div', {class: 'ms-hud'});
  const layer = el('div', {class: 'ms-layer'});
  stage.append(world, hud, layer, el('div', {class: 'ms-keys'}, RL.keys));
  root.replaceChildren(stage);
  fitStage();
  window.addEventListener('resize', fitStage);

  const scene: SceneHandle = mountScene(world, 'roles', roles.map(r => ({id: r.id, slot: ROLE_SLOT[r.id], name: `${r.name} ${RL.role}`, color: r.color})), id => {
    view.near = id;
    if (state.screen === 'map') render();
  });
  if (!scene.ok) {
    world.classList.add('flat');
    world.append(el('p', {class: 'ms-nogl'}, RL.noGL));
  }
  if (state.wearing) scene.setOutfit(roleOf(state.wearing)!.color);

  function load(): RolesState {
    try {
      return validRoles(JSON.parse(safeGet(KEY) ?? 'null')) ?? initialRoles();
    } catch {
      return initialRoles();
    }
  }

  function dispatch(a: RolesAction) {
    const before = state;
    const r = act(state, a);
    state = r.state;
    view.picked = a.t === 'answer' ? a.option : -1;
    safeSet(KEY, JSON.stringify(state));
    if (state.role !== before.role) scene.goTo(state.role);
    if (state.screen === 'transform' && before.screen !== 'transform') scene.setOutfit(roleOf(state.role!)!.color, true);
    if (state.screen !== 'map') { held.clear(); joy.release(); push(); }
    render();
  }

  function render() {
    stage.dataset.screen = state.screen;
    stage.dataset.role = state.role ?? '';
    stage.dataset.near = state.screen === 'map' ? view.near ?? '' : '';
    for (const r of roles) scene.mark(r.id, {left: 1, done: state.done.includes(r.id), active: state.role === r.id, locked: false});
    // 지도는 오른쪽 패널, 변신은 오른쪽 카드: 연구원이 왼쪽에 보이게 장면을 옮긴다
    scene.setShift(state.screen === 'map' ? 0.15 : state.screen === 'transform' ? 0.24 : 0, 0);
    hud.replaceChildren(add(el('div', {class: 'ms-hud-row'}),
      el('a', {class: 'ms-pill ms-list', href: '?mode=teacher'}, `☰ ${RL.backLesson}`),
      el('div', {class: 'ms-pill ms-file'}, el('strong', {}, rolesData.title)),
      el('div', {class: 'ms-hud-right'}, el('div', {class: 'ms-pill ms-rank'}, rankBadge(starredCases().length)), el('div', {class: 'ms-pill ms-count', 'data-testid': 'role-count'},
        `${RL.progress} `, el('strong', {}, `${state.done.length}/${ROLE_IDS.length}`)))));
    layer.replaceChildren();
    ({intro: introView, map: mapView, webtoon: webtoonView, quiz: quizView, transform: transformView, done: doneView})[state.screen]();
    layer.querySelectorAll('[data-primary]').forEach(b => b.classList.toggle('is-next', !!primary(state)));
  }

  const primaryButton = (label: string, a: RolesAction, attrs: Record<string, unknown> = {}) =>
    button(label, () => dispatch(a), {class: 'ms-btn primary', 'data-primary': '', ...attrs});
  const badge = (id: RoleId) => { const r = roleOf(id)!; return el('span', {class: 'rl-badge', style: `--rc:${r.color}`}, roleIcon(r.id, r.color), `${r.name} ${RL.role}`); };

  function introView() {
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card rl-intro pop'},
      el('h1', {}, rolesData.title),
      el('p', {class: 'ms-sub'}, rolesData.intro),
      el('div', {class: 'rl-four'}, ...roles.map(r => el('div', {class: 'rl-mini', style: `--rc:${r.color}`}, roleIcon(r.id, r.color), el('strong', {}, `${r.name} ${RL.role}`), el('span', {}, r.motto)))),
      el('div', {class: 'ms-actions'}, primaryButton('→', {t: 'start'}))));
  }

  function mapView() {
    const next = primary(state);
    layer.append(el('section', {class: 'ms-side pop'},
      el('h2', {}, rolesData.title),
      el('div', {class: 'ms-places'}, ...roles.map((r, i) => {
        const done = state.done.includes(r.id);
        const row = button('', () => dispatch({t: 'enter', role: r.id}), {
          class: 'ms-place rl-row' + (done ? ' done' : '') + (next?.t === 'enter' && next.role === r.id ? ' suggest' : '') + (view.near === r.id ? ' near' : ''),
          'data-role': r.id, 'data-primary': next?.t === 'enter' && next.role === r.id ? '' : false, style: `--rc:${r.color}`,
        });
        row.append(el('span', {class: 'ms-place-icon'}, roleIcon(r.id, r.color)),
          el('span', {class: 'ms-row-text'}, el('strong', {}, `${r.name} ${RL.role}`), el('span', {class: 'ms-place-state'}, done ? `✓ ${RL.learned}` : r.motto)),
          el('span', {class: 'ms-num'}, i + 1));
        return row;
      }))));
    if (scene.ok) layer.append(joy.el);
    const near = view.near ? roleOf(view.near) : undefined;
    if (near) {
      const enter = button('', () => dispatch({t: 'enter', role: near.id}), {class: 'ms-enter pop', 'data-testid': 'enter'});
      enter.append(el('span', {class: 'ms-key'}, 'E'), el('strong', {}, `${near.name} ${RL.role}`), ` ${RL.enter}`);
      layer.append(enter);
    }
  }

  function webtoonView() {
    const r = roleOf(state.role!)!;
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card rl-webtoon pop', style: `--rc:${r.color}`},
      el('div', {class: 'rl-head'}, badge(r.id), el('h1', {}, r.motto)),
      webtoon(r.webtoon, r.color),
      el('div', {class: 'ms-actions'},
        button(RL.backMap, () => dispatch({t: 'map'}), {class: 'ms-btn'}),
        primaryButton(RL.toQuiz + ' →', {t: 'toQuiz'}))));
  }

  function quizView() {
    const r = roleOf(state.role!)!;
    const quiz = r.quiz[state.q];
    const tried = state.tries[`${r.id}:${state.q}`] ?? [];
    const wrongNow = view.picked >= 0 && view.picked !== quiz.answer;
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card rl-quiz pop', style: `--rc:${r.color}`},
      el('div', {class: 'rl-head'}, badge(r.id), el('span', {class: 'ms-band'}, `${RL.quizNo} ${state.q + 1} / ${r.quiz.length}`)),
      el('h1', {}, quiz.q),
      el('div', {class: 'rl-options'}, ...quiz.options.map((o, i) => {
        const b = button('', () => dispatch({t: 'answer', option: i}), {
          class: 'ms-choice' + (state.solved && i === quiz.answer ? ' right' : '') + (tried.includes(i) && i !== quiz.answer ? ' tried' : '') + (view.picked === i && wrongNow ? ' shake' : ''),
          disabled: state.solved || (tried.includes(i) && i !== quiz.answer), 'data-option': i,
        });
        b.append(el('span', {class: 'ms-letter'}, LETTERS[i]), el('strong', {}, o));
        return b;
      })),
      state.solved
        ? el('div', {class: 'ms-found flip', 'data-testid': 'quiz-right'}, el('span', {class: 'ms-found-mark'}, '✓'), el('div', {}, el('p', {class: 'ms-found-title'}, RL.right), el('p', {}, quiz.why)))
        : wrongNow ? el('p', {class: 'rl-again'}, RL.tryAgain) : null,
      el('div', {class: 'ms-actions'},
        button(RL.backMap, () => dispatch({t: 'map'}), {class: 'ms-btn'}),
        state.solved ? primaryButton((state.q + 1 < r.quiz.length ? RL.next : RL.transform) + ' →', {t: 'next'}) : null)));
  }

  function transformView() {
    const r = roleOf(state.role!)!;
    layer.append(el('section', {class: 'ms-card rl-transform pop', style: `--rc:${r.color}`, 'data-testid': 'transform'},
      el('div', {class: 'rl-burst', 'aria-hidden': 'true'}, roleIcon(r.id, r.color)),
      el('p', {class: 'ms-band'}, RL.transform),
      el('h1', {}, `${RL.becameA} ${r.name} ${RL.role}!`),
      el('p', {class: 'rl-motto'}, r.motto),
      el('div', {class: 'rl-does'}, el('p', {class: 'ms-label'}, RL.does), el('ul', {}, ...r.does.map(d => el('li', {}, d)))),
      el('p', {class: 'ms-sub'}, `${RL.tool}: ${r.tool}`),
      el('div', {class: 'ms-actions'}, primaryButton(RL.backMap + ' →', {t: 'finish'}))));
  }

  function doneView() {
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card ms-complete pop'},
      el('div', {class: 'ms-trophy', 'aria-hidden': 'true'}, '★'),
      el('p', {class: 'ms-sub'}, rolesData.done),
      el('div', {class: 'rl-four'}, ...roles.map(r => el('div', {class: 'rl-mini', style: `--rc:${r.color}`}, roleIcon(r.id, r.color), el('strong', {}, `${r.name} ${RL.role}`), el('span', {}, r.motto)))),
      el('div', {class: 'ms-actions'}, el('a', {class: 'ms-btn primary is-next', href: '?mode=mission', 'data-testid': 'to-mission'}, RL.toMission + ' →'))));
  }

  // ── 조이스틱 + 방향키·WASD ──
  const held = new Set<string>();
  let joyVec = {x: 0, y: 0};
  const joy = joystick(RL.joystick, v => { joyVec = v; push(); });
  function push() {
    if (state.screen !== 'map') { scene.setInput(0, 0); return; }
    const k = (a: string, b: string) => (held.has(a) || held.has(b) ? 1 : 0);
    const x = k('arrowright', 'd') - k('arrowleft', 'a') + joyVec.x;
    const y = k('arrowup', 'w') - k('arrowdown', 's') + joyVec.y;
    const len = Math.hypot(x, y);
    scene.setInput(len > 1 ? x / len : x, len > 1 ? y / len : y);
  }
  const MOVE = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
  window.addEventListener('keyup', e => { if (held.delete(e.key.toLowerCase())) push(); });
  window.addEventListener('blur', () => { held.clear(); push(); });

  window.addEventListener('keydown', e => {
    const k = e.key, lower = k.toLowerCase();
    if (state.screen === 'map' && MOVE.includes(lower)) { e.preventDefault(); held.add(lower); push(); return; }
    if (['PageDown', ' ', 'Enter'].includes(k)) {
      if (k === 'Enter' && document.activeElement instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (state.screen === 'done') { location.search = '?mode=mission'; return; }
      const p = primary(state);
      if (p) dispatch(p);
      return;
    }
    if (['Escape', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); if (['webtoon', 'quiz'].includes(state.screen)) dispatch({t: 'map'}); return; }
    if (state.screen === 'map' && lower === 'e' && view.near) { dispatch({t: 'enter', role: view.near as RoleId}); return; }
    if (state.screen === 'quiz') {
      const i = LETTERS.indexOf(k.toUpperCase());
      if (i >= 0 && i < roleOf(state.role!)!.quiz[state.q].options.length) dispatch({t: 'answer', option: i});
      return;
    }
    const n = Number(k);
    if (state.screen === 'map' && Number.isInteger(n) && ROLE_IDS[n - 1]) dispatch({t: 'enter', role: ROLE_IDS[n - 1]});
  });

  scene.goTo(state.role);
  render();
}
