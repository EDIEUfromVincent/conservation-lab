import {scenario, labs} from '../../content/loadContent';
import type {Decision} from '../../content/types';
import {teamIds} from '../../core/actions';
import {currentCase, decision, outcome, labKey} from '../../core/caseRunner';
import {add, el, button} from '../../ui/dom';
import {illustration} from '../../ui/art';
import {modal} from '../../ui/components/Modal';
import {L} from '../../ui/labels';
import {type Ctx, mentor, outcomeCard, journalCardView} from './shared';

const SHAPES = ['○', '△', '□'];

export function fileBand(order: number, place: string, year: string) {
  return scenario.story.fileLabel.replace('{n}', String(order)) + ` · ${place} · ${year}`;
}

export function showOtherPaths(ctx: Ctx) {
  const d = decision(ctx.s);
  if (!d || ctx.s.stage?.sub === 'vote') return;
  modal(L.other, [], el('div', {class: 'lines'}, ...d.choices.map(ch => outcomeCard(outcome(ctx.s, ch.key)!))));
}

export function caseScreen(ctx: Ctx) {
  const {s, main, title, dispatch} = ctx;
  const c = currentCase(s);
  const st = s.stage!;
  const d = decision(s);
  const eyebrow = fileBand(c.order, c.place, c.year);
  switch (st.kind) {
    case 'brief':
      title(c.title, eyebrow);
      add(main, 
        st.line === 1 ? mentor((scenario.story.bridges as Record<string, string>)[c.id]) : null,
        el('div', {class: 'split'}, illustration(c.id),
          el('div', {class: 'lines'}, ...c.brief.lines.slice(0, st.line).map(x => el('p', {}, x)), el('p', {class: 'small'}, c.material))));
      break;
    case 'experts':
      title(c.title, eyebrow);
      add(main, el('div', {class: 'experts'}, ...[c.lead, ...c.support].map((id, i) => {
        const e = scenario.experts.find(e => e.id === id)!;
        return el('div', {class: 'card expert ' + id}, el('h1', {}, e.symbol), el('h2', {}, e.label),
          el('p', {class: 'small'}, scenario.teamSetup.roleRules[i === 0 ? 0 : 1]));
      })));
      break;
    case 'predict': predictView(ctx); break;
    case 'lab': labView(ctx); break;
    case 'decision':
      title(d!.prompt, eyebrow);
      if (st.sub === 'vote') voteView(ctx, d!);
      else if (st.sub === 'outcome') {
        add(main, 
          outcomeCard(outcome(s, s.currentChoice)!),
          el('div', {class: 'team-votes'}, ...teamIds.map(t => {
            const v = s.draft[t];
            const o = v ? outcome(s, v.choice) : null;
            return el('div', {class: 'card small'}, s.teams[t].name,
              el('p', {}, v ? `${v.choice} · ${scenario.outcomeTypes[o!.result].symbol} ${scenario.outcomeTypes[o!.result].label}` : L.missing));
          })),
          el('div', {class: 'actions'}, button(L.other, () => showOtherPaths(ctx)), button(L.delayed, () => dispatch({type: 'fast'}))));
      } else if (st.sub === 'delayed') {
        const all = [outcome(s, s.currentChoice), ...teamIds.map(t => (s.draft[t] ? outcome(s, s.draft[t]!.choice) : undefined))]
          .filter((o, i, arr) => o?.delayed && arr.findIndex(x => x?.id === o.id) === i);
        add(main, el('div', {class: 'lines'}, ...all.map(o => el('div', {class: 'card'}, el('h2', {}, o!.delayed!.label), el('p', {}, o!.delayed!.text)))));
      } else {
        add(main, el('p', {}, L.retryAsk), el('div', {class: 'actions'},
          button(L.continue, () => dispatch({type: 'next'}), {class: 'primary'}),
          button(L.retry, () => dispatch({type: 'retry'}), {'data-testid': 'retry'})));
      }
      break;
    case 'historyJoin': {
      title(L.history, eyebrow);
      const n = c.nodes.find(n => n.id === st.nodeId);
      if (n?.type === 'historyJoin') add(main, el('div', {class: 'card'}, el('p', {}, n.text)));
      break;
    }
    case 'history':
      title(L.history, eyebrow);
      add(main, el('div', {class: 'timeline'}, ...c.history!.lines.map(t => el('p', {}, t))),
        el('p', {class: 'small'}, L.source + ' · ' + c.history!.sources.map(x => x.title).join(' / ')));
      break;
    case 'wrap': {
      // S19 연구 일지 기록: 이 사건의 행동 카드가 일지에 들어간다. 원칙 이름은 나오지 않는다.
      title(L.journalTitle, eyebrow);
      const cards = c.nodes.filter((n): n is Decision => n.type === 'decision').map(n => n.journal.id);
      add(main, 
        el('div', {class: 'journal-row'}, ...cards.map(id => journalCardView(id, s.journal.find(j => j.cardId === id)))),
        el('p', {class: 'wrap-question'}, c.wrap.question),
        el('p', {class: 'small'}, L.worksheet[1]));
      break;
    }
  }
}

function voteView({s, main, dispatch}: Ctx, d: Decision) {
  // 앞 사건 일지 태그는 일지에 카드가 생긴 뒤(사건 2부터)만 보인다.
  const tags = scenario.reasonTags.filter(r => r.id !== 'journal' || s.journal.length);
  if (d.context) add(main, el('p', {class: 'small'}, d.context));
  add(main, 
    el('div', {class: 'choices'}, ...d.choices.map((ch, i) =>
      button(`${ch.key} ${SHAPES[i]}  ${ch.label}`, () => dispatch({type: 'vote', choice: ch.key}), {class: 'choice'}))),
    el('div', {class: 'team-votes'}, ...teamIds.map(t => el('div', {class: 'team-vote ' + (t === s.selectedTeam ? 'active' : '')},
      button(s.teams[t].name, () => dispatch({type: 'selectTeam', team: t})),
      el('div', {class: 'actions'}, ...d.choices.map(ch =>
        button(ch.key, () => dispatch({type: 'vote', team: t, choice: ch.key}), {'aria-pressed': s.draft[t]?.choice === ch.key}))),
      el('small', {}, s.draft[t]?.reasons.map(r => scenario.reasonTags.find(x => x.id === r)?.label).join(' · ') || L.missing)))),
    el('div', {class: 'actions reason-tags'},
      el('span', {}, `${s.selectedTeam}${L.team} · ${L.reason}`),
      ...tags.map(r => button(r.label, () => dispatch({type: 'reason', key: r.id}), {'aria-pressed': s.draft[s.selectedTeam]?.reasons.includes(r.id)})),
      button(L.confirm, () => dispatch({type: 'confirm'}), {class: 'primary'})));
}

function predictView({s, main, title, dispatch}: Ctx) {
  const lab = currentCase(s).lab!;
  const pred = s.predictions[lab.id] ?? {};
  title(lab.predict.prompt, L.predict);
  if (lab.predict.type === 'rank') add(main, el('p', {class: 'small'}, L.rank));
  add(main, el('div', {class: 'team-votes'}, ...teamIds.map(t => el('div', {class: 'card ' + (t === s.selectedTeam ? 'active' : '')},
    button(s.teams[t].name, () => dispatch({type: 'selectTeam', team: t})),
    el('p', {class: 'prediction-value'}, Array.isArray(pred[t]) ? (pred[t] as string[]).join(' → ') : String(pred[t] ?? L.missing))))));
  if (lab.predict.type === 'number') {
    add(main, el('label', {class: 'field'}, el('span', {}, L.predict),
      el('input', {type: 'number', value: String(pred[s.selectedTeam] ?? ''), 'aria-label': L.predict,
        onchange: (e: Event) => dispatch({type: 'predict', value: Number((e.target as HTMLInputElement).value)})})));
  } else {
    add(main, el('div', {class: 'predict-options'}, ...lab.predict.options!.map((opt, i) =>
      button(String.fromCharCode(65 + i) + ' · ' + opt, () => dispatch({type: 'predict', value: i})))));
  }
  add(main, el('div', {class: 'actions'},
    button(L.resetPrediction, () => dispatch({type: 'predict', value: null})),
    button(L.lock, () => dispatch({type: 'lock'}), {class: 'primary'})));
}

function labView(ctx: Ctx) {
  const {s, main, title, dispatch, view, rerender} = ctx;
  const c = currentCase(s);
  const lab = c.lab!;
  title(lab.title, L.observe + (s.settings.quickLabs ? ' · ' + L.quick : ''));
  const key = labKey(s);
  const metrics = s.labResults[key];
  if (s.labSkipped[key]) add(main, el('div', {class: 'card'}, el('h2', {}, L.evidence), el('p', {}, lab.fallbackEvidence)));
  else if (!metrics || view.expandedLab === key) add(main, el('div', {id: 'lab-host'}));
  else {
    add(main, el('div', {class: 'card'}, ...metricLines(lab.id, metrics).map(t => el('p', {}, t))),
      button(L.observe, () => { view.expandedLab = key; rerender(); }));
  }
  if (metrics) {
    add(main, el('div', {class: 'lab-summary'}, el('strong', {}, L.completed), el('p', {}, L.observation),
      ...teamIds.filter(t => s.predictions[lab.id]?.[t] !== undefined).map(t => el('p', {class: 'small'},
        `${s.teams[t].name}: ${JSON.stringify(s.predictions[lab.id][t])} · ${predictionResult(lab.id, s.predictions[lab.id][t], metrics)}`))));
  }
  add(main, button(L.fallback, () => dispatch({type: 'skipLab'})));
}

function predictionResult(lab: string, value: unknown, metrics: Record<string, string | number>) {
  if ('evidence' in metrics) return L.evidence;
  const options = (i: number) => scenario.cases[i].lab!.predict.options!;
  let match: boolean | null = null;
  if (lab === 'lab1' && Array.isArray(value)) match = value[0] === options(0)[1];
  if (lab === 'lab2') {
    const count = Number(metrics.r1_correct);
    match = value === options(1)[count <= 3 ? 2 : count <= 7 ? 1 : 0];
  }
  if (lab === 'lab3' && Array.isArray(value)) match = value[0] === options(2)[0];
  if (lab === 'lab4' && Array.isArray(value)) match = value[0] === options(3)[3];
  if (lab === 'lab5') match = value === options(4)[0];
  return match === null ? L.missing : match ? L.samePrediction : L.differentPrediction;
}

function metricLines(id: string, m: Record<string, string | number>): string[] {
  if (id === 'lab1') return labs.lab1.conditions.filter(c => 'rust_' + c.id in m).map(c => c.label + ' · ' + m['rust_' + c.id]);
  if (id === 'lab2') {
    return [`1${L.round}: ${m.r1_correct} ${L.piece} · ${m.r1_seconds}${L.seconds}`,
      `2${L.round}: ${m.r2_correct} ${L.piece} · ${m.r2_seconds}${L.seconds}`, L.discard + ' ' + m.chips_discarded];
  }
  if (id === 'lab3') {
    try {
      return (JSON.parse(String(m.trials)) as Record<string, string | number>[]).map(r =>
        `${labs.lab3.adhesives.find(a => a.id === r.adhesive)?.label} · ${labs.lab3.tools.find(t => t.id === r.tool)?.label} · ${L.scratches} ${r.scratches} · ${r.days}${L.days}`);
    } catch {
      return [];
    }
  }
  if (id === 'lab4') return labs.lab4.samples.filter(x => x.id in m).map(x => x.label + ' · ' + m[x.id]);
  if ('reinforcement' in m) {
    return [labs.lab5.partA.reinforcements.find(r => r.id === m.reinforcement)?.label ?? '', L.remove + ' ' + m.removeSteps, L.damage + ' ' + m.damagedBlocks];
  }
  return [L.proof + ' ' + m.floorsWithEvidence, L.imagined + ' ' + m.floorsImagined];
}
