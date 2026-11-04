import {scenario, manuals} from '../content/loadContent';
import mailsRaw from '../../data/mails.json' with {type: 'json'};
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
const READ_KEY = 'cons-lab:mail-read';
const mailsData = mailsRaw as {title: string; arrived: string; inbox: string; from: string; to: string; sign: string; mails: {expert: string; time: string; subject: string; hello: string; bye: string}[]};
const SCREENS = ['start', 'video', 'clips', 'experts'] as const;
type Screen = typeof SCREENS[number];
const SCREEN_ID: Record<Screen, string> = {start: 'S00', video: 'S01', clips: 'S02', experts: 'S03'};

export function mountTeacher(root: HTMLElement) {
  let screen: Screen = 'start';
  // ③ 스승님의 편지: 지금 펼친 편지, 읽은 편지(이 기기에 저장)
  let openMail = 0;
  const read = new Set<string>(loadRead());
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
  const go = (next: Screen) => {
    screen = next;
    if (next === 'experts') { openMail = 0; markRead(0); }
    render();
  };
  function loadRead(): string[] {
    try {
      const v = JSON.parse(safeGet(READ_KEY) ?? '[]');
      return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  function markRead(i: number) {
    read.add(mailsData.mails[i].expert);
    safeSet(READ_KEY, JSON.stringify([...read]));
  }
  const showMail = (i: number) => { openMail = i; markRead(i); render(); };
  const unreadLeft = () => mailsData.mails.some(m => !read.has(m.expert));
  const step = (dir: 1 | -1) => {
    // ③에서는 '다음'이 먼저 안 읽은 편지를 펼친다
    if (dir === 1 && screen === 'experts') {
      const unread = mailsData.mails.findIndex(m => !read.has(m.expert));
      if (unread >= 0) { showMail(unread); return; }
    }
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
        button(last && unreadLeft() ? L.nextMail + ' →' : last ? L.toRoles + ' →' : L.next, () => step(1), {class: 'primary', 'data-testid': last ? 'to-roles' : 'next'}))));
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

  /** ③ 스승님이 보낸 편지 4통: 왼쪽 받은편지함, 오른쪽 펼친 편지(전문가 소개 · 단서 표 · 꼭 기억해요). 내용은 매뉴얼에서 */
  function expertsScreen(main: HTMLElement, title: (text: string, eyebrow: string) => void) {
    title(mailsData.title, `3 · ${L.steps[2]}`);
    const mail = mailsData.mails[openMail];
    const m = manuals.manuals.find(x => x.id === mail.expert)!;
    const inbox = el('nav', {class: 'mail-inbox', 'aria-label': mailsData.inbox},
      el('p', {class: 'mail-inbox-title'}, `✉ ${mailsData.inbox}`),
      ...mailsData.mails.map((x, i) => {
        const doc = manuals.manuals.find(d => d.id === x.expert)!;
        const item = button('', () => showMail(i), {class: 'mail-item' + (i === openMail ? ' on' : '') + (read.has(x.expert) ? ' read' : ''), 'data-mail': x.expert, style: `--c: var(${doc.colorToken})`});
        add(item, el('span', {class: 'case-no'}, i + 1),
          el('span', {class: 'mail-item-text'}, el('span', {class: 'mail-from'}, mailsData.from, el('small', {}, x.time)), el('strong', {}, x.subject)),
          read.has(x.expert) ? null : el('span', {class: 'mail-new', 'aria-label': L.mailNew}, L.mailNewShort));
        return item;
      }));
    const letter = el('article', {class: 'mail-letter pop', 'data-testid': 'mail', 'data-expert': m.id, style: `--c: var(${m.colorToken})`},
      el('header', {class: 'mail-head'},
        el('h2', {}, el('span', {class: 'expert-symbol'}, m.symbol), mail.subject),
        el('p', {class: 'mail-meta'}, `${L.mailFrom} ${mailsData.from} · ${L.mailTo} ${mailsData.to} · ${mail.time}`)),
      el('p', {class: 'mail-hello'}, mail.hello),
      el('blockquote', {class: 'mail-quote'}, el('strong', {}, m.label), el('span', {}, m.whoAmI)),
      el('div', {class: 'mail-cols'},
        el('table', {class: 'expert-table'},
          el('thead', {}, el('tr', {}, el('th', {}, L.clueCol), el('th', {}, L.causeCol), el('th', {}, L.actionCol))),
          el('tbody', {}, ...m.clues.map(r => el('tr', {}, el('td', {}, r.clue), el('td', {}, r.cause), el('td', {}, r.action))))),
        el('div', {class: 'mail-ideas'}, el('h3', {}, L.ideas), el('ul', {}, ...m.keyIdeas.map(k => el('li', {}, k))))),
      el('p', {class: 'mail-bye'}, mail.bye),
      el('p', {class: 'mail-sign'}, mailsData.sign));
    main.append(el('div', {class: 'mail-app'}, inbox, letter));
    // 처음 들어오면 '새 편지 도착' 알림
    if (!arrivedShown) {
      arrivedShown = true;
      main.append(el('div', {class: 'mail-arrived', role: 'status'}, `✉ ${mailsData.arrived}`));
    }
  }
  let arrivedShown = false;

  // 클리커: 다음(PageDown·→·Space), 이전(PageUp·←). ②에서 1~4는 영상, ③에서 1~4는 전문가. 입력칸에서는 멈춘다.
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    if (['PageDown', 'ArrowRight', ' '].includes(e.key)) { e.preventDefault(); step(1); return; }
    if (['PageUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); step(-1); return; }
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1 || n > 4) return;
    if (screen === 'clips') openClip(scenario.clips.items[n - 1].url);
    if (screen === 'experts' && mailsData.mails[n - 1]) showMail(n - 1);
  });
  window.addEventListener('resize', fitStage);
  render();
}
