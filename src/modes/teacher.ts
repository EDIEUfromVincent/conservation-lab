import {scenario, manuals, labs} from '../content/loadContent';
import {validateContent} from '../content/rules';
import type {TeacherNotes, TeamId} from '../content/types';
import {act, initial, teamIds, type Action} from '../core/actions';
import type {AppState, Session} from '../core/types';
import {createStore} from '../core/store';
import {load, save, KEY, safeRemove, parseSession, storageError, loadError, OldSessionError} from '../core/persistence';
import {append, csv} from '../core/logger';
import {currentCase, decision, labKey, outcome} from '../core/caseRunner';
import {remaining, planned, storyClock} from '../core/timer';
import {add, el, button, lines, field, checkbox, download} from '../ui/dom';
import {modal, modalOpen, toast} from '../ui/components/Modal';
import {L} from '../ui/labels';
import {fitStage} from '../ui/stage';
import {illustration} from '../ui/art';
import {mountLab} from '../labs/labHost';
import type {Ctx, ViewState} from './teacher/shared';
import {introScreen, videoScreen, heritageScreen, expertScreen, teamScreen, breakScreen} from './teacher/morning';
import {caseScreen, showOtherPaths} from './teacher/caseScreens';
import {journalScreen, algorithmScreen} from './teacher/journal';
import {requestScreen, buildScreen, testScreen, debugScreen} from './teacher/program';
import {aiScreen, reflectScreen, wrapupScreen, aiPrompt, showRealCase} from './teacher/evening';

export {manualUrl} from './teacher/morning';

/** 화면 ID(docs/04·docs/12 §4). E2E와 레이아웃 검사가 data-screen으로 쓴다. */
export function screenId(s: AppState): string {
  if (s.phase === 'CASE') {
    const kind = s.stage!.kind;
    if (kind === 'decision') return {vote: 'S14', outcome: 'S15', delayed: 'S17', retryOffer: 'S17'}[s.stage!.sub];
    return {brief: 'S10', experts: 'S11', predict: 'S12', lab: 'S13', historyJoin: 'S18', history: 'S18', wrap: 'S19'}[kind];
  }
  return {
    SETUP: 'S00', INTRO: 'S01', VIDEO: 'S02', HERITAGE_PICK: 'S03', EXPERT_STUDY: 'S04', TEAM_SETUP: 'S05', BREAK: 'SBR',
    JOURNAL: 'S20', ALGORITHM: 'S21', REQUEST: 'S30', BUILD: 'S31', TEST: 'S32', DEBUG: 'S33', AI_CHECK: 'S34',
    REFLECT: 'S24', WRAPUP: 'S25',
  }[s.phase];
}

const PROGRAM_PHASES = ['REQUEST', 'BUILD', 'TEST', 'DEBUG'];

export function mountTeacher(root: HTMLElement) {
  let stored: Session | null = null;
  let oldStored = false;
  try {
    stored = load();
  } catch (e) {
    oldStored = e instanceof OldSessionError;
  }
  const store = createStore<Session>(initial());
  const view: ViewState = {matrixMode: 'class', showGraph: false, expandedLab: '', selectedCard: '', editDecision: '', overlay: false};
  let labCleanup: (() => void) | undefined;
  const state = () => store.get().state;
  const persist = () => save(store.get());

  function dispatch(a: Action, opts: {render?: boolean} = {}) {
    const result = act(store.get(), a);
    store.set(() => result.session);
    persist();
    if (opts.render !== false && a.type !== 'labWork') render();
    const fx = result.effect;
    if (fx.message) toast(fx.message);
    if (fx.modal === 'tie') {
      modal(L.tie, fx.ties!.map(key => ({
        label: key + ' · ' + decision(state())!.choices.find(c => c.key === key)!.label, key,
        run: () => dispatch({type: 'confirm', choice: key}),
      })), undefined, {defaultIndex: null});
    }
    if (fx.modal === 'noVote') {
      modal(L.needVote, [{label: L.backInput, run: () => {}},
        ...decision(state())!.choices.map(c => ({label: L.teacherChoose + ' ' + c.key, key: c.key, run: () => dispatch({type: 'confirm', choice: c.key})}))]);
    }
    if (fx.modal === 'noPrediction') modal(L.needPrediction, [{label: L.backInput, run: () => {}}, {label: L.skipPrediction, run: () => dispatch({type: 'skipPrediction'})}]);
    if (fx.modal === 'lab') modal(L.incomplete, [{label: L.continue, run: () => {}}, {label: L.fallback, key: 'B', run: () => dispatch({type: 'skipLab'})}]);
  }

  const exportFile = (format: 'csv' | 'json') => {
    dispatch({type: 'export', value: format});
    const session = store.get();
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const body = format === 'csv' ? csv(session.log) : JSON.stringify({...session, exportedAt: new Date().toISOString()}, null, 2);
    download(body, format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json', `conservation-lab_${stamp}_${state().profile}.${format}`);
  };
  const exports = () => modal(L.export, [{label: 'CSV', run: () => exportFile('csv')}, {label: 'JSON', run: () => exportFile('json')}]);
  const reset = () => modal(L.resetAsk, [
    {label: L.export, run: exports},
    {label: L.fresh, run: () => modal(L.resetAgain, [
      {label: L.cancel, run: () => {}},
      {label: L.fresh, run: () => { safeRemove(KEY); store.set(() => initial()); render(); }},
    ])},
  ]);
  const restore = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw Error('size');
      const session = parseSession(await file.text());
      modal(L.importAsk, [{label: L.cancel, run: () => {}}, {label: L.import, run: () => { store.set(() => session); persist(); render(); }}]);
    } catch (e) {
      toast(e instanceof OldSessionError ? L.oldVersion : L.importError);
    }
  };
  const reasons = () => {
    const s = state();
    const v = s.draft[s.selectedTeam];
    if (!v) return;
    const tags = scenario.reasonTags.filter(r => r.id !== 'journal' || s.journal.length);
    modal(`${s.selectedTeam}${L.team} · ${L.reason}`, tags.map((r, i) => ({
      label: (v.reasons.includes(r.id) ? '● ' : '') + r.label, key: String(i + 1), run: () => dispatch({type: 'reason', key: r.id}),
    })));
  };

  function header(s: AppState) {
    const c = s.phase === 'CASE' ? currentCase(s) : null;
    const progress = s.caseIndex >= 0 && s.phase === 'CASE'
      ? scenario.cases.map((_, i) => (i <= s.caseIndex ? '●' : '○')).join(' ') : '';
    const health = el('div', {class: 'health'}, ...(c ? teamIds.map(t => el('span', {}, `${t}${L.team}`,
      el('meter', {min: 0, max: 10, value: s.teams[t].health[c.id]}), String(s.teams[t].health[c.id]))) : []));
    const clock = storyClock(s);
    return el('header', {},
      el('div', {class: 'brand'}, el('span', {class: 'seal'}, '◈'), scenario.story.labName),
      el('div', {class: 'story-status'},
        clock ? el('span', {class: 'clock', 'aria-label': L.storyBand, 'data-testid': 'clock'}, clock) : null,
        s.journal.length ? el('span', {class: 'journal-count', 'data-testid': 'journal-count'}, `${L.journalCount} ${s.journal.length}${L.cardUnit}`) : null,
        progress ? el('span', {class: 'small'}, progress) : null),
      el('div', {class: 'header-right'}, health, el('span', {id: 'timer', class: 'timer', 'aria-label': L.timer})));
  }

  function setupScreen({s, main, title}: Ctx) {
    title(scenario.meta.title, scenario.meta.subtitle);
    main.append(el('div', {class: 'split'}, illustration('case5'), el('div', {class: 'lines'},
      el('p', {}, scenario.meta.audience),
      el('div', {class: 'actions'}, ...(['120', '80'] as const).map(p =>
        button(scenario.profiles[p].label, () => dispatch({type: 'profile', value: p}), {'aria-pressed': s.profile === p, 'data-testid': 'profile-' + p}))),
      el('div', {class: 'settings'},
        checkbox(L.optional, s.settings.skipOptional, () => dispatch({type: 'setting', key: 'skipOptional', value: !s.settings.skipOptional})),
        checkbox(L.quick, s.settings.quickLabs, () => dispatch({type: 'setting', key: 'quickLabs', value: !s.settings.quickLabs})),
        field(L.baseUrl, s.settings.manualBaseUrl, value => dispatch({type: 'setting', key: 'manualBaseUrl', value})),
        field(L.videoUrl, s.settings.videoUrl, value => dispatch({type: 'setting', key: 'videoUrl', value}))),
      el('p', {class: 'small'}, L.privacy),
      el('div', {class: 'actions'},
        button(L.start, () => dispatch({type: 'next'}), {class: 'primary', 'data-testid': 'start'}),
        el('label', {class: 'field small'}, L.import,
          el('input', {type: 'file', accept: '.json,application/json', onchange: (e: Event) => void restore((e.target as HTMLInputElement).files?.[0])}))))));
  }

  function render() {
    labCleanup?.();
    labCleanup = undefined;
    const s = state();
    const c = s.phase === 'CASE' ? currentCase(s) : null;
    root.replaceChildren();
    const stage = el('div', {
      id: 'stage', 'data-phase': s.phase, 'data-kind': s.stage?.kind ?? '', 'data-sub': s.stage?.sub ?? '', 'data-case': c?.id ?? '',
      'data-attempt': s.stage?.attempt ?? 1, 'data-screen': screenId(s), 'data-subscreen': s.subScreen,
    });
    const main = el('main', {class: 'stage-body', tabindex: -1});
    stage.append(header(s), main);
    const title = (text: string, eyebrow?: string) => main.append(el('p', {class: 'eyebrow'}, eyebrow ?? ''), el('h1', {}, text));
    const ctx: Ctx = {s, main, view, dispatch, rerender: render, title};
    const footerActions = el('div', {class: 'actions'}, button('CSV', () => exportFile('csv')), button('JSON', () => exportFile('json')), button(L.reset, reset));
    switch (s.phase) {
      case 'SETUP': setupScreen(ctx); break;
      case 'INTRO': introScreen(ctx); break;
      case 'VIDEO': videoScreen(ctx); break;
      case 'HERITAGE_PICK': heritageScreen(ctx); break;
      case 'EXPERT_STUDY': expertScreen(ctx); break;
      case 'TEAM_SETUP': teamScreen(ctx); break;
      case 'CASE': caseScreen(ctx); break;
      case 'BREAK': breakScreen(ctx); break;
      case 'JOURNAL': journalScreen(ctx); break;
      case 'ALGORITHM': algorithmScreen(ctx); break;
      case 'REQUEST': requestScreen(ctx); break;
      case 'BUILD': buildScreen(ctx); break;
      case 'TEST': testScreen(ctx); break;
      case 'DEBUG': debugScreen(ctx); break;
      case 'AI_CHECK': aiScreen(ctx); break;
      case 'REFLECT': reflectScreen(ctx); break;
      case 'WRAPUP': wrapupScreen(ctx, footerActions); break;
    }
    stage.append(el('footer', {class: 'stage-footer'},
      el('div', {class: 'actions'},
        button(L.teacher, () => dispatch({type: 'panel'})),
        button(L.export, exports),
        el('a', {href: '?mode=print', target: '_blank', rel: 'noopener'}, L.print)),
      el('span', {class: 'small', id: 'save-status'}, storageError ? L.saveFailed : L.saved),
      el('div', {class: 'actions'},
        button(L.prev, () => dispatch({type: 'prev'})),
        button(L.next, () => dispatch({type: 'next'}), {class: 'primary', 'data-testid': 'next'}))));
    if (s.settings.showTeacherPanel) stage.append(teacherPanel(s));
    root.append(stage);
    fitStage();
    tick();
    if (c && s.stage?.kind === 'lab' && !s.labSkipped[labKey(s)]) {
      const host = main.querySelector<HTMLElement>('#lab-host');
      if (host) {
        try {
          labCleanup = mountLab(host, {
            id: c.lab!.id, part: s.stage.part, seed: s.sessionId + c.lab!.id, quick: s.settings.quickLabs, work: s.labWork[labKey(s)],
            save: work => dispatch({type: 'labWork', key: labKey(state()), value: work}),
            report: metrics => dispatch({type: 'labReport', value: metrics}),
            fail: error => dispatch({type: 'labError', value: String(error)}),
          });
        } catch (error) {
          dispatch({type: 'labError', value: String(error)});
        }
      }
    }
  }

  function notesFor(s: AppState): TeacherNotes | null {
    if (s.phase === 'CASE') return currentCase(s).teacher ?? null;
    if (s.phase === 'INTRO') return scenario.intro.teacher;
    if (s.phase === 'VIDEO') return scenario.video.teacher;
    if (s.phase === 'JOURNAL' || s.phase === 'ALGORITHM') return scenario.algorithm.teacher;
    if (PROGRAM_PHASES.includes(s.phase)) return scenario.program.teacher;
    if (s.phase === 'AI_CHECK') return scenario.aiCheck.teacher;
    return null;
  }

  function teacherPanel(s: AppState) {
    const c = s.phase === 'CASE' ? currentCase(s) : null;
    const note = notesFor(s);
    const panel = el('aside', {class: 'panel', 'aria-label': L.teacherOnly},
      el('div', {class: 'actions'}, el('h2', {}, L.teacherOnly), button(L.close, () => dispatch({type: 'panel'}))),
      el('p', {}, L.model), el('p', {class: 'small'}, L.latest),
      lines([...(note?.keyQuestions ?? []), ...(note?.misconceptions ?? []), ...(note?.notes ?? [])]));
    if (loadError) add(panel, el('p', {class: 'small'}, oldStored ? L.oldVersion : L.corrupt));
    // 원칙은 학생 화면에 숨기고 교사 패널에만 보인다(docs/12 §4 S15–S18)
    const d = decision(s);
    if (c && d) {
      add(panel, el('h3', {}, `${d.id} · ${scenario.principles.find(p => p.step === d.step)?.id ?? ''}`),
        ...d.choices.map(ch => el('p', {class: 'small'}, `${ch.key} → ${outcome(s, ch.key)?.result} · ${outcome(s, ch.key)?.principle}`)));
    }
    if (c?.history) add(panel, el('h2', {}, L.source), ...c.history.sources.map(src => el('a', {href: src.url, target: '_blank', rel: 'noopener'}, src.title)));
    add(panel, 
      el('div', {class: 'actions'},
        button('−1 min', () => dispatch({type: 'timer', value: -60})),
        button('+1 min', () => dispatch({type: 'timer', value: 60})),
        button(L.pause, () => dispatch({type: 'pause'}))),
      checkbox(L.quick, s.settings.quickLabs, () => dispatch({type: 'setting', key: 'quickLabs', value: !s.settings.quickLabs})),
      checkbox(L.optional, s.settings.skipOptional, () => dispatch({type: 'setting', key: 'skipOptional', value: !s.settings.skipOptional})),
      checkbox(L.ranking, s.settings.showRanking, () => dispatch({type: 'setting', key: 'showRanking', value: !s.settings.showRanking})));
    if (s.stage?.kind === 'lab') add(panel, button(L.fallback, () => dispatch({type: 'skipLab'})));
    if (d?.optional && s.stage?.sub === 'vote') add(panel, button(L.skip, () => dispatch({type: 'skipDecision'})));
    if (s.phase === 'SETUP') add(panel, el('p', {}, L.privacy), ...teamIds.map(t => field(`${t}${L.team}`, s.teams[t].name, value => dispatch({type: 'teamName', team: t, value}))));
    if (s.phase === 'EXPERT_STUDY') for (const m of manuals.manuals) add(panel, el('h3', {}, m.label), ...m.quiz.map(q => el('p', {class: 'small'}, q.q + ' → ' + q.options[q.answer] + ' · ' + q.why)));
    if (c) for (const m of manuals.manuals) {
      const text = (m.callouts as Record<string, string>)[c.id];
      if (text) add(panel, el('p', {class: 'small'}, m.symbol + ' ' + text));
    }
    if (s.phase === 'AI_CHECK') add(panel, el('h3', {}, 'checklist'), ...scenario.aiCheck.checklist.map(x => el('p', {class: 'small'}, x.question)));
    // AI 답 붙여넣기: 의뢰 유산으로 별도 탭에서 물은 답(docs/12 §7)
    if (!s.aiCheck.pastedAnswer.text && !scenario.aiCheck.capturedAnswers.length) add(panel, el('p', {class: 'small', 'data-testid': 'missing-ai'}, L.noAI));
    const ai = {...s.aiCheck.pastedAnswer};
    const model = el('input', {'aria-label': L.modelName, value: ai.model, maxlength: 200});
    const date = el('input', {'aria-label': L.date, type: 'date', value: ai.date});
    const text = el('textarea', {'aria-label': L.answer, maxlength: 20000}, ai.text);
    add(panel, el('h2', {}, L.aiAnswer),
      s.program.heritage.name ? el('p', {class: 'small'}, `${L.promptForTeacher}: ${aiPrompt(s)}`) : null,
      el('label', {class: 'field'}, L.modelName, model), el('label', {class: 'field'}, L.date, date), el('label', {class: 'field'}, L.answer, text),
      button(L.save, () => {
        if (text.value && model.value && date.value) dispatch({type: 'pasteAI', value: {model: model.value, date: date.value, text: text.value}});
        else toast(L.noAI);
      }));
    add(panel, ...teamIds.map(t => el('p', {class: 'small'}, `${s.teams[t].name} · ${Object.values(s.teams[t].health).reduce((a, b) => a + b, 0)} · ${s.teams[t].badges.join(' ')}`)),
      el('pre', {}, store.get().log.slice(-10).map(x => `${x.event}: ${x.value}`).join('\n')));
    return panel;
  }

  function tick() {
    const chip = document.querySelector('#timer');
    if (!chip) return;
    const s = state();
    const left = remaining(s);
    chip.textContent = planned(s) ? `${s.settings.paused ? 'Ⅱ ' : ''}${left < 0 ? '−' : ''}${Math.floor(Math.abs(left) / 60)}:${String(Math.abs(left) % 60).padStart(2, '0')}` : '';
    chip.className = 'timer ' + (left < 0 ? 'over' : left < 30 ? 'warn' : '');
  }

  /** 단계별 키 매핑. 클리커(PageDown/PageUp)와 키보드만으로 끝까지 진행할 수 있어야 한다. */
  function keyAction(key: string, s: AppState): Action | 'other' | 'reasons' | 'exports' | 'history' | undefined {
    if (['ARROWRIGHT', 'PAGEDOWN', ' '].includes(key)) return {type: 'next'};
    if (['ARROWLEFT', 'PAGEUP'].includes(key)) return {type: 'prev'};
    if (/^[1-4]$/.test(key)) return {type: 'selectTeam', team: Number(key) as TeamId};
    if (/^[A-D]$/.test(key)) {
      if (s.stage?.kind === 'predict') return {type: 'predict', value: key.charCodeAt(0) - 65};
      if (s.phase === 'TEST') return {type: 'testVote', choice: key};
      if (s.phase === 'AI_CHECK' && s.subScreen !== 1) {
        const o = scenario.aiCheck.trustPoll.options[key.charCodeAt(0) - 65];
        return o ? {type: 'trust', key: s.subScreen === 2 ? 'after' : 'before', value: o.id} : undefined;
      }
      return {type: 'vote', choice: key};
    }
    if (key === 'ENTER') return {type: s.stage?.kind === 'predict' ? 'lock' : s.stage?.kind === 'decision' && s.stage.sub === 'vote' ? 'confirm' : 'next'};
    if (key === 'T') return {type: 'panel'};
    if (key === 'P') return {type: 'pause'};
    if (key === 'F') return {type: 'fast'};
    if (key === 'H') return 'history';
    if (key === 'O') return 'other';
    if (key === 'R') return 'reasons';
    if (key === 'E') return 'exports';
    if (key === 'ESCAPE' && s.settings.showTeacherPanel) return {type: 'panel'};
    return undefined;
  }

  window.addEventListener('resize', fitStage);
  setInterval(tick, 1000);
  window.addEventListener('pagehide', persist);
  document.addEventListener('keydown', e => {
    if (modalOpen()) return;
    const target = e.target as HTMLElement;
    if (target.closest('input,textarea,select,[contenteditable]')) {
      if (e.key === 'Escape') target.blur();
      return;
    }
    if (e.key === 'Tab' || (['Enter', ' '].includes(e.key) && target.closest('button,a'))) return;
    const s = state();
    const action = keyAction(e.key.toUpperCase(), s);
    if (!action) return;
    e.preventDefault();
    if (action === 'other') showOtherPaths({s, main: document.createElement('main'), view, dispatch, rerender: render, title: () => {}});
    else if (action === 'reasons') reasons();
    else if (action === 'exports') exports();
    else if (action === 'history') { if (s.phase === 'AI_CHECK') showRealCase(); }
    else dispatch(action);
  });

  const validation = validateContent(scenario, manuals, labs);
  if (validation.errors.length) {
    root.append(el('pre', {}, validation.errors.join('\n')));
    return;
  }
  render();
  if (oldStored) toast(L.oldVersion);
  if (stored) {
    const resumed = stored;
    modal(L.resume, [
      {label: L.resume, run: () => {
        resumed.state.phaseStartedAt = Date.now();
        Object.assign(resumed.state.settings, {timerOffsetSec: 0, pausedMs: 0, paused: false});
        append(resumed.log, resumed.state, 'phase_enter', {note: 'resumed'});
        store.set(() => resumed);
        persist();
        render();
      }},
      {label: L.fresh, run: reset},
    ]);
  }
}
