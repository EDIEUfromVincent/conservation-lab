import {scenario, manuals} from '../content/loadContent';
import {safeGet, safeSet} from '../core/persistence';
import {add, el, button, field} from '../ui/dom';
import {L} from '../ui/labels';
import {fitStage} from '../ui/stage';
import {illustration} from '../ui/art';

// 교사용 프로젝터 화면. 수업 순서:
// ① 아침 영상(씨댄스) → ② 보존과학 영상 4편(유튜브, 새 탭) → ③ 전문가 4분야 한눈에
// → ④ 역할 변신 갈래길(?mode=roles) → ⑤ 3D 미션 사건 파일 1~5(?mode=mission)
// 매뉴얼·학습지 인쇄는 ?mode=print.

const MORNING_KEY = 'cons-lab:morning';
const SCREENS = ['start', 'video', 'clips', 'experts'] as const;
type Screen = typeof SCREENS[number];
const SCREEN_ID: Record<Screen, string> = {start: 'S00', video: 'S01', clips: 'S02', experts: 'S03'};

export function mountTeacher(root: HTMLElement) {
  let screen: Screen = 'start';
  let openExpert: string | null = null;   // ③에서 크게 펼친 전문가
  const notes: string[] = load();

  function load(): string[] {
    try {
      const v = JSON.parse(safeGet(MORNING_KEY) ?? '[]');
      return Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x.slice(0, 2000) : '')) : [];
    } catch {
      return [];
    }
  }
  const toRoles = () => { location.search = '?mode=roles'; };
  const go = (next: Screen) => { screen = next; openExpert = null; render(); };
  const step = (dir: 1 | -1) => {
    const i = SCREENS.indexOf(screen) + dir;
    if (i >= SCREENS.length) toRoles();
    else if (i >= 0) go(SCREENS[i]);
  };
  const openClip = (url: string) => window.open(url, '_blank', 'noopener');

  function render() {
    const stage = el('div', {id: 'stage', 'data-screen': SCREEN_ID[screen]});
    const main = el('main', {class: 'stage-body', tabindex: -1});
    const title = (text: string, eyebrow: string) => main.append(el('p', {class: 'eyebrow'}, eyebrow), el('h1', {}, text));
    stage.append(el('header', {},
      el('div', {class: 'brand'}, el('span', {class: 'seal'}, '◈'), scenario.story.labName),
      el('ol', {class: 'step-bar'}, ...L.steps.map((name, i) =>
        el('li', {class: SCREENS.indexOf(screen) === i + 1 ? 'now' : ''}, el('span', {}, i + 1), name)))), main);
    ({start: startScreen, video: videoScreen, clips: clipsScreen, experts: expertsScreen})[screen](main, title);
    const last = screen === 'experts';
    stage.append(el('footer', {class: 'stage-footer'},
      el('div', {class: 'actions'}, el('a', {href: '?mode=print', target: '_blank', rel: 'noopener'}, L.printLink)),
      el('div', {class: 'actions'},
        screen !== 'start' ? button(L.prev, () => step(-1)) : null,
        button(last ? L.toRoles + ' →' : L.next, () => step(1), {class: 'primary', 'data-testid': last ? 'to-roles' : 'next'}))));
    if (openExpert) stage.append(expertDetail(openExpert));
    root.replaceChildren(stage);
    fitStage();
  }

  function mentor(text: string) {
    return el('div', {class: 'mentor', role: 'note'},
      el('span', {class: 'mentor-face', 'aria-hidden': 'true'}, '◐'),
      el('div', {}, el('strong', {}, L.mentor), el('p', {}, text)));
  }

  function startScreen(main: HTMLElement, title: (text: string, eyebrow: string) => void) {
    title(scenario.meta.title, scenario.meta.subtitle);
    main.append(el('div', {class: 'split'}, illustration('case5'), el('div', {class: 'lines'},
      el('p', {}, scenario.meta.audience),
      el('div', {class: 'actions'}, button(L.start, () => go('video'), {class: 'primary', 'data-testid': 'start'})),
      el('p', {class: 'small strong'}, L.todayOrder),
      el('div', {class: 'step-links'}, ...L.steps.map((name, i) => i < 3
        ? button('', () => go(SCREENS[i + 1]), {class: 'step-link', 'data-step': i + 1})
        : el('a', {href: i === 3 ? '?mode=roles' : '?mode=mission', class: 'step-link', 'data-step': i + 1}))),
      el('p', {class: 'small strong'}, L.missionCases),
      el('div', {class: 'case-links', 'data-testid': 'mission-cases'}, ...scenario.cases.map(c =>
        el('a', {href: `?mode=mission&case=${c.id}`, class: 'case-link', 'data-case': c.id},
          el('span', {class: 'case-no'}, c.order), el('span', {}, c.title)))))));
    // button()·a는 글만 받으므로 순서 카드 내용은 따로 붙인다
    main.querySelectorAll<HTMLElement>('.step-link').forEach((b, i) => b.append(el('span', {class: 'case-no'}, i + 1), el('span', {}, L.steps[i])));
  }

  /** ① 55초 영상 + 아침 메모(교사가 반의 답을 한 줄씩 적는다) */
  function videoScreen(main: HTMLElement, title: (text: string, eyebrow: string) => void) {
    const v = scenario.video;
    title(v.title, `1 · ${L.steps[0]}`);
    const player = el('div', {class: 'video-box'});
    const video = el('video', {src: v.localFile, controls: true, preload: 'metadata'});
    video.addEventListener('error', () => player.replaceChildren(el('p', {class: 'small'}, L.noLocalVideo)));
    player.append(video);
    const memo = el('div', {class: 'morning-notes'}, el('h2', {}, L.morningNotes),
      ...v.watchFor.map((q, i) => field(q, notes[i] ?? '', text => { notes[i] = text; safeSet(MORNING_KEY, JSON.stringify(notes)); })));
    add(main, mentor(scenario.story.mentor.video), el('div', {class: 'split video-split'}, player, memo), el('p', {class: 'small'}, v.source));
  }

  /** ② 보존과학 영상 4편: 누르면 유튜브가 새 탭에서 열린다(인터넷 필요) */
  function clipsScreen(main: HTMLElement, title: (text: string, eyebrow: string) => void) {
    const c = scenario.clips;
    title(c.title, `2 · ${L.steps[1]}`);
    add(main, mentor(scenario.story.mentor.clips), el('p', {}, c.prompt),
      el('div', {class: 'clip-grid'}, ...c.items.map((item, i) => {
        const card = button('', () => openClip(item.url), {class: 'clip-card', 'data-clip': i + 1, 'data-url': item.url});
        card.append(
          el('span', {class: 'clip-play', 'aria-hidden': 'true'}, '▶'),
          el('span', {class: 'clip-text'}, el('span', {class: 'case-no'}, i + 1), el('strong', {}, item.title), el('span', {class: 'small'}, `${item.channel} · ${L.openYoutube}`)));
        return card;
      })),
      el('p', {class: 'small'}, c.note));
  }

  /** ③ 전문가 4분야를 한 화면에. 카드를 누르거나 1~4를 누르면 그 매뉴얼을 크게 펼친다. */
  function expertsScreen(main: HTMLElement, title: (text: string, eyebrow: string) => void) {
    title(L.expertsTitle, `3 · ${L.steps[2]}`);
    add(main, mentor(scenario.story.mentor.experts),
      el('div', {class: 'expert-grid'}, ...manuals.manuals.map((m, i) => {
        const card = button('', () => { openExpert = m.id; render(); }, {class: 'expert-card ' + m.id, 'data-expert': m.id, style: `--c: var(${m.colorToken})`});
        card.append(
          el('span', {class: 'expert-head'}, el('span', {class: 'expert-symbol'}, m.symbol), el('strong', {}, m.label), el('span', {class: 'case-no'}, i + 1)),
          el('span', {class: 'expert-col'}, `${L.clueCol} → ${L.causeCol}`),
          ...m.clues.map(r => el('span', {class: 'expert-row'}, el('b', {}, r.clue), el('span', {}, `→ ${r.cause}`))));
        return card;
      })));
  }

  function expertDetail(id: string) {
    const m = manuals.manuals.find(x => x.id === id)!;
    return el('div', {class: 'expert-detail', role: 'dialog', 'aria-label': m.label, style: `--c: var(${m.colorToken})`},
      el('div', {class: 'expert-sheet'},
        el('div', {class: 'expert-head big'}, el('span', {class: 'expert-symbol'}, m.symbol), el('h2', {}, m.label),
          button(L.close, () => { openExpert = null; render(); }, {class: 'close'})),
        el('p', {}, m.whoAmI),
        el('table', {class: 'expert-table'},
          el('thead', {}, el('tr', {}, el('th', {}, L.clueCol), el('th', {}, L.causeCol), el('th', {}, L.actionCol))),
          el('tbody', {}, ...m.clues.map(r => el('tr', {}, el('td', {}, r.clue), el('td', {}, r.cause), el('td', {}, r.action))))),
        el('h3', {}, L.ideas),
        el('ul', {}, ...m.keyIdeas.map(k => el('li', {}, k)))));
  }

  // 클리커: 다음(PageDown·→·Space), 이전(PageUp·←). ②에서 1~4는 영상, ③에서 1~4는 전문가. 입력칸에서는 멈춘다.
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    if (e.key === 'Escape' && openExpert) { openExpert = null; render(); return; }
    if (['PageDown', 'ArrowRight', ' '].includes(e.key)) { e.preventDefault(); step(1); return; }
    if (['PageUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); step(-1); return; }
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1 || n > 4) return;
    if (screen === 'clips') openClip(scenario.clips.items[n - 1].url);
    if (screen === 'experts') { openExpert = manuals.manuals[n - 1].id; render(); }
  });
  window.addEventListener('resize', fitStage);
  render();
}
