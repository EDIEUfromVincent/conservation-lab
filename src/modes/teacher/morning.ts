import qrcode from 'qrcode-generator';
import {scenario} from '../../content/loadContent';
import {heritageOptions, teamIds, CHOICE_KEYS} from '../../core/actions';
import {storageError} from '../../core/persistence';
import {add, el, button, lines, field, checkbox} from '../../ui/dom';
import {illustration, svg} from '../../ui/art';
import {toast} from '../../ui/components/Modal';
import {L} from '../../ui/labels';
import {type Ctx, mentorFor, expertSymbols} from './shared';

export function manualUrl(base: string, id: string, profile: string) {
  try {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.searchParams.set('mode', 'manual');
    url.searchParams.set('expert', id);
    if (profile === '80') url.searchParams.set('n', '2');
    else url.searchParams.delete('n');
    return url.href;
  } catch {
    return '';
  }
}

export function introScreen({s, main, title}: Ctx) {
  title(scenario.intro.mission, scenario.story.labName);
  add(main, 
    el('div', {class: 'split'},
      illustration('intro'),
      el('div', {class: 'lines'}, mentorFor(s), lines([scenario.intro.question, scenario.intro.worksheetPrompt]))),
  );
}

/** S02: 55초 영상 두 번 보기(1회차 자막 없음, 2회차 질문 자막) + 아침 메모(docs/12 §4.1) */
export function videoScreen({s, main, title, dispatch}: Ctx) {
  const v = scenario.video;
  title(v.title, scenario.story.labName);
  const second = s.subScreen === 1;
  const file = second ? v.localFile : v.localFilePlain || v.localFile;
  const player = el('div', {class: 'video-box'});
  if (file) {
    const video = el('video', {src: file, controls: true, preload: 'metadata', 'data-viewing': second ? 2 : 1});
    // 자막 없는 판이 없으면 자막 판으로, 그것도 없으면 안내 + 주소 버튼
    video.addEventListener('error', () => {
      if (!second && v.localFilePlain && video.getAttribute('src') !== v.localFile) video.src = v.localFile;
      else player.replaceChildren(el('p', {class: 'small'}, L.noLocalVideo), urlButton());
    });
    player.append(video);
  } else player.append(urlButton());
  function urlButton() {
    if (!s.settings.videoUrl) return el('p', {class: 'small'}, L.noVideo);
    return button(L.openVideo, () => {
      try {
        const url = new URL(s.settings.videoUrl);
        if (['https:', 'http:'].includes(url.protocol)) window.open(url.href, '_blank', 'noopener');
      } catch {
        toast(L.noVideo);
      }
    });
  }
  const notes = el('div', {class: 'morning-notes'}, el('h2', {}, L.morningNotes),
    ...v.watchFor.map((q, i) => field(q, s.morningNotes[i] ?? '', text => dispatch({type: 'morningNote', key: String(i), value: text}, {render: false}))));
  add(main, 
    mentorFor(s),
    el('p', {class: 'viewing', 'data-testid': 'viewing'}, v.viewings[second ? 1 : 0]),
    el('div', {class: 'split video-split'}, player, notes),
    el('p', {class: 'small'}, v.source),
  );
}

/** S03: 저녁에 맡고 싶은 의뢰 고르기. 손든 학생 수만 센다(이름 없음). 사건 그림을 재사용하지 않는다. */
export function heritageScreen({s, main, title, dispatch}: Ctx) {
  const h = scenario.heritagePick;
  title(h.prompt, scenario.story.labName);
  let draft = '';
  add(main, 
    mentorFor(s),
    el('p', {}, h.sub, ' ', el('span', {class: 'small'}, h.tallyHint)),
    el('div', {class: 'cards heritage-cards'}, ...heritageOptions(s).map(x => el('div', {class: 'card heritage', 'data-heritage': x.name},
      el('div', {class: 'material-chip'}, x.material || '—'),
      el('h3', {}, x.name),
      el('p', {class: 'small'}, x.place),
      el('div', {class: 'tally'},
        button('−', () => dispatch({type: 'tally', key: x.name, value: -1}), {'aria-label': `${x.name} −1`}),
        el('strong', {}, `${s.heritageTally[x.name] ?? 0}${L.personUnit}`),
        button('+', () => dispatch({type: 'tally', key: x.name, value: 1}), {'aria-label': `${x.name} +1`})),
    ))),
    el('div', {class: 'actions'},
      field(L.heritageName, '', text => { draft = text; }),
      button(L.addHeritage, () => dispatch({type: 'addHeritage', value: draft}))),
  );
}

export function expertScreen({s, main, title, dispatch}: Ctx) {
  title(L.manual, scenario.story.labName);
  add(main, mentorFor(s), el('p', {}, scenario.expertStudy.tasks.map((x, i) => `${i + 1}. ${x}`).join(' → ')));
  const experts = el('div', {class: 'experts'});
  for (const expert of scenario.experts) {
    const url = manualUrl(s.settings.manualBaseUrl, expert.id, s.profile);
    const card = el('div', {class: 'card expert ' + expert.id}, el('h2', {}, expert.symbol + ' ' + expert.short));
    if (url) {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const n = qr.getModuleCount();
      const grid = svg('svg', {viewBox: `-4 -4 ${n + 8} ${n + 8}`, role: 'img', 'aria-label': url, 'data-qr': url});
      grid.append(svg('rect', {x: -4, y: -4, width: n + 8, height: n + 8, fill: 'white'}));
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) grid.append(svg('rect', {x, y, width: 1, height: 1, fill: '#111'}));
      card.append(grid);
    } else card.append(el('p', {class: 'small'}, L.noQR));
    card.append(
      el('a', {href: `?mode=manual&expert=${expert.id}${s.profile === '80' ? '&n=2' : ''}`, target: '_blank', rel: 'noopener'}, L.manual),
      checkbox(L.ready, !!s.expertPassed[expert.id], () => dispatch({type: 'expertPassed', key: expert.id})));
    experts.append(card);
  }
  add(main, experts);
}

/** S05: 본 팀 구성 + 팀 의뢰 후보 + 점수 없는 조작 연습 한 번 */
export function teamScreen({s, main, title, dispatch}: Ctx) {
  title(L.teamTitle, scenario.story.labName);
  const options = heritageOptions(s);
  add(main, 
    mentorFor(s),
    el('ul', {class: 'role-rules'}, ...scenario.teamSetup.roleRules.map(r => el('li', {}, r))),
    el('p', {class: 'small'}, L.practiceVote),
    el('div', {class: 'experts team-cards'}, ...teamIds.map(t => el('div', {class: 'card' + (t === s.selectedTeam ? ' active' : ''), 'data-team': t},
      el('h2', {}, s.teams[t].name),
      el('div', {class: 'expert-checks'}, ...scenario.experts.map(e => checkbox(e.symbol + ' ' + e.short, !!s.teamSetupChecked[t + e.id], () => dispatch({type: 'teamChecked', key: t + e.id})))),
      el('label', {class: 'field'}, el('span', {}, L.teamHeritage),
        el('select', {'aria-label': `${t}${L.team} ${L.teamHeritage}`, onchange: (e: Event) => dispatch({type: 'teamHeritage', team: t, value: (e.target as HTMLSelectElement).value})},
          el('option', {value: ''}, '—'),
          ...options.map(o => el('option', {value: o.name, selected: s.teams[t].heritage === o.name}, o.name)))),
      el('div', {class: 'actions'}, ...CHOICE_KEYS.map(k => button(k, () => dispatch({type: 'vote', team: t, choice: k}), {'aria-pressed': s.practice[t] === k}))),
    ))),
  );
}

export function breakScreen({s, main, title}: Ctx) {
  title(L.break, scenario.story.labName);
  add(main, mentorFor(s), el('p', {}, storageError ? L.saveFailed : L.saved));
}

export {expertSymbols};
