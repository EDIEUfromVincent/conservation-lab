import {scenario, journalCards} from '../../content/loadContent';
import type {Outcome, ResultType} from '../../content/types';
import type {Action} from '../../core/actions';
import {usedChoices} from '../../engine/programCheck';
import type {AppState, JournalEntry, Program} from '../../core/types';
import {el} from '../../ui/dom';
import {svg} from '../../ui/art';
import {L} from '../../ui/labels';
import {phaseId} from '../../core/timer';

/** 교사 화면 안에서만 쓰는 보기 상태(저장하지 않음) */
export interface ViewState {
  matrixMode: 'class' | 1 | 2 | 3 | 4;
  showGraph: boolean;
  expandedLab: string;
  selectedCard: string;
  editDecision: string;
  overlay: boolean;
}
export interface Ctx {
  s: AppState;
  main: HTMLElement;
  view: ViewState;
  dispatch: (a: Action, opts?: {render?: boolean}) => void;
  rerender: () => void;
  title: (text: string, eyebrow?: string) => void;
}

export function mark(result: ResultType) {
  const o = scenario.outcomeTypes[result];
  return el('div', {class: 'outcome-mark ' + o.shape, role: 'img', 'aria-label': o.symbol + ' ' + o.label},
    el('span', {class: 'symbol'}, o.symbol), o.label);
}
export function outcomeCard(o: Outcome) {
  return el('div', {class: 'outcome ' + o.result, 'data-node': o.id}, mark(o.result), el('p', {}, o.text));
}
export const symbolOf = (result: ResultType | '' | null) => (result ? scenario.outcomeTypes[result].symbol : '·');

/** 연구실장 말풍선. 단계마다 data의 story.mentor에서 읽는다. */
export function mentor(text: string | undefined) {
  if (!text) return null;
  return el('div', {class: 'mentor', role: 'note'},
    el('span', {class: 'mentor-face', 'aria-hidden': 'true'}, '◐'),
    el('div', {}, el('strong', {}, L.mentor), el('p', {}, text)));
}
export const mentorFor = (s: AppState) => mentor((scenario.story.mentor as Record<string, string>)[phaseId(s)]);

/** 행동 카드 한 장. 원칙 이름은 넣지 않는다(revealPrinciple일 때만, S21 비교에서). */
export function journalCardView(cardId: string, entry?: JournalEntry, opts: {selected?: boolean; revealPrinciple?: boolean; onclick?: () => void} = {}) {
  const card = journalCards.find(c => c.id === cardId)!;
  const c = scenario.cases.find(x => x.id === card.caseId)!;
  const result = entry?.classResult ?? null;
  const note = entry ? (result === null ? L.classSkipped : result === 'solved' ? L.classSame : L.classDifferent) : '';
  const principle = scenario.principles.find(p => p.id === card.hiddenPrinciple)!;
  const body = [
    el('p', {class: 'journal-text'}, card.text),
    el('p', {class: 'small journal-meta'}, `#${c.order} ${c.title}`),
    entry ? el('p', {class: 'small journal-class'}, `${symbolOf(result)} ${note}`) : null,
    opts.revealPrinciple ? el('p', {class: 'journal-principle'}, `${principle.id} ${principle.label}`) : null,
  ];
  const attrs = {class: 'journal-card' + (opts.selected ? ' selected' : ''), 'data-card': cardId};
  return opts.onclick
    ? el('button', {type: 'button', ...attrs, 'aria-pressed': !!opts.selected, onclick: opts.onclick}, ...body)
    : el('div', attrs, ...body);
}

/** 프로그램 미리보기: 결정을 왼쪽에서 오른쪽으로, 길마다 결과 기호(사건 그래프와 같은 모양) */
export function programGraph(program: Program, highlight = '') {
  const n = Math.max(1, program.decisions.length);
  const width = 360 * n + 80;
  const graph = svg('svg', {viewBox: `0 0 ${width} 300`, class: 'program-graph', role: 'img', 'aria-label': L.programPreview});
  graph.append(svg('path', {d: `M20 150 H${width - 20}`, stroke: '#b9b0a0', 'stroke-width': 4}));
  program.decisions.forEach((d, i) => {
    const x = 80 + i * 360;
    const used = usedChoices(d.choices);
    const box = svg('rect', {x: x - 60, y: 110, width: 120, height: 80, rx: 14,
      fill: d.id === highlight ? '#326c62' : '#fffdf6', stroke: '#326c62', 'stroke-width': 5});
    const label = svg('text', {x, y: 165, 'text-anchor': 'middle', 'font-size': 44, 'font-weight': 700, fill: d.id === highlight ? '#fff' : '#222'});
    label.textContent = `${d.owner}${L.team}`;
    graph.append(box, label);
    used.forEach((ch, j) => {
      const y = 40 + j * 110;
      graph.append(svg('path', {d: `M${x + 60} 150 C${x + 100} 150 ${x + 100} ${y} ${x + 140} ${y} S${x + 260} 150 ${x + 300} 150`,
        fill: 'none', stroke: ch.result === 'solved' ? '#326c62' : '#a59c8a', 'stroke-width': ch.result === 'solved' ? 8 : 4}));
      const t = svg('text', {x: x + 150, y: y + 14, 'font-size': 40, 'font-weight': 700, fill: '#222'});
      t.textContent = `${ch.key} ${symbolOf(ch.result)}`;
      graph.append(t);
    });
  });
  return graph;
}

export const expertSymbols = (ids: readonly string[]) =>
  ids.map(id => scenario.experts.find(e => e.id === id)).filter(Boolean).map(e => `${e!.symbol} ${e!.short}`).join(' · ');
