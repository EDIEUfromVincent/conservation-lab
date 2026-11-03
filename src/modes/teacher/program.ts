import {scenario} from '../../content/loadContent';
import type {ResultType} from '../../content/types';
import {heritageOptions, teamIds, testerOf} from '../../core/actions';
import type {AppState, ProgramDecision} from '../../core/types';
import {checkProgram, blockingBugs, usedChoices, type Bug} from '../../engine/programCheck';
import {add, el, button} from '../../ui/dom';
import {L} from '../../ui/labels';
import {type Ctx, mentorFor, programGraph, mark, symbolOf, expertSymbols} from './shared';

const RESULTS: ResultType[] = ['solved', 'worse', 'irreversible'];
const SHAPES = ['○', '△', '□'];

export const bugsOf = (s: AppState) => checkProgram(s.program, s.clusters, scenario.program);
export function bugMessage(bug: Bug) {
  const text = (scenario.program.bugMessages as Record<string, string>)[bug.rule];
  return bug.stepName ? text.replace('{step}', bug.stepName) : text;
}

/** S30 저녁 의뢰 도착: 네 팀의 후보 중 하나를 반이 고르고, 위험을 한 줄로 정한다. */
export function requestScreen({s, main, title, dispatch}: Ctx) {
  const p = scenario.program;
  title(p.requestTitle, scenario.story.labName);
  const all = heritageOptions(s);
  const teamPicks = all.filter(h => teamIds.some(t => s.teams[t].heritage === h.name));
  const candidates = teamPicks.length ? teamPicks : all;
  add(main, mentorFor(s), el('p', {}, p.requestPrompt));
  if (!teamPicks.length) add(main, el('p', {class: 'small'}, L.noTeamHeritage));
  add(main, el('div', {class: 'cards heritage-cards'}, ...candidates.map(h => {
    const teams = teamIds.filter(t => s.teams[t].heritage === h.name);
    const chosen = s.program.heritage.name === h.name;
    return el('button', {
      type: 'button', class: 'card heritage' + (chosen ? ' chosen' : ''), 'aria-pressed': chosen, 'data-heritage': h.name,
      onclick: () => dispatch({type: 'requestPick', value: h.name}),
    },
    el('span', {class: 'material-chip'}, h.material || '—'),
    el('strong', {}, h.name),
    el('span', {class: 'small'}, `${L.pickedBy}: ${teams.map(t => s.teams[t].name).join(', ') || '—'} · ${s.heritageTally[h.name] ?? 0}${L.personUnit}`),
    h.experts.length ? el('span', {class: 'small'}, `${L.expertsNeeded}: ${expertSymbols(h.experts)}`) : null);
  })));
  add(main, el('label', {class: 'field wide'}, el('span', {}, p.riskPrompt),
    el('input', {value: s.program.heritage.risk, maxlength: 80, 'aria-label': L.riskLabel,
      onchange: (e: Event) => dispatch({type: 'requestRisk', value: (e.target as HTMLInputElement).value}, {render: false})})));
}

/** 결정 하나의 입력 양식(S31·S33 공통). 입력할 때마다 다시 그리지 않고 미리보기만 고친다. */
function decisionForm(ctx: Ctx, d: ProgramDecision, refresh: () => void) {
  const {s, dispatch} = ctx;
  const max = scenario.program.maxChars;
  const edit = (field: string, text: string, choice?: string) => {
    dispatch({type: 'programEdit', key: d.id, choice, value: {field, text}}, {render: false});
    refresh();
  };
  const textInput = (label: string, value: string, field: string, choice?: string) => {
    const counter = el('span', {class: 'counter'});
    const update = (text: string) => {
      const n = [...text].length;
      counter.textContent = n > max ? `${n}/${max} · ${L.tooLong}` : `${n}/${max}`;
      counter.classList.toggle('over', n > max);
    };
    const input = el('input', {value, maxlength: 120, 'aria-label': `${d.owner}${L.team} ${choice ?? ''} ${label}`.replace('  ', ' '),
      oninput: (e: Event) => update((e.target as HTMLInputElement).value),
      onchange: (e: Event) => edit(field, (e.target as HTMLInputElement).value, choice)});
    update(value);
    return el('label', {class: 'field'}, el('span', {}, label, ' ', counter), input);
  };
  return el('div', {class: 'decision-form', 'data-decision': d.id},
    el('h2', {}, `${L.decisionLabel} ${d.id.slice(1)} · ${L.owner} ${s.teams[d.owner].name}`),
    textInput(L.situation, d.situation, 'situation'),
    ...d.choices.map((ch, i) => {
      const group = el('div', {class: 'result-buttons', role: 'group', 'aria-label': `${ch.key} ${L.resultLabels}`},
        ...RESULTS.map(r => button(scenario.outcomeTypes[r].symbol + ' ' + scenario.outcomeTypes[r].label, () => {
          const next = ch.result === r ? '' : r;
          ch.result = next;
          group.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(RESULTS[j] === next)));
          edit('result', next, ch.key);
        }, {'aria-pressed': ch.result === r, 'data-result': r})));
      const stepSelect = el('select', {'aria-label': `${ch.key} ${L.step}`,
        onchange: (e: Event) => edit('stepId', (e.target as HTMLSelectElement).value, ch.key)},
        el('option', {value: ''}, L.noStep),
        ...s.clusters.map((c, j) => el('option', {value: c.id, selected: ch.stepId === c.id}, `${j + 1}. ${c.name || L.unnamed}`)));
      return el('fieldset', {class: 'choice-form'},
        el('legend', {}, `${ch.key} ${SHAPES[i]}`),
        textInput(L.action, ch.label, 'label', ch.key),
        group,
        textInput(L.why, ch.why, 'why', ch.key),
        el('label', {class: 'field'}, el('span', {}, L.step), stepSelect));
    }));
}

function bugList(s: AppState, bugs: Bug[], onFix?: (decisionId: string) => void) {
  return el('ul', {class: 'bug-list', 'data-testid': 'bug-list'}, ...bugs.map(b => {
    const d = s.program.decisions.find(x => x.id === b.decisionId);
    return el('li', {class: b.severity, 'data-rule': b.rule},
      el('strong', {}, b.rule), ' ',
      d ? `${s.teams[d.owner].name}${b.choiceKey ? ' ' + b.choiceKey : ''} · ` : '',
      bugMessage(b),
      d && onFix ? button(L.fixThis, () => onFix(d.id)) : null);
  }));
}

/** S31 프로그램 설계·입력: 팀마다 결정 하나(docs/12 §6.2) */
export function buildScreen(ctx: Ctx) {
  const {s, main, title, view, rerender} = ctx;
  const p = scenario.program;
  title(p.buildTitle, `${L.request} · ${s.program.heritage.name} · ${s.program.heritage.risk}`);
  const current = s.program.decisions.find(d => d.id === view.editDecision) ?? s.program.decisions[0];
  const preview = el('div', {class: 'program-preview'});
  const refresh = () => {
    const bugs = bugsOf(s);
    preview.replaceChildren(programGraph(s.program, current?.id), el('p', {class: 'small'}, `${L.bugsLeft} ${blockingBugs(bugs).length}`));
  };
  refresh();
  add(main, 
    el('ol', {class: 'build-steps small'}, ...p.buildSteps.map(x => el('li', {}, x))),
    el('div', {class: 'actions decision-tabs'}, ...s.program.decisions.map(d =>
      button(`${L.decisionLabel} ${d.id.slice(1)} · ${s.teams[d.owner].name}`, () => { view.editDecision = d.id; rerender(); },
        {'aria-pressed': d.id === current?.id, 'data-testid': `tab-${d.id}`}))),
    el('div', {class: 'build-layout'}, current ? decisionForm(ctx, current, refresh) : null, preview));
}

/** S32 실행 시험: 다른 팀이 결정을 게임처럼 따라간다. 점수 없음. */
export function testScreen(ctx: Ctx) {
  const {s, main, title, dispatch} = ctx;
  const p = scenario.program;
  const d = s.program.decisions[s.testCursor];
  title(p.testTitle, `${L.request} · ${s.program.heritage.name}`);
  if (!d) return;
  const run = s.testRuns.find(r => r.decisionId === d.id && r.version === s.program.version);
  const used = usedChoices(d.choices);
  add(main, 
    el('p', {class: 'eyebrow'}, `${s.program.decisions.map((_, i) => (i <= s.testCursor ? '●' : '○')).join(' ')} · ${s.teams[d.owner].name} → ${L.tester} ${s.teams[testerOf(d.owner)].name}`),
    el('h2', {class: 'situation'}, d.situation || L.emptyResult),
    el('div', {class: 'choices'}, ...used.map(ch => button(`${ch.key} ${SHAPES[d.choices.indexOf(ch)]}  ${ch.label}`,
      () => dispatch({type: 'testVote', choice: ch.key}), {class: 'choice', 'aria-pressed': run?.choice === ch.key}))));
  if (!run) return;
  const ch = d.choices.find(c => c.key === run.choice)!;
  add(main, 
    ch.result ? el('div', {class: 'outcome ' + ch.result}, mark(ch.result), el('p', {}, ch.why || '—'))
      : el('div', {class: 'outcome empty'}, el('p', {}, L.emptyResult)),
    bugList(s, bugsOf(s).filter(b => b.decisionId === d.id)),
    el('label', {class: 'field wide'}, el('span', {}, p.testPrompt),
      el('input', {value: run.note, maxlength: 200, 'aria-label': L.testNote,
        onchange: (e: Event) => dispatch({type: 'testNote', value: (e.target as HTMLInputElement).value}, {render: false})})));
}

/** S33 버그 고치기: 자동 검사 + 시험한 팀의 지적 → 고치고 다시 실행 */
export function debugScreen(ctx: Ctx) {
  const {s, main, title, dispatch, view, rerender} = ctx;
  const p = scenario.program;
  title(p.debugTitle, `${L.version} ${s.program.version}`);
  const bugs = bugsOf(s);
  const blocking = blockingBugs(bugs);
  const notes = s.testRuns.map((r, i) => ({r, i})).filter(x => x.r.note);
  const editing = s.program.decisions.find(d => d.id === view.editDecision);
  const preview = el('div', {class: 'program-preview'});
  const refresh = () => preview.replaceChildren(programGraph(s.program, editing?.id));
  refresh();
  add(main, 
    el('p', {}, p.debugPrompt),
    el('div', {class: 'build-layout'},
      el('div', {class: 'debug-lists'},
        el('h2', {}, L.autoBugs),
        blocking.length ? null : el('p', {class: 'pass', 'data-testid': 'pass'}, p.passMessage),
        bugs.length ? bugList(s, bugs, id => { view.editDecision = id; rerender(); }) : null,
        el('h2', {}, L.testerBugs),
        el('ul', {class: 'bug-list'}, ...notes.map(({r, i}) => {
          const d = s.program.decisions.find(x => x.id === r.decisionId);
          return el('li', {class: r.resolved ? 'resolved' : 'warn'},
            `${d ? s.teams[d.owner].name : ''} · ${r.note} `,
            button(L.resolved, () => dispatch({type: 'resolveNote', key: String(i)}), {'aria-pressed': r.resolved}),
            d ? button(L.fixThis, () => { view.editDecision = d.id; rerender(); }) : null);
        })),
        button(`${L.retest} (${L.bugsLeft} ${blocking.length})`, () => dispatch({type: 'retest'}), {class: 'primary', 'data-testid': 'retest'})),
      editing ? decisionForm(ctx, editing, refresh) : preview));
}

export {symbolOf};
