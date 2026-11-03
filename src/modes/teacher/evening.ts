import {scenario} from '../../content/loadContent';
import {teamIds} from '../../core/actions';
import type {AppState, StepCheck, TrustValue} from '../../core/types';
import {usedChoices} from '../../engine/programCheck';
import {add, el, button, lines} from '../../ui/dom';
import {modal} from '../../ui/components/Modal';
import {L} from '../../ui/labels';
import {type Ctx, mentorFor, programGraph, symbolOf} from './shared';

/** 붙여 넣은 답(의뢰 유산으로 물은 것)이 먼저, 없으면 미리 받아 둔 다른 사건의 답 */
export function aiAnswer(s: AppState) {
  if (s.aiCheck.pastedAnswer.text) return {...s.aiCheck.pastedAnswer, fallback: false};
  const captured = (scenario.aiCheck.capturedAnswers as {model: string; date: string; text: string}[])[s.aiCheck.answerIndex];
  return captured ? {...captured, fallback: true} : null;
}
export function aiPrompt(s: AppState) {
  return scenario.aiCheck.promptTemplate.replace('{heritage}', s.program.heritage.name).replace('{risk}', s.program.heritage.risk);
}
export function showRealCase() {
  modal(L.history, [], lines(scenario.aiCheck.real.lines));
}

function trustPoll(s: AppState, when: 'before' | 'after', dispatch: Ctx['dispatch']) {
  const poll = scenario.aiCheck.trustPoll;
  return el('div', {class: 'trust-poll'},
    el('h2', {}, poll[when]),
    el('div', {class: 'team-votes'}, ...teamIds.map(t => el('div', {class: 'team-vote' + (t === s.selectedTeam ? ' active' : ''), 'data-team': t},
      el('strong', {}, s.teams[t].name),
      el('div', {class: 'actions'}, ...poll.options.map((o, i) => button(`${String.fromCharCode(65 + i)} ${o.label}`,
        () => dispatch({type: 'trust', team: t, key: when, value: o.id}), {'aria-pressed': s.aiCheck.trust[t]?.[when] === o.id})))))));
}

/** S34 AI 조수 점검(docs/12 §7): 0 답 읽기+믿음 1차 → 1 우리 알고리즘으로 점검 → 2 믿음 2차 */
export function aiScreen(ctx: Ctx) {
  const {s, main, title, dispatch} = ctx;
  const ai = scenario.aiCheck;
  const answer = aiAnswer(s);
  title(L.aiAnswer, s.program.heritage.name || scenario.story.labName);
  if (s.subScreen === 0) add(main, mentorFor(s));
  const answerBox = el('div', {class: 'ai-answer-box'});
  if (!answer) answerBox.append(el('p', {class: 'warn', 'data-testid': 'missing-ai'}, L.noAI));
  else {
    if (answer.fallback) answerBox.append(el('p', {class: 'small'}, ai.fallbackNote), lines(ai.brief.lines));
    answerBox.append(el('p', {class: 'small'}, `${answer.model} · ${answer.date}`), el('div', {class: 'ai-answer'}, answer.text));
  }
  if (s.subScreen === 0) {
    add(main, el('div', {class: 'ai-layout'}, answerBox, trustPoll(s, 'before', dispatch)));
    return;
  }
  if (s.subScreen === 1) {
    const steps = s.clusters.filter(c => c.cardIds.length);
    const solved = s.program.decisions.flatMap(d => usedChoices(d.choices).filter(c => c.result === 'solved').map(c => ({d, c})));
    add(main, el('div', {class: 'ai-layout'}, answerBox,
      el('div', {},
        el('h2', {}, ai.checkTitle),
        el('div', {class: 'checklist'}, ...steps.map((c, i) => el('div', {class: 'card', 'data-step': c.id},
          el('p', {}, `${i + 1}. ${c.name || L.unnamed}`),
          el('div', {class: 'actions'}, ...ai.checkOptions.map(o => button(o.label,
            () => dispatch({type: 'aiStep', key: c.id, value: o.id as StepCheck}), {'aria-pressed': s.aiCheck.stepChecks[c.id] === o.id})))))),
        el('h2', {}, ai.compareTitle),
        el('ul', {class: 'solved-paths'}, ...solved.map(({d, c}) => el('li', {}, `${s.teams[d.owner].name} · ${c.label}`))),
        answer?.fallback ? button(L.history + ' H', showRealCase) : null)));
    return;
  }
  const changed = teamIds.filter(t => {
    const v = s.aiCheck.trust[t];
    return v?.before && v.after && v.before !== v.after;
  });
  const label = (v?: TrustValue) => ai.trustPoll.options.find(o => o.id === v)?.label ?? L.missing;
  add(main, trustPoll(s, 'after', dispatch),
    el('div', {class: 'card'}, el('h3', {}, L.changed),
      ...teamIds.map(t => el('p', {class: changed.includes(t) ? 'changed' : 'small'},
        `${s.teams[t].name}: ${label(s.aiCheck.trust[t]?.before)} → ${label(s.aiCheck.trust[t]?.after)}`))));
}

export function reflectScreen({s, main, title}: Ctx) {
  title(L.worksheet[3], scenario.story.labName);
  add(main, mentorFor(s), lines(scenario.reflection.questions));
}

/** S25 퇴근 보고: 하루 요약 + 우리 알고리즘 + 프로그램 미리보기 + 내보내기 */
export function wrapupScreen({s, main, title}: Ctx, actions: HTMLElement) {
  title(scenario.wrapup.message, scenario.story.labName);
  const steps = s.clusters.filter(c => c.cardIds.length);
  add(main, 
    el('div', {class: 'wrapup'},
      el('div', {class: 'card'}, el('h2', {}, L.casesDone),
        el('ol', {}, ...scenario.cases.map(c => el('li', {}, c.title,
          ' ', s.classPath.filter(p => p.caseId === c.id).map(p => symbolOf(p.result)).join(' ')))),
        el('h2', {}, L.request), el('p', {}, `${s.program.heritage.name} · ${s.program.heritage.risk}`)),
      el('div', {class: 'card'}, el('h2', {}, L.ourAlgorithm),
        el('ol', {}, ...steps.map(c => el('li', {}, c.name || L.unnamed)))),
      el('div', {class: 'card'}, el('h2', {}, L.programPreview), programGraph(s.program))),
    el('div', {class: 'experts'}, ...teamIds.map(t => el('div', {class: 'card small'}, el('strong', {}, s.teams[t].name),
      el('p', {}, `${L.evidencePoints} ${s.teams[t].evidencePoints}`),
      s.settings.showRanking ? el('p', {}, String(Object.values(s.teams[t].health).reduce((a, b) => a + b, 0))) : null))),
    actions,
  );
}

export {aiPrompt as promptFor};
