import {scenario, journalCards} from '../../content/loadContent';
import {add, el, button} from '../../ui/dom';
import {L} from '../../ui/labels';
import {type Ctx, mentorFor, journalCardView, symbolOf} from './shared';

/** S20 연구 일지 벽: 행동 카드를 학생 발언대로 묶는다(docs/12 §4·§5). 원칙 이름은 아직 나오지 않는다. */
export function journalScreen(ctx: Ctx) {
  const {s, main, title, dispatch, view, rerender} = ctx;
  const a = scenario.algorithm;
  title(a.wallTitle, scenario.story.labName);
  const placed = new Set(s.clusters.flatMap(c => c.cardIds));
  const entry = (id: string) => s.journal.find(j => j.cardId === id);
  const pick = (id: string) => {
    view.selectedCard = view.selectedCard === id ? '' : id;
    rerender();
  };
  const card = (id: string) => journalCardView(id, entry(id), {selected: view.selectedCard === id, onclick: () => pick(id)});
  const assign = (clusterId: string) => {
    if (!view.selectedCard) return;
    const id = view.selectedCard;
    view.selectedCard = '';
    dispatch({type: 'assignCard', key: id, value: clusterId});
  };
  // 이 수업에서 일지에 들어온 카드만(건너뛴 사건 없음 → 보통 11장)
  const cards = journalCards.filter(c => entry(c.id)).map(c => c.id);
  const unsorted = cards.filter(id => !placed.has(id));

  add(main, 
    mentorFor(s),
    el('p', {class: 'small'}, a.wallPrompt, ' ', L.clusterHint),
    el('div', {class: 'journal-wall'},
      el('section', {class: 'unsorted', 'data-testid': 'unsorted'},
        el('h2', {}, `${L.unsorted} ${unsorted.length}${L.cardUnit}`),
        el('div', {class: 'journal-grid'}, ...unsorted.map(card)),
        s.morningNotes.some(Boolean) ? el('div', {class: 'card small morning-recall'},
          el('strong', {}, L.morningNotes), ...s.morningNotes.filter(Boolean).map(n => el('p', {}, n))) : null),
      el('section', {class: 'clusters'},
        ...s.clusters.map((c, i) => el('div', {class: 'cluster' + (view.selectedCard ? ' droppable' : ''), 'data-cluster': c.id},
          el('div', {class: 'cluster-head'},
            el('h3', {}, `${L.clusterLabel} ${i + 1}${c.name ? ' · ' + c.name : ''}`),
            button(L.moveHere, () => assign(c.id), {disabled: !view.selectedCard, 'data-testid': `move-${c.id}`}),
            button(L.removeCluster, () => dispatch({type: 'removeCluster', key: c.id}))),
          el('div', {class: 'journal-grid'}, ...c.cardIds.map(card)))),
        s.clusters.length < a.clusterMax ? button(L.addCluster, () => dispatch({type: 'addCluster'}), {'data-testid': 'add-cluster'}) : null)),
    view.selectedCard && placed.has(view.selectedCard)
      ? button(L.takeOut, () => { const id = view.selectedCard; view.selectedCard = ''; dispatch({type: 'assignCard', key: id, value: ''}); })
      : null,
  );
}

/** S21 우리 반 알고리즘: 묶음 이름·순서 → [전문가의 원칙과 비교]에서 처음으로 P1~P5 공개 */
export function algorithmScreen(ctx: Ctx) {
  const {s, main, title, dispatch, view, rerender} = ctx;
  const a = scenario.algorithm;
  const steps = s.clusters.filter(c => c.cardIds.length);
  if (s.subScreen === 0) {
    title(L.ourAlgorithm, scenario.story.labName);
    add(main, mentorFor(s), el('p', {}, a.prompt));
    if (steps.length < a.clusterMin) add(main, el('p', {class: 'warn'}, L.clusterCountWarn));
    if (!s.clusters.length) add(main, el('p', {}, L.noClusters));
    add(main, el('ol', {class: 'algorithm-steps'}, ...s.clusters.map((c, i) => el('li', {class: 'card', 'data-step': c.id},
      el('div', {class: 'step-head'},
        el('span', {class: 'step-no'}, String(i + 1)),
        el('label', {class: 'field'}, el('span', {}, L.stepName),
          el('input', {value: c.name, maxlength: 30, 'aria-label': `${L.stepName} ${i + 1}`,
            onchange: (e: Event) => dispatch({type: 'clusterName', key: c.id, value: (e.target as HTMLInputElement).value}, {render: false})})),
        button(L.up, () => dispatch({type: 'clusterMove', key: c.id, value: -1}), {disabled: i === 0}),
        button(L.down, () => dispatch({type: 'clusterMove', key: c.id, value: 1}), {disabled: i === s.clusters.length - 1})),
      el('ul', {class: 'small'}, ...c.cardIds.map(id => el('li', {}, journalCards.find(x => x.id === id)!.text)))))));
    return;
  }
  // 비교: 우리 단계(묶음) ↔ 카드의 숨은 원칙
  title(a.compareLabel, scenario.story.labName);
  add(main, el('div', {class: 'actions compare-head'}, el('p', {}, a.compareNote),
    button(L.overlay, () => { view.overlay = !view.overlay; rerender(); }, {'aria-pressed': view.overlay})));
  if (view.overlay) add(main, overlayTable(ctx));
  else {
    add(main, el('div', {class: 'compare'},
      el('div', {class: 'compare-ours'}, el('h2', {}, L.ourStep),
        ...steps.map((c, i) => el('div', {class: 'compare-step'},
          el('h3', {}, `${i + 1}. ${c.name || L.unnamed}`),
          el('ul', {}, ...c.cardIds.map(id => {
            const card = journalCards.find(x => x.id === id)!;
            return el('li', {'data-card': id}, el('span', {class: 'principle-tag journal-principle'}, card.hiddenPrinciple), ' ', card.text);
          }))))),
      el('div', {class: 'compare-experts'}, el('h2', {}, L.expertPrinciple),
        ...scenario.principles.map(p => {
          const count = s.journal.filter(j => journalCards.find(c => c.id === j.cardId)?.hiddenPrinciple === p.id).length;
          return el('div', {class: 'card principle'}, el('h3', {}, `${p.id} ${p.label}`), el('p', {}, p.kid),
            el('p', {class: 'small'}, `${count}${L.cardUnit}`));
        }))));
  }
  add(main, el('p', {class: 'hub'}, scenario.experts.find(e => e.id === 'adhesive')!.symbol + ' ' + a.hubQuestion));
}

/** 행 = 사건, 열 = 우리 반 단계. 칸 = 그 단계 카드에서 반이 고른 결과 기호 */
function overlayTable({s}: Ctx) {
  const steps = s.clusters.filter(c => c.cardIds.length);
  return el('table', {class: 'matrix'},
    el('thead', {}, el('tr', {}, el('th', {}, L.trial), ...steps.map((c, i) => el('th', {}, `${i + 1}. ${c.name || L.unnamed}`)))),
    el('tbody', {}, ...scenario.cases.map(cs => el('tr', {}, el('th', {}, cs.title), ...steps.map(step => {
      const marks = step.cardIds
        .map(id => s.journal.find(j => j.cardId === id))
        .filter(j => j && j.caseId === cs.id)
        .map(j => symbolOf(j!.classResult));
      return el('td', {}, marks.join(' ') || '—');
    })))));
}
