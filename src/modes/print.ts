import {scenario, manuals} from '../content/loadContent';
import {el, button} from '../ui/dom';
import {L} from '../ui/labels';
import {manualBody} from './manual';

const RESULT_MARKS = Object.values(scenario.outcomeTypes).map(o => o.symbol).join(' / ');

/** 인쇄: 전문가 매뉴얼 4종 + W1~W5(docs/12 §6.5). 교사 노트·퀴즈 해설은 넣지 않는다. */
export function mountPrint(root: HTMLElement) {
  root.className = 'print-mode';
  root.append(el('nav', {class: 'no-print'}, button(L.print, () => window.print())));
  for (const m of manuals.manuals) root.append(el('section', {class: 'sheet manual-sheet'}, manualBody(m, true)));
  const sheet = (i: number, ...children: HTMLElement[]) => el('section', {class: 'sheet worksheet'}, el('h1', {}, L.worksheet[i]), ...children);
  const writing = () => el('div', {class: 'writing-box'});
  const line = () => el('div', {class: 'answer-line'});

  // W3 팀 설계 카드: 결정 하나(상황 + 길 A/B/C)
  const choiceRow = (key: string) => el('div', {class: 'design-choice'},
    el('h3', {}, key),
    el('p', {}, L.action), line(),
    el('p', {}, `${L.resultLabels}: ${RESULT_MARKS}`),
    el('p', {}, L.why), line(),
    el('p', {}, L.step), line());

  root.append(
    sheet(0,
      el('h2', {}, scenario.heritagePick.prompt), el('p', {}, scenario.heritagePick.sub), el('div', {class: 'drawing-box'}),
      el('h2', {}, scenario.intro.worksheetPrompt), writing()),
    sheet(1,
      el('table', {}, el('thead', {}, el('tr', {}, ...L.worksheetColumns.map(x => el('th', {}, x)))),
        el('tbody', {}, ...scenario.cases.map(c => el('tr', {}, el('th', {}, c.title), ...Array.from({length: 5}, () => el('td', {}, ' ')))))),
      el('p', {}, scenario.reasonTags.map(x => x.label).join(' · '))),
    sheet(2,
      el('h2', {}, `${L.request} · ${L.heritageName}`), line(),
      el('h2', {}, `${L.team} · ${L.decisionLabel} · ${L.situation}`), writing(),
      ...['A', 'B', 'C'].map(choiceRow)),
    sheet(3, ...scenario.reflection.questions.flatMap(x => [el('h2', {}, x), writing()])),
    sheet(4,
      el('h2', {}, scenario.homework.title),
      ...scenario.homework.fields.flatMap(x => [el('h3', {}, x), line()])),
  );
}
