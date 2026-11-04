import {el, button, add} from '../ui/dom';
import {svg} from '../ui/art';
import {fitStage} from '../ui/stage';
import {GL} from '../games/labels';
import {gamesData, gameOf, medals, saveMedal, type Medal, type RustGame, type TransportGame} from '../games/data';
import * as T from '../games/transport';
import * as Rg from '../games/rust';
import {joystick} from '../mission/joystick';
import {rankBadge, starredCases} from '../mission/progress';
import {roleOf} from '../roles/engine';
import {roleIcon} from '../roles/webtoon';
import {RL} from '../roles/labels';
import {showGains, bagButton} from '../rpg/ui';
import {award, gainXp, giveItem, rpg} from '../rpg/hero';
import type {RoleId} from '../roles/engine';
import '../mission/style.css';
import '../roles/style.css';
import '../games/style.css';

/** 훈련장 미니게임(?mode=games, &game=transport|rust) */
export function mountGames(root: HTMLElement, params: URLSearchParams) {
  document.title = GL.docTitle;
  const stage = el('div', {id: 'stage', class: 'ms gm'});
  root.replaceChildren(stage);
  fitStage();
  window.addEventListener('resize', fitStage);
  const id = params.get('game');
  const game = id ? gameOf(id) : undefined;
  if (game?.id === 'transport') runTransport(stage, game as TransportGame);
  else if (game?.id === 'rust') runRust(stage, game as RustGame);
  else hub(stage);
}

function hud(stage: HTMLElement, title: string, back: {href: string; label: string}) {
  stage.append(el('div', {class: 'ms-hud'}, add(el('div', {class: 'ms-hud-row'}),
    el('a', {class: 'ms-pill ms-list', href: back.href}, `☰ ${back.label}`),
    el('div', {class: 'ms-pill ms-file'}, el('strong', {}, title)),
    el('div', {class: 'ms-hud-right'}, bagButton(stage), el('div', {class: 'ms-pill ms-rank'}, rankBadge(starredCases().length))))));
}

export function medalIcon(m: Medal | undefined) {
  const s = svg('svg', {viewBox: '0 0 64 64', class: 'medal ' + (m ?? 'none'), 'aria-hidden': 'true'});
  s.append(svg('path', {d: 'M20 4 L28 24 L36 24 L44 4', fill: '#3a6d93', stroke: '#1d2a2a', 'stroke-width': 3}),
    svg('circle', {cx: 32, cy: 40, r: 20, stroke: '#1d2a2a', 'stroke-width': 4}),
    svg('path', {d: 'M32 28 L35.5 36 L44 36.5 L37.5 42 L39.5 50 L32 45.5 L24.5 50 L26.5 42 L20 36.5 L28.5 36 Z', fill: '#fff8', stroke: 'none'}));
  return s;
}

function hub(stage: HTMLElement) {
  hud(stage, gamesData.title, {href: '?mode=mission', label: GL.toMissions});
  const got = medals();
  stage.append(el('section', {class: 'gm-hub'},
    el('h1', {}, gamesData.title),
    el('p', {class: 'ms-sub'}, gamesData.sub),
    el('div', {class: 'gm-cards'}, ...gamesData.games.map((g, i) => {
      const r = roleOf(g.role)!;
      return el('a', {class: 'gm-card', href: `?mode=games&game=${g.id}`, 'data-game': g.id, style: `--rc:${r.color}`},
        el('span', {class: 'ms-num'}, i + 1),
        el('span', {class: 'rl-badge'}, roleIcon(r.id, r.color), `${r.name} ${RL.role}`),
        el('strong', {}, g.name),
        el('p', {}, g.intro),
        el('span', {class: 'gm-medal'}, medalIcon(got[g.id]), gamesData.medals[got[g.id] ?? 'none']));
    }))));
  window.addEventListener('keydown', e => {
    const n = Number(e.key);
    if (Number.isInteger(n) && gamesData.games[n - 1]) location.search = `?mode=games&game=${gamesData.games[n - 1].id}`;
    if (e.key === 'Escape') location.search = '?mode=mission';
  });
}

/** 결과 카드: 메달(또는 다시 도전) + 버튼 */
function result(stage: HTMLElement, game: {id: string; name: string; role: string; win: string; tip: string}, medal: Medal | null, lose: string, retry: () => void) {
  const better = medal ? saveMedal(game.id, medal) : false;
  // RPG: 메달마다 그 역할 경험치, 금메달이면 그 게임의 보상 도구
  if (medal) setTimeout(() => showGains(stage, award(h => {
    const a = gainXp(h, game.role as RoleId, rpg.xp.medal[medal]);
    const b = medal === 'gold' && rpg.gifts.gold[game.id] ? giveItem(a.hero, rpg.gifts.gold[game.id]) : {hero: a.hero, gains: []};
    return {hero: b.hero, gains: [...a.gains, ...b.gains]};
  })), 700);
  const card = el('section', {class: 'ms-card gm-result pop', 'data-testid': 'game-result', 'data-medal': medal ?? 'none'},
    el('div', {class: 'gm-result-medal'}, medalIcon(medal ?? undefined)),
    el('h1', {}, medal ? `${gamesData.medals[medal]} · ${GL.medalGot}` : GL.tryAgain),
    better ? el('p', {class: 'gm-best'}, GL.newBest) : null,
    el('p', {class: 'ms-sub'}, medal ? game.win : lose),
    el('p', {class: 'gm-tip'}, game.tip),
    el('div', {class: 'ms-actions'},
      el('a', {class: 'ms-btn', href: '?mode=games'}, GL.toHub),
      button(GL.retry, retry, {class: 'ms-btn primary', 'data-testid': 'retry'})));
  stage.append(el('div', {class: 'ms-scrim gm-scrim'}), card);
}

function layout(stage: HTMLElement, game: {name: string; howto: string}, keys: string) {
  hud(stage, game.name, {href: '?mode=games', label: GL.toHub});
  const canvas = el('canvas', {class: 'gm-canvas', width: 1600, height: 760});
  const side = el('aside', {class: 'gm-side'});
  stage.append(el('p', {class: 'gm-howto'}, game.howto), canvas, side, el('div', {class: 'ms-keys'}, keys));
  return {canvas, side, g: canvas.getContext('2d')!};
}

function runTransport(stage: HTMLElement, game: TransportGame) {
  let pack: number | null = null;
  const choose = () => {
    stage.replaceChildren();
    hud(stage, game.name, {href: '?mode=games', label: GL.toHub});
    let picked = -1;
    const say = el('p', {class: 'gm-say'});
    const go = button(GL.depart, () => { if (picked >= 0) { pack = game.packs[picked].shake; play(); } }, {class: 'ms-btn primary', disabled: true, 'data-testid': 'depart'});
    const buttons = game.packs.map((p, i) => {
      const b = button('', () => {
        picked = i;
        buttons.forEach((x, j) => x.setAttribute('aria-pressed', String(i === j)));
        say.textContent = p.say;
        go.disabled = false;
      }, {class: 'ms-choice', 'data-pack': i, 'aria-pressed': false});
      b.append(el('span', {class: 'ms-letter'}, 'ABC'[i]), el('strong', {}, p.label));
      return b;
    });
    stage.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card gm-pack pop'},
      el('h1', {}, game.name), el('p', {class: 'ms-sub'}, game.intro),
      el('p', {class: 'ms-label'}, game.packQ), el('div', {class: 'rl-options'}, ...buttons), say,
      el('div', {class: 'ms-actions'}, go)));
    onKey = e => {
      const i = 'ABC'.indexOf(e.key.toUpperCase());
      if (i >= 0 && buttons[i]) buttons[i].click();
      if (['PageDown', 'Enter', ' '].includes(e.key) && picked >= 0) { e.preventDefault(); go.click(); }
    };
  };

  let onKey: (e: KeyboardEvent) => void = () => {};
  let frame = 0;
  const held = new Set<string>();
  let joy = {x: 0, y: 0};
  const play = () => {
    cancelAnimationFrame(frame);
    stage.replaceChildren();
    const {g, side} = layout(stage, game, GL.keysTransport);
    const meter = el('div', {class: 'gm-meter'}, el('span', {}));
    const speed = el('strong', {}, '0');
    const flash = el('p', {class: 'gm-flash'});
    const stick = joystick(GL.joystick, v => { joy = v; });
    side.append(el('p', {class: 'ms-label'}, GL.shake), meter, el('p', {class: 'gm-speed'}, `${GL.speed} `, speed), flash, stick.el);
    let s = T.newTransport();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = (a: string, b: string) => (held.has(a) || held.has(b) ? 1 : 0);
      const ix = k('arrowright', 'd') - k('arrowleft', 'a') + joy.x;
      const iy = k('arrowdown', 's') - k('arrowup', 'w') - joy.y;
      const len = Math.hypot(ix, iy);
      s = T.step(s, len > 1 ? {x: ix / len, y: iy / len} : {x: ix, y: iy}, dt, pack!);
      T.draw(g, s, game, now / 1000);
      (meter.firstChild as HTMLElement).style.width = `${s.shake}%`;
      meter.className = 'gm-meter' + (s.shake > 66 ? ' high' : s.shake > 33 ? ' mid' : '');
      speed.textContent = String(Math.round(Math.hypot(s.vx, s.vy) / 10));
      flash.textContent = s.wallFlash > 0 ? game.wall : s.bumpFlash > 0 ? game.bump : '';
      stage.dataset.shake = String(Math.round(s.shake));
      stage.dataset.pos = `${Math.round(s.x)},${Math.round(s.y)}`;
      if (s.done) {
        stick.release();
        result(stage, game, s.done === 'win' ? T.medalFor(s.shake) : null, game.lose, play);
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    onKey = e => { if (e.key.toLowerCase() === 'r') play(); };
  };

  const MOVE = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (MOVE.includes(k)) { e.preventDefault(); held.add(k); return; }
    if (e.key === 'Escape') { location.search = '?mode=games'; return; }
    onKey(e);
  });
  window.addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => held.clear());
  choose();
}

function runRust(stage: HTMLElement, game: RustGame) {
  const scene = Rg.paintScene();
  let frame = 0;
  const held = new Set<string>();
  let joy = {x: 0, y: 0};
  let onKey: (e: KeyboardEvent) => void = () => {};
  const play = () => {
    cancelAnimationFrame(frame);
    stage.replaceChildren();
    const {g, side, canvas} = layout(stage, game, GL.keysRust);
    const count = el('strong', {}, `0 / ${Rg.rustTotal}`);
    const misses = el('strong', {}, '0');
    const msg = el('p', {class: 'gm-flash'});
    const stick = joystick(GL.joystick, v => { joy = v; });
    side.append(el('p', {class: 'gm-count'}, `${GL.found} `, count), el('p', {class: 'gm-count'}, `${GL.mistakes} `, misses), msg, stick.el);
    let s = Rg.newRust();
    const lens = {x: Rg.W / 2, y: Rg.H / 2};
    const messages = {found: game.found, green: game.green, miss: game.miss};
    const doMark = () => {
      s = Rg.mark(s, lens.x, lens.y);
      count.textContent = `${s.found.length} / ${Rg.rustTotal}`;
      misses.textContent = String(s.mistakes);
      msg.textContent = s.lastMsg ? messages[s.lastMsg] : '';
      msg.className = 'gm-flash ' + (s.lastMsg ?? '');
      stage.dataset.found = String(s.found.length);
      if (Rg.isDone(s)) {
        cancelAnimationFrame(frame);
        Rg.draw(g, scene, s, lens);
        stick.release();
        result(stage, game, Rg.medalFor(s.mistakes), '', play);
      }
    };
    // 마우스: 무대가 줄어든 만큼 되돌려 그림 좌표로
    const toCanvas = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      lens.x = Math.max(0, Math.min(Rg.W, ((e.clientX - r.left) / r.width) * Rg.W));
      lens.y = Math.max(0, Math.min(Rg.H, ((e.clientY - r.top) / r.height) * Rg.H));
    };
    canvas.addEventListener('mousemove', toCanvas);
    canvas.addEventListener('click', e => { toCanvas(e); doMark(); });
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = (a: string, b: string) => (held.has(a) || held.has(b) ? 1 : 0);
      lens.x = Math.max(0, Math.min(Rg.W, lens.x + (k('arrowright', 'd') - k('arrowleft', 'a') + joy.x) * 600 * dt));
      lens.y = Math.max(0, Math.min(Rg.H, lens.y + (k('arrowdown', 's') - k('arrowup', 'w') - joy.y) * 600 * dt));
      Rg.draw(g, scene, s, lens);
      stage.dataset.lens = `${Math.round(lens.x)},${Math.round(lens.y)}`;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    onKey = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doMark(); } };
  };
  const MOVE = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (MOVE.includes(k)) { e.preventDefault(); held.add(k); return; }
    if (e.key === 'Escape') { location.search = '?mode=games'; return; }
    onKey(e);
  });
  window.addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => held.clear());
  // 설명 카드 → 시작
  hud(stage, game.name, {href: '?mode=games', label: GL.toHub});
  const start = button(GL.play + ' →', play, {class: 'ms-btn primary is-next', 'data-testid': 'start-game'});
  stage.append(el('div', {class: 'ms-scrim'}), el('section', {class: 'ms-card gm-pack pop'},
    el('h1', {}, game.name), el('p', {class: 'ms-sub'}, game.intro), el('p', {class: 'ms-label'}, GL.howto), el('p', {}, game.howto),
    el('div', {class: 'ms-actions'}, start)));
  onKey = e => { if (['PageDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); play(); } };
}
