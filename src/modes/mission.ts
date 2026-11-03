import {scenario} from '../content/loadContent';
import type {ChoiceKey, ResultType} from '../content/types';
import {safeGet, safeSet, safeRemove} from '../core/persistence';
import {mountLab} from '../labs/labHost';
import {el, button, add} from '../ui/dom';
import {svg} from '../ui/art';
import {fitStage} from '../ui/stage';
import {ML} from '../mission/labels';
import {
  act, initialMission, primary, missions, missionFor, caseOf, decisionOf, lastAttempt, lastOutcome, hint, clueOf, clueText,
  placeOf, placeLeft, placeOpen, facts, unlocked, validMission, NONE,
  type MissionAction, type MissionState, type MissionClue, type MissionPlace,
} from '../mission/engine';
import {mountScene, type SceneHandle} from '../mission/scene';
import '../mission/style.css';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
const keyOf = (caseId: string) => 'cons-lab:mission:' + caseId;
const urlOf = (caseId?: string) => '?mode=mission' + (caseId ? '&case=' + caseId : '');

function loadMission(caseId: string): MissionState | null {
  try {
    return validMission(JSON.parse(safeGet(keyOf(caseId)) ?? 'null'));
  } catch {
    return null;
  }
}

/** 3D 미션. ?case=가 없으면 사건 목록, 있으면 그 사건의 미션을 연다. */
export function mountMission(root: HTMLElement, params: URLSearchParams) {
  document.title = ML.docTitle;
  const caseId = params.get('case');
  if (caseId && missions.some(m => m.caseId === caseId)) runMission(root, caseId);
  else mountHub(root);
}

// ── 사건 목록 ──
function mountHub(root: HTMLElement) {
  const stage = el('div', {id: 'stage', class: 'ms ms-hub-stage', 'data-screen': 'hub'});
  const cards = missions.map((m, i) => {
    const c = caseOf(m.caseId);
    const s = loadMission(m.caseId);
    const done = s?.screen === 'complete';
    const lead = scenario.experts.find(x => x.id === c.lead)!;
    return el('a', {class: 'ms-case' + (done ? ' done' : ''), href: urlOf(m.caseId), 'data-case': m.caseId},
      el('span', {class: 'ms-num'}, i + 1),
      el('span', {class: 'ms-case-icon', 'aria-hidden': 'true'}, placeIcon(m.places.find(p => p.slot === 'main')!.icon)),
      el('span', {class: 'ms-band'}, `${ML.file} #${c.order} · ${c.place} · ${c.year}`),
      el('strong', {}, c.title),
      el('span', {class: 'ms-case-lead ' + lead.id}, `${lead.symbol} ${lead.label}`),
      el('span', {class: 'ms-case-meta'}, `${ML.hidden} × ${m.clues.length} · ${ML.decisions} ${m.decisions.length}`),
      el('span', {class: 'ms-case-state'}, done
        ? add(el('span', {}), ...m.decisions.map(g => resultBadge(lastOutcome(s!, g.id)!.result, true)), ` ${ML.finished}`)
        : s && s.screen !== 'incident' ? `${ML.inProgress} · ${ML.clues} ${s.solved.length}/${m.clues.length}` : ML.notStarted));
  });
  stage.append(el('section', {class: 'ms-hub'},
    el('h1', {}, ML.hubTitle),
    el('p', {class: 'ms-sub'}, ML.hubSub),
    el('div', {class: 'ms-cases'}, ...cards),
    el('div', {class: 'ms-actions'}, el('a', {class: 'ms-btn', href: '?mode=teacher'}, ML.backLesson))));
  root.replaceChildren(stage);
  fitStage();
  window.addEventListener('resize', fitStage);
  const next = missions.find(m => loadMission(m.caseId)?.screen !== 'complete') ?? missions[0];
  cards[missions.indexOf(next)].classList.add('suggest');
  window.addEventListener('keydown', e => {
    const n = Number(e.key);
    if (Number.isInteger(n) && missions[n - 1]) location.search = urlOf(missions[n - 1].caseId);
    if (['PageDown', ' ', 'Enter'].includes(e.key) && !(document.activeElement instanceof HTMLAnchorElement)) {
      e.preventDefault();
      location.search = urlOf(next.caseId);
    }
  });
}

// ── 한 사건의 미션 ──
function runMission(root: HTMLElement, caseId: string) {
  const KEY = keyOf(caseId);
  let state = loadMission(caseId) ?? initialMission(caseId);
  // 화면에만 쓰는 값: 방금 고른 카드, 실습 기록 저장 여부, 가까이 있는 장소
  const view = {picked: '', pickedOk: false, labReported: false, near: null as string | null};

  const stage = el('div', {id: 'stage', class: 'ms'});
  const world = el('div', {class: 'ms-world'});
  const hud = el('div', {class: 'ms-hud'});
  const layer = el('div', {class: 'ms-layer'});
  const toast = el('div', {class: 'ms-toast', role: 'status'});
  stage.append(world, hud, layer, el('div', {class: 'ms-keys'}, ML.keys), toast);
  root.replaceChildren(stage);
  fitStage();
  window.addEventListener('resize', fitStage);

  const m = missionFor(caseId);
  const c = caseOf(caseId);
  const scene: SceneHandle = mountScene(world, caseId, m.places.map(p => ({id: p.id, slot: p.slot, name: p.name})), id => {
    view.near = id;
    if (state.screen === 'map') render();
  });
  if (!scene.ok) {
    world.classList.add('flat');
    world.append(el('p', {class: 'ms-nogl'}, ML.noGL));
  }

  function save() {
    if (!safeSet(KEY, JSON.stringify(state))) say(ML.saveFailed);
  }
  function say(text: string) {
    toast.textContent = text;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
  }

  function dispatch(a: MissionAction, opts: {render?: boolean} = {}) {
    const before = state;
    const {state: next, effect} = act(state, a);
    state = next;
    if (a.t === 'answer') { view.picked = a.option; view.pickedOk = !!effect.correct; }
    else if (a.t !== 'labWork') view.picked = '';
    if (a.t === 'lab') view.labReported = false;
    if (effect.message === 'locked') say(ML.needUnlock);
    if (effect.message === 'placeLocked') say(ML.placeLocked);
    if (effect.message === 'needChoice') say(ML.needChoice);
    if (effect.message === 'needReason') say(ML.needReason);
    save();
    if (opts.render === false) return;
    if (before.place !== state.place || before.screen !== state.screen) scene.goTo(state.place);
    if (state.screen !== 'map') { held.clear(); joy.release(); }
    render();
  }

  // ── 그리기 ──
  function render() {
    stage.dataset.screen = state.screen;
    stage.dataset.place = state.place ?? '';
    stage.dataset.clue = state.clue ?? '';
    stage.dataset.decision = state.decision ?? '';
    stage.dataset.near = state.screen === 'map' ? view.near ?? '' : '';
    for (const p of m.places) {
      const left = placeLeft(state, p);
      scene.mark(p.id, {left, done: left === 0, active: state.place === p.id, locked: !placeOpen(state, p)});
    }
    // 패널이 가리는 쪽에 맞춰 장면을 옮긴다: 지도는 오른쪽 패널, 장소는 아래 도크
    scene.setShift(state.screen === 'map' ? 0.15 : 0, state.screen === 'place' ? 0.17 : 0);
    hud.replaceChildren(hudView());
    layer.replaceChildren();
    const screens: Record<MissionState['screen'], () => void> = {
      incident: incidentView, map: mapView, place: placeView, clue: clueView, lab: labView,
      decision: decisionView, outcome: outcomeView, history: historyView, complete: completeView,
    };
    screens[state.screen]();
    const p = primary(state);
    layer.querySelectorAll('[data-primary]').forEach(b => b.classList.toggle('is-next', !!p));
  }

  function hudView() {
    return add(el('div', {class: 'ms-hud-row'}),
      el('a', {class: 'ms-pill ms-list', href: urlOf()}, `☰ ${ML.caseList}`),
      el('div', {class: 'ms-pill ms-file'}, el('strong', {}, `${ML.file} #${c.order}`), ` · ${c.title}`),
      el('div', {class: 'ms-pill ms-clock'}, scenario.story.clock[c.id as keyof typeof scenario.story.clock] ?? ''),
      el('div', {class: 'ms-hud-right'},
        el('div', {class: 'ms-pill ms-count', 'data-testid': 'fact-count'}, el('span', {class: 'ms-dot fact'}), `${ML.facts} `, el('strong', {}, facts(state).length)),
        el('div', {class: 'ms-pill ms-count'}, el('span', {class: 'ms-dot clue'}), `${ML.clues} `, el('strong', {}, `${state.solved.length}/${m.clues.length}`))));
  }

  function mentor(text: string, tone: 'info' | 'warn' = 'info') {
    return el('div', {class: 'ms-mentor ' + tone},
      el('div', {class: 'ms-mentor-face', 'aria-hidden': 'true'}, mentorIcon()),
      el('div', {class: 'ms-mentor-body'}, el('span', {class: 'ms-mentor-name'}, ML.mentor), el('p', {}, text)));
  }

  /** 클리커 '다음'이 누를 버튼에 표시 */
  function primaryButton(label: string, action: MissionAction, attrs: Record<string, unknown> = {}) {
    return button(label, () => dispatch(action), {class: 'ms-btn primary', 'data-primary': '', ...attrs});
  }

  function incidentView() {
    const lead = scenario.experts.find(x => x.id === c.lead)!;
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card ms-incident pop'},
      el('div', {class: 'ms-alarm'}, el('span', {class: 'ms-alarm-icon', 'aria-hidden': 'true'}, '!'), ML.alarm),
      el('p', {class: 'ms-band'}, [`${ML.file} #${c.order}`, ML.real, c.place, c.year].join(' · ')),
      el('h1', {}, c.title),
      el('div', {class: 'ms-brief'}, ...c.brief.lines.map((line, i) => el('p', {class: i === c.brief.lines.length - 1 ? 'strong' : ''}, line))),
      el('div', {class: 'ms-call ' + lead.id}, el('span', {class: 'ms-symbol'}, lead.symbol), el('p', {}, m.call)),
      el('div', {class: 'ms-actions'}, primaryButton(ML.start + ' →', {t: 'start'}))));
  }

  function mapView() {
    const next = primary(state);
    const suggested = (t: string, id: string) => !!next && next.t === t && 'id' in next && next.id === id;
    // button()은 글만 받으므로 카드 내용은 따로 붙인다
    const placeRows = m.places.map((p, i) => {
      const left = placeLeft(state, p), open = placeOpen(state, p);
      const row = button('', () => dispatch({t: 'place', id: p.id}), {
        class: 'ms-place' + (left === 0 ? ' done' : '') + (open ? '' : ' locked') + (suggested('place', p.id) ? ' suggest' : '') + (view.near === p.id ? ' near' : ''),
        'data-place': p.id, 'aria-label': p.name, 'data-primary': suggested('place', p.id) ? '' : false,
      });
      const afterIndex = p.after ? m.decisions.findIndex(g => g.id === p.after) + 1 : 0;
      row.append(
        el('span', {class: 'ms-place-icon', 'aria-hidden': 'true'}, open ? placeIcon(p.icon) : lockIcon(true)),
        el('span', {class: 'ms-row-text'}, el('strong', {}, p.name),
          el('span', {class: 'ms-place-state'}, !open ? `${ML.decisions} ${afterIndex} ${ML.placeAfter}` : left === 0 ? `✓ ${ML.placeDone}` : `? × ${left} ${ML.left}`)),
        el('span', {class: 'ms-num'}, i + 1));
      return row;
    });
    const gates = m.decisions.map((g, i) => {
      const d = decisionOf(caseId, g.id);
      const open = unlocked(state, g.id), closed = state.closed.includes(g.id);
      const have = g.needs.filter(id => state.solved.includes(id)).length;
      const card = button('', () => dispatch({t: 'decision', id: g.id}), {
        class: 'ms-gate' + (open ? ' open' : ' locked') + (closed ? ' closed' : '') + (suggested('decision', g.id) ? ' suggest' : ''),
        'data-gate': g.id, 'aria-label': d.prompt, disabled: closed, 'data-primary': suggested('decision', g.id) ? '' : false,
      });
      const o = closed ? lastOutcome(state, g.id) : null;
      card.append(
        el('span', {class: 'ms-gate-head'}, closed && o ? resultBadge(o.result, true) : el('span', {class: 'ms-lock', 'aria-hidden': 'true'}, lockIcon(!open)),
          el('span', {}, `${ML.decisions} ${i + 1}`),
          el('span', {class: 'ms-needs'}, ...g.needs.map(id => el('i', {class: state.solved.includes(id) ? 'on' : ''})), ` ${have}/${g.needs.length}`)),
        el('strong', {}, d.prompt),
        el('span', {class: 'ms-gate-state'}, closed ? ML.closedDecision : open ? ML.ready : ML.lockedHint),
        el('span', {class: 'ms-num'}, m.places.length + i + 1));
      return card;
    });
    layer.append(mentor(m.mapSay), el('section', {class: 'ms-side pop'},
      el('h2', {}, ML.mapTitle),
      el('p', {class: 'ms-label'}, ML.places), el('div', {class: 'ms-places'}, ...placeRows),
      el('p', {class: 'ms-label'}, ML.decisions), el('div', {class: 'ms-gates'}, ...gates),
      next?.t === 'history' ? el('div', {class: 'ms-actions'}, primaryButton(ML.historyBtn + ' →', {t: 'history'})) : null));
    if (scene.ok) layer.append(joy.el);
    const near = view.near ? m.places.find(p => p.id === view.near) : undefined;
    if (near) {
      const enter = button('', () => dispatch({t: 'place', id: near.id}), {class: 'ms-enter pop', 'data-testid': 'enter'});
      enter.append(el('span', {class: 'ms-key'}, 'E'), el('strong', {}, near.name), ` ${ML.enter}`);
      layer.append(enter);
    }
  }

  function placeView() {
    const p = placeOf(state, state.place!);
    const next = primary(state);
    const tiles = p.clues.map((id, i) => {
      const clue = clueOf(state, id);
      const solved = state.solved.includes(id), opened = state.opened.includes(id);
      const waiting = clue.source === 'lab' && !state.labsDone.includes(p.id);
      const tile = button('', () => dispatch({t: 'open', id}), {
        class: 'ms-spot' + (solved ? ' solved' : opened ? ' opened' : '') + (next?.t === 'open' && next.id === id ? ' suggest' : ''),
        'data-spot': id, disabled: waiting, 'aria-label': clue.spot, 'data-primary': next?.t === 'open' && next.id === id ? '' : false,
      });
      tile.append(
        el('span', {class: 'ms-num'}, i + 1),
        el('span', {class: 'ms-spot-mark', 'aria-hidden': 'true'}, solved ? '✓' : waiting ? '…' : opened ? '!' : ML.hidden),
        el('strong', {}, clue.spot),
        el('span', {class: 'ms-spot-text'}, solved ? clue.fact : waiting ? ML.labHint : ML.look));
      return tile;
    });
    const actions = el('div', {class: 'ms-actions'});
    if (p.lab && !state.labsDone.includes(p.id)) actions.append(primaryButton(ML.lab, {t: 'lab'}));
    actions.append(next?.t === 'map' ? primaryButton(ML.backMap, {t: 'map'}) : button(ML.backMap, () => dispatch({t: 'map'}), {class: 'ms-btn'}));
    layer.append(el('section', {class: 'ms-dock compact pop'},
      mentor(p.say),
      el('h2', {}, el('span', {class: 'ms-place-icon small', 'aria-hidden': 'true'}, placeIcon(p.icon)), p.name),
      el('div', {class: 'ms-spots'}, ...tiles),
      actions));
  }

  function clueView() {
    const clue = clueOf(state, state.clue!);
    const solved = state.solved.includes(clue.id);
    const tried = state.tries[clue.id] ?? [];
    const wrongNow = !!view.picked && !view.pickedOk;
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card ms-clue pop'},
      el('div', {class: 'ms-clue-top'},
        el('div', {class: 'ms-note'},
          el('p', {class: 'ms-note-tag'}, `${ML.hidden} ${placeOf(state, state.place!).name} · ${clue.spot}`),
          el('p', {class: 'ms-note-text', 'data-testid': 'clue-text'}, clueText(caseId, clue))),
        solved
          ? el('div', {class: 'ms-found flip', 'data-testid': 'fact'}, el('span', {class: 'ms-found-mark', 'aria-hidden': 'true'}, '✓'),
            el('div', {}, el('p', {class: 'ms-found-title'}, ML.found), el('p', {}, clue.fact)))
          : wrongNow ? mentor(clue.nudge, 'warn') : el('p', {class: 'ms-question'}, ML.solveQ)),
      el('div', {class: 'ms-options'}, ...clue.options.map((id, i) => optionCard(clue, id, i, solved, tried))),
      el('div', {class: 'ms-actions'},
        button(ML.backPlace, () => dispatch({t: 'back'}), {class: 'ms-btn'}),
        solved ? primaryButton(ML.keepGoing + ' →', {t: 'back'}) : null)));
  }

  function optionCard(clue: MissionClue, id: string, i: number, solved: boolean, tried: string[]) {
    const isAnswer = solved && id === clue.answer;
    const wasTried = tried.includes(id) && id !== clue.answer;
    const card = button('', () => dispatch({t: 'answer', option: id}), {
      class: 'ms-option' + (isAnswer ? ' right' : '') + (wasTried ? ' tried' : '') + (view.picked === id && !view.pickedOk ? ' shake' : '') + (solved && !isAnswer ? ' dim' : ''),
      'data-option': id, disabled: solved || wasTried, 'aria-label': LETTERS[i],
    });
    card.append(el('span', {class: 'ms-letter'}, LETTERS[i]));
    const h = id === NONE ? null : hint(id)!;
    if (!h) {
      card.classList.add('none');
      card.append(el('span', {class: 'ms-option-head'}, el('span', {class: 'ms-symbol'}, '✕'), ML.noneTitle), el('strong', {}, ML.noneSub));
    } else if (h.kind === 'journal') {
      card.classList.add('journal');
      card.append(el('span', {class: 'ms-option-head'}, el('span', {class: 'ms-symbol'}, h.symbol), `${ML.journalTag} · ${ML.caseNo} ${h.caseOrder}`), el('strong', {}, h.clue));
    } else {
      card.classList.add(h.expert!, h.kind);
      card.append(el('span', {class: 'ms-option-head'}, el('span', {class: 'ms-symbol'}, h.symbol), h.label),
        el('span', {class: 'ms-col'}, h.kind === 'idea' ? ML.ideaTag : ML.clueCol), el('strong', {}, h.clue));
      if (isAnswer && h.kind === 'row') card.append(el('span', {class: 'ms-col'}, ML.causeCol), el('span', {class: 'ms-cause'}, h.cause!),
        el('span', {class: 'ms-col'}, ML.actionCol), el('span', {class: 'ms-cause'}, h.action!));
    }
    if (wasTried) card.append(el('span', {class: 'ms-tried'}, ML.notThis));
    return card;
  }

  let labCleanup: (() => void) | undefined;
  function labView() {
    const lab = c.lab!;
    const place = placeOf(state, state.place!);
    // 실습 모듈이 받은 요소의 class를 덮어쓰므로 한 겹 감싼다
    const host = el('div');
    const done = primaryButton(ML.labDone + ' →', {t: 'labDone'}, {disabled: !view.labReported});
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card ms-lab pop'},
      el('p', {class: 'ms-band'}, place.name),
      el('h1', {}, lab.title),
      el('p', {class: 'ms-sub'}, ML.labHint),
      el('div', {class: 'ms-lab-host'}, host),
      el('div', {class: 'ms-actions'},
        button(ML.backPlace, () => dispatch({t: 'back'}), {class: 'ms-btn'}),
        button(ML.labSkip, () => dispatch({t: 'labDone'}), {class: 'ms-btn'}),
        done)));
    labCleanup?.();
    labCleanup = mountLab(host, {
      id: lab.id, part: place.lab ?? 'main', seed: 'mission-' + c.id, quick: false, work: state.labWork,
      save: work => dispatch({t: 'labWork', work}, {render: false}),
      report: () => { view.labReported = true; done.disabled = false; done.classList.add('is-next'); },
      fail: () => { done.disabled = true; },
    });
  }

  function decisionView() {
    const d = decisionOf(caseId, state.decision!);
    const known = facts(state);
    const tried = (state.attempts[d.id] ?? []).map(a => a.choice);
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card ms-decision pop'},
      el('p', {class: 'ms-band'}, `${ML.decisions} ${m.decisions.findIndex(g => g.id === d.id) + 1}`),
      el('h1', {}, d.prompt),
      d.context ? el('p', {class: 'ms-sub'}, d.context) : null,
      el('div', {class: 'ms-decide-grid'},
        el('div', {class: 'ms-group'},
          el('p', {class: 'ms-label'}, ML.choiceQ),
          el('div', {class: 'ms-choices'}, ...d.choices.map(ch => {
            const b = button('', () => dispatch({t: 'choose', key: ch.key}), {
              class: 'ms-choice' + (tried.includes(ch.key) ? ' tried' : ''), 'aria-pressed': state.draft.choice === ch.key, 'data-choice': ch.key,
            });
            b.append(el('span', {class: 'ms-letter'}, ch.key), el('strong', {}, ch.label));
            return b;
          }))),
        el('div', {class: 'ms-group'},
          el('p', {class: 'ms-label'}, ML.reasonQ),
          el('div', {class: 'ms-reasons'}, ...(known.length ? known.map((f, i) => {
            const b = button('', () => dispatch({t: 'reason', id: f.id}), {class: 'ms-reason', 'aria-pressed': state.draft.reason === f.id, 'data-reason': f.id});
            b.append(el('span', {class: 'ms-num'}, i + 1), el('span', {}, f.fact));
            return b;
          }) : [el('p', {class: 'ms-sub'}, ML.noFacts)])))),
      el('div', {class: 'ms-actions'},
        button(ML.backMap, () => dispatch({t: 'back'}), {class: 'ms-btn'}),
        primaryButton(ML.commit + ' →', {t: 'commit'}, {disabled: !state.draft.choice || !state.draft.reason}))));
  }

  function outcomeView() {
    const d = decisionOf(caseId, state.decision!);
    const attempt = lastAttempt(state, d.id)!;
    const o = lastOutcome(state, d.id)!;
    const choice = d.choices.find(ch => ch.key === attempt.choice)!;
    const actions = el('div', {class: 'ms-actions'});
    if (o.delayed && !state.delayedShown) actions.append(primaryButton(`${ML.forward} · ${o.delayed.label} →`, {t: 'forward'}));
    else {
      if (o.retry) actions.append(button(ML.retry, () => dispatch({t: 'retry'}), {class: 'ms-btn'}));
      actions.append(primaryButton(ML.proceed + ' →', {t: 'proceed'}));
    }
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: `ms-card ms-outcome ${o.result} pop`, 'data-outcome': o.id},
      el('div', {class: 'ms-outcome-head'}, resultBadge(o.result), el('div', {},
        el('p', {class: 'ms-band'}, `${ML.decisions} ${m.decisions.findIndex(g => g.id === d.id) + 1} · ${d.prompt}`),
        el('h1', {}, ML.results[o.result]))),
      el('div', {class: 'ms-picked'}, el('span', {class: 'ms-letter'}, choice.key), el('strong', {}, choice.label)),
      el('p', {class: 'ms-outcome-text'}, o.text),
      el('p', {class: 'ms-reason-line'}, `${ML.ourReason}: ${clueOf(state, attempt.reason).fact}`),
      o.delayed && state.delayedShown ? el('div', {class: 'ms-delayed flip'}, el('p', {class: 'ms-band'}, o.delayed.label), el('p', {}, o.delayed.text)) : null,
      actions));
  }

  function historyView() {
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card ms-history pop'},
      el('h1', {}, ML.historyTitle),
      el('div', {class: 'ms-history-body'},
        el('ol', {class: 'ms-timeline'}, ...c.history!.lines.map(line => el('li', {}, line))),
        el('div', {class: 'ms-history-side'},
          el('p', {class: 'ms-label'}, ML.ourChoice),
          ...m.decisions.map(g => {
            const d = decisionOf(caseId, g.id), o = lastOutcome(state, g.id)!;
            const ch = d.choices.find(x => x.key === lastAttempt(state, g.id)!.choice)!;
            return el('div', {class: 'ms-our'}, resultBadge(o.result, true), el('span', {}, el('b', {}, d.prompt), el('br', {}), `${ch.key} · ${ch.label}`));
          }),
          el('p', {class: 'ms-label'}, ML.journalGot),
          ...m.decisions.map(g => el('div', {class: 'ms-journal flip'}, decisionOf(caseId, g.id).journal.text)))),
      el('div', {class: 'ms-actions'}, primaryButton(ML.finish + ' →', {t: 'complete'}))));
  }

  function completeView() {
    const tries = Object.values(state.tries).reduce((n, x) => n + x.length, 0);
    const nextMission = missions[missions.findIndex(x => x.caseId === caseId) + 1];
    layer.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card ms-complete pop'},
      el('div', {class: 'ms-trophy', 'aria-hidden': 'true'}, '★'),
      el('h1', {}, ML.completeTitle),
      el('p', {class: 'ms-sub'}, m.complete),
      el('div', {class: 'ms-stats'},
        el('div', {}, el('strong', {}, `${state.solved.length}/${m.clues.length}`), el('span', {}, ML.stats.clues)),
        el('div', {}, el('strong', {}, tries), el('span', {}, ML.stats.tries)),
        el('div', {}, el('span', {class: 'ms-stat-badges'}, ...m.decisions.map(g => resultBadge(lastOutcome(state, g.id)!.result, true))), el('span', {}, ML.stats.decisions))),
      el('div', {class: 'ms-actions'},
        button(ML.restart, restart, {class: 'ms-btn'}),
        el('a', {class: 'ms-btn', href: urlOf()}, ML.caseList),
        nextMission
          ? el('a', {class: 'ms-btn primary is-next', href: urlOf(nextMission.caseId), 'data-testid': 'next-case'}, ML.nextCase + ' →')
          : el('a', {class: 'ms-btn primary', href: '?mode=teacher'}, ML.backLesson))));
  }

  function restart() {
    safeRemove(KEY);
    state = initialMission(caseId);
    view.picked = '';
    scene.goTo(null);
    save();
    render();
  }

  // ── 조이스틱 + 방향키·WASD ──
  const held = new Set<string>();
  let joyVec = {x: 0, y: 0};
  const joy = joystick(v => { joyVec = v; push(); });
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

  // ── 키보드·클리커 ──
  window.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    const k = e.key;
    const lower = k.toLowerCase();
    if (state.screen === 'map' && MOVE.includes(lower)) {
      e.preventDefault();
      held.add(lower);
      push();
      return;
    }
    if (['PageDown', ' ', 'Enter'].includes(k)) {
      if (k === 'Enter' && document.activeElement instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (state.screen === 'complete') { layer.querySelector<HTMLAnchorElement>('[data-testid=next-case]')?.click(); return; }
      const p = primary(state);
      if (p) dispatch(p);
      else if (state.screen === 'lab' && view.labReported) dispatch({t: 'labDone'});
      return;
    }
    if (['Escape', 'PageUp', 'Backspace'].includes(k)) {
      e.preventDefault();
      if (['clue', 'lab', 'place', 'decision'].includes(state.screen)) dispatch({t: 'back'});
      return;
    }
    if (state.screen === 'map' && lower === 'e' && view.near) { dispatch({t: 'place', id: view.near}); return; }
    const letter = k.toUpperCase();
    if (state.screen === 'clue' && LETTERS.includes(letter as never)) {
      const option = clueOf(state, state.clue!).options[LETTERS.indexOf(letter as never)];
      if (option) dispatch({t: 'answer', option});
      return;
    }
    if (state.screen === 'decision' && ['A', 'B', 'C'].includes(letter)) { dispatch({t: 'choose', key: letter as ChoiceKey}); return; }
    const n = Number(k);
    if (!Number.isInteger(n) || n < 1) return;
    if (state.screen === 'decision') { const f = facts(state)[n - 1]; if (f) dispatch({t: 'reason', id: f.id}); }
    else if (state.screen === 'map') {
      const p = m.places[n - 1];
      const g = m.decisions[n - 1 - m.places.length];
      if (p) dispatch({t: 'place', id: p.id});
      else if (g) dispatch({t: 'decision', id: g.id});
    } else if (state.screen === 'place') {
      const id = placeOf(state, state.place!).clues[n - 1];
      if (id) dispatch({t: 'open', id});
    }
  });

  scene.goTo(state.place);
  render();
}

/** 화면 위 조이스틱. 끌면 -1~1 벡터(위가 +y)를 알린다. */
function joystick(onMove: (v: {x: number; y: number}) => void) {
  const knob = el('span', {class: 'ms-joy-knob'});
  const base = el('div', {class: 'ms-joy', role: 'application', 'aria-label': ML.joystick, 'data-testid': 'joystick'}, knob);
  const R = 90;
  let id: number | null = null;
  const set = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    onMove({x: dx / R, y: -dy / R});
  };
  const release = () => { id = null; knob.style.transform = ''; onMove({x: 0, y: 0}); };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const r = base.getBoundingClientRect();
    const scale = r.width / base.offsetWidth || 1;   // 무대가 줄어든 만큼 되돌린다
    set((e.clientX - (r.left + r.width / 2)) / scale, (e.clientY - (r.top + r.height / 2)) / scale);
  };
  base.addEventListener('pointerdown', e => { id = e.pointerId; base.setPointerCapture(e.pointerId); move(e); });
  base.addEventListener('pointermove', move);
  base.addEventListener('pointerup', release);
  base.addEventListener('pointercancel', release);
  return {el: base, release};
}

// ── 그림 조각 ──
function resultBadge(result: ResultType, small = false) {
  return el('span', {class: `ms-result ${result}${small ? ' small' : ''}`, 'aria-label': ML.results[result]}, ML.symbols[result]);
}
function mentorIcon() {
  const s = svg('svg', {viewBox: '0 0 64 64'});
  s.append(svg('circle', {cx: 32, cy: 32, r: 31, fill: '#2f7d6d'}), svg('circle', {cx: 32, cy: 25, r: 11, fill: '#fffdf7'}),
    svg('path', {d: 'M12 56 C14 40 50 40 52 56 Z', fill: '#fffdf7'}), svg('rect', {x: 22, y: 21, width: 20, height: 5, rx: 2.5, fill: '#1d2a2a'}));
  return s;
}
function lockIcon(locked: boolean) {
  const s = svg('svg', {viewBox: '0 0 32 32'});
  s.append(svg('path', {d: locked ? 'M10 14 V10 a6 6 0 0 1 12 0 V14' : 'M10 14 V10 a6 6 0 0 1 11 -3', fill: 'none', stroke: 'currentColor', 'stroke-width': 3.5}),
    svg('rect', {x: 6, y: 14, width: 20, height: 14, rx: 3, fill: 'currentColor'}));
  return s;
}
function placeIcon(kind: MissionPlace['icon']) {
  const s = svg('svg', {viewBox: '0 0 48 48'});
  const ink = '#1d2a2a', line = {stroke: ink, 'stroke-width': 2.5};
  const parts: Record<MissionPlace['icon'], () => SVGElement[]> = {
    statue: () => [svg('rect', {x: 12, y: 36, width: 24, height: 8, fill: '#d9ccb0', ...line}), svg('path', {d: 'M18 36 L20 18 H28 L30 36 Z', fill: '#63b39b', ...line}),
      svg('rect', {x: 21, y: 10, width: 6, height: 7, fill: '#63b39b', ...line}), svg('path', {d: 'M28 20 L33 6', stroke: ink, 'stroke-width': 3}), svg('circle', {cx: 33, cy: 5, r: 3, fill: '#ffc94a', stroke: ink, 'stroke-width': 2})],
    frame: () => [svg('rect', {x: 8, y: 6, width: 32, height: 36, fill: '#63b39b', ...line}), svg('path', {d: 'M16 6 V42 M24 6 V42 M32 6 V42 M8 18 H40 M8 30 H40', stroke: '#7a4a33', 'stroke-width': 3}),
      svg('circle', {cx: 24, cy: 18, r: 4, fill: '#c0622d'}), svg('circle', {cx: 32, cy: 30, r: 4, fill: '#c0622d'})],
    archive: () => [svg('path', {d: 'M6 20 L24 8 L42 20', fill: '#a65a43', ...line}), svg('rect', {x: 10, y: 20, width: 28, height: 22, fill: '#f3e8d2', ...line}),
      svg('rect', {x: 15, y: 27, width: 18, height: 10, fill: '#c7a26b', stroke: ink, 'stroke-width': 2})],
    lab: () => [svg('path', {d: 'M19 6 H29 M21 6 V18 L10 40 H38 L27 18 V6', fill: '#9fe0e6', ...line, 'stroke-linejoin': 'round'}), svg('path', {d: 'M14 32 H34 L38 40 H10 Z', fill: '#c0622d', opacity: 0.8})],
    vase: () => [svg('path', {d: 'M18 8 H30 L28 14 C38 18 38 34 30 40 H18 C10 34 10 18 20 14 Z', fill: '#1f3557', ...line}), svg('path', {d: 'M13 24 H35', stroke: '#f4f1ea', 'stroke-width': 4}),
      svg('path', {d: 'M30 30 L36 34 M28 36 L34 42', stroke: ink, 'stroke-width': 2})],
    fragments: () => [svg('rect', {x: 4, y: 30, width: 40, height: 8, fill: '#8a6142', ...line}), svg('path', {d: 'M10 30 L14 22 L19 28 Z M22 30 L26 20 L32 27 Z M34 30 L37 24 L41 29 Z', fill: '#1f3557', ...line})],
    mask: () => [svg('path', {d: 'M8 10 H40 V30 C40 40 32 44 24 44 C16 44 8 40 8 30 Z', fill: '#e0b13a', ...line}), svg('path', {d: 'M8 14 H14 M8 20 H14 M34 14 H40 M34 20 H40', stroke: '#2b4f8e', 'stroke-width': 4}),
      svg('rect', {x: 16, y: 16, width: 16, height: 18, rx: 6, fill: '#e8c35a', ...line})],
    beard: () => [svg('rect', {x: 18, y: 8, width: 12, height: 32, rx: 4, fill: '#2b4f8e', ...line}), svg('path', {d: 'M18 16 H30 M18 24 H30 M18 32 H30', stroke: '#e0b13a', 'stroke-width': 3}),
      svg('path', {d: 'M30 14 L42 10', stroke: '#9aa0a4', 'stroke-width': 4})],
    gate: () => [svg('rect', {x: 6, y: 28, width: 36, height: 14, fill: '#b8b2a6', ...line}), svg('path', {d: 'M19 42 V34 a5 5 0 0 1 10 0 V42', fill: '#3a2f28'}),
      svg('rect', {x: 10, y: 20, width: 28, height: 8, fill: '#a8322d', ...line}), svg('path', {d: 'M4 21 L24 10 L44 21 Z', fill: '#4a4f55', ...line}), svg('path', {d: 'M10 26 H38', stroke: '#2f8f6f', 'stroke-width': 3})],
    paint: () => [svg('path', {d: 'M4 14 H44 L40 22 H8 Z', fill: '#4a4f55', ...line}), svg('rect', {x: 8, y: 22, width: 32, height: 10, fill: '#2f8f6f', ...line}),
      svg('rect', {x: 14, y: 24, width: 6, height: 6, fill: '#d9c6a0'}), svg('rect', {x: 28, y: 25, width: 5, height: 5, fill: '#d9c6a0'}), svg('path', {d: 'M8 32 H40', stroke: '#2b6cb0', 'stroke-width': 4})],
    pagoda: () => [svg('rect', {x: 10, y: 38, width: 28, height: 6, fill: '#b8b2a6', ...line}), svg('path', {d: 'M14 38 V30 H34 V38 M16 30 V24 H32 V30 M18 24 V18 H30 V24 M20 18 V12 H28 V18', fill: '#d9d2c4', ...line}),
      svg('rect', {x: 8, y: 22, width: 8, height: 16, fill: '#8d9093', ...line})],
  };
  s.append(...parts[kind]());
  return s;
}
