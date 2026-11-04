import {el, button, add} from '../ui/dom';
import {svg} from '../ui/art';
import {fitStage} from '../ui/stage';
import {GL} from '../games/labels';
import {gamesData, gameOf, medals, saveMedal, clearMedals, stageOpen, powerOf, needMet, needHint, type AnyGame, type Medal, type StageNo, type TransportGame, type Power} from '../games/data';
import type {GameEnv, GameMount} from '../games/env';
import {mountTransport} from '../games/transport';
import {mountRust} from '../games/rust';
import {mountPhoto} from '../games/photo';
import {mountClimate} from '../games/climate';
import {mountPeel} from '../games/peel';
import {mountTetris} from '../games/tetris';
import {mountCatch} from '../games/catch';
import {rankBadge, starredCases} from '../mission/progress';
import {roleOf} from '../roles/engine';
import {roleIcon} from '../roles/webtoon';
import {RL} from '../roles/labels';
import {showGains, bagButton, itemIcon} from '../rpg/ui';
import {award, gainXp, giveItem, itemOf, loadHero, rpg} from '../rpg/hero';
import {resetButton} from '../rpg/reset';
import '../mission/style.css';
import '../roles/style.css';
import '../games/style.css';

const MOUNTS: Record<string, GameMount> = {
  transport: mountTransport, rust: mountRust, photo: mountPhoto, climate: mountClimate, peel: mountPeel, tetris: mountTetris, catch: mountCatch,
};
const KEYS: Record<string, string> = {
  transport: GL.keysTransport, rust: GL.keysRust, photo: GL.keysPick, climate: GL.keysClimate, peel: GL.keysPeel, tetris: GL.keysTetris, catch: GL.keysCatch,
};
const STAGES: StageNo[] = [1, 2, 3];
const MOVE = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '];

/** 훈련장 미니게임(?mode=games, &game=…, &stage=1|2|3) */
export function mountGames(root: HTMLElement, params: URLSearchParams) {
  document.title = GL.docTitle;
  const stage = el('div', {id: 'stage', class: 'ms gm'});
  root.replaceChildren(stage);
  fitStage();
  window.addEventListener('resize', fitStage);
  const id = params.get('game');
  const game = id ? gameOf(id) : undefined;
  const n = Number(params.get('stage') ?? 1);
  const no = (STAGES.includes(n as StageNo) ? n : 1) as StageNo;
  if (game && MOUNTS[game.id] && stageOpen(medals(), game.id, no)) runGame(stage, game, no);
  else hub(stage);
}

const gameUrl = (id: string, no: StageNo) => `?mode=games&game=${id}&stage=${no}`;

function hud(stage: HTMLElement, title: string, back: {href: string; label: string}, gameId?: string) {
  stage.append(el('div', {class: 'ms-hud'}, add(el('div', {class: 'ms-hud-row'}),
    el('a', {class: 'ms-pill ms-list', href: back.href}, `☰ ${back.label}`),
    el('div', {class: 'ms-pill ms-file'}, el('strong', {}, title)),
    el('div', {class: 'ms-hud-right'}, resetButton(stage, gameId ? 'game' : 'games', () => clearMedals(gameId)), bagButton(stage), el('div', {class: 'ms-pill ms-rank'}, rankBadge(starredCases().length))))));
}

export function medalIcon(m: Medal | undefined) {
  const s = svg('svg', {viewBox: '0 0 64 64', class: 'medal ' + (m ?? 'none'), 'aria-hidden': 'true'});
  s.append(svg('path', {d: 'M20 4 L28 24 L36 24 L44 4', fill: '#3a6d93', stroke: '#1d2a2a', 'stroke-width': 3}),
    svg('circle', {cx: 32, cy: 40, r: 20, stroke: '#1d2a2a', 'stroke-width': 4}),
    svg('path', {d: 'M32 28 L35.5 36 L44 36.5 L37.5 42 L39.5 50 L32 45.5 L24.5 50 L26.5 42 L20 36.5 L28.5 36 Z', fill: '#fff8', stroke: 'none'}));
  return s;
}

/** 가장 높은 열린 단계 */
const topOpen = (id: string) => [...STAGES].reverse().find(s => stageOpen(medals(), id, s)) ?? 1;

function hub(stage: HTMLElement) {
  hud(stage, gamesData.title, {href: '?mode=mission', label: GL.toMissions});
  const book = medals();
  stage.append(el('section', {class: 'gm-hub'},
    el('h1', {}, gamesData.title),
    el('p', {class: 'ms-sub'}, gamesData.sub),
    el('div', {class: 'gm-cards'}, ...gamesData.games.map((g, i) => {
      const r = roleOf(g.role)!;
      return el('div', {class: 'gm-card', 'data-game': g.id, style: `--rc:${r.color}`},
        el('span', {class: 'ms-num'}, i + 1),
        el('span', {class: 'rl-badge'}, roleIcon(r.id, r.color), `${r.name} ${RL.role}`),
        el('a', {class: 'gm-card-name', href: gameUrl(g.id, topOpen(g.id))}, g.name),
        el('p', {}, g.intro),
        el('div', {class: 'gm-stages'}, ...STAGES.map(s => {
          const m = book[g.id]?.[s];
          const hard = !!g.stages[s - 1]?.need;
          return stageOpen(book, g.id, s)
            ? el('a', {class: 'gm-stage' + (hard ? ' hard' : ''), href: gameUrl(g.id, s), 'data-stage': s, 'data-medal': m ?? 'none', title: g.stages[s - 1].name},
              medalIcon(m), el('span', {}, `${s}`))
            : el('span', {class: 'gm-stage locked', 'data-stage': s, title: GL.locked}, el('span', {class: 'gm-lock', 'aria-hidden': 'true'}, '🔒'), el('span', {}, `${s}`));
        })));
    }))));
  window.addEventListener('keydown', e => {
    const n = Number(e.key);
    const g = gamesData.games[n - 1];
    if (Number.isInteger(n) && g) location.search = gameUrl(g.id, topOpen(g.id));
    if (e.key === 'Escape') location.search = '?mode=mission';
  });
}

/** 이 게임에서 힘을 내는 도구(3단계에 필요한 도구들)와 능력치 */
function powerLine(game: AnyGame, power: Power) {
  const need = game.stages[2]?.need;
  if (!need) return null;
  if (need.items) {
    const on = need.items.filter(power.has);
    if (!on.length) return null;
    return el('p', {class: 'gm-power', 'data-testid': 'power-on'}, ...on.map(id => itemIcon(id)), `${GL.powerOn}: ${on.map(id => itemOf(id)!.name).join(', ')}`);
  }
  const s = need.stat!;
  return el('p', {class: 'gm-power', 'data-testid': 'power-on'}, `${rpg.stats[s.role].name} ${GL.level} ${power.lv(s.role)}`);
}

/** 필요한 것이 없을 때: 경고 + 무엇을 어디서 얻는지 */
function needBox(game: AnyGame, no: StageNo, power: Power) {
  const need = game.stages[no - 1]?.need;
  if (!need || needMet(need, power)) return null;
  const h = needHint(need);
  return el('div', {class: 'gm-need', 'data-testid': 'need-warning'},
    el('strong', {}, GL.hard),
    el('p', {class: 'gm-need-what'}, ...(need.items ?? []).map(id => itemIcon(id)), h.what),
    el('p', {}, el('b', {}, GL.getFrom), ' ', h.where),
    need.items ? el('p', {class: 'gm-need-tip'}, GL.equipTip) : null);
}

function runGame(stage: HTMLElement, game: AnyGame, no: StageNo) {
  const info = game.stages[no - 1];
  const title = `${game.name} · ${info.name}`;
  const held = new Set<string>();
  let onDown: (e: KeyboardEvent) => void = () => {};
  let onUp: (e: KeyboardEvent) => void = () => {};
  let dispose: () => void = () => {};
  let playing = false;
  let pack = 1;

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (MOVE.includes(k) && playing) { e.preventDefault(); held.add(k); }
    if (e.key === 'Escape') { location.search = '?mode=games'; return; }
    if (k === 'r' && playing) { play(); return; }
    onDown(e);
  });
  window.addEventListener('keyup', e => { held.delete(e.key.toLowerCase()); onUp(e); });
  window.addEventListener('blur', () => held.clear());

  const power = () => powerOf(loadHero());

  // ── 시작 카드: 단계 설명, 필요한 도구 경고, (운반) 포장 고르기 ──
  const intro = () => {
    stage.replaceChildren();
    hud(stage, title, {href: '?mode=games', label: GL.toHub}, game.id);
    const p = power();
    const start = button(`${GL.play} →`, () => play(), {class: 'ms-btn primary is-next', 'data-testid': 'start-game'});
    let picked = -1;
    const card = el('section', {class: 'ms-card gm-pack pop', 'data-testid': 'game-intro', 'data-stage': no},
      el('p', {class: 'ms-label'}, `${info.name} · ${info.sub}`),
      el('h1', {}, game.name),
      el('p', {class: 'ms-sub'}, game.intro),
      needBox(game, no, p),
      powerLine(game, p));
    if (game.id === 'transport') {
      const t = game as unknown as TransportGame;
      const say = el('p', {class: 'gm-say'});
      start.disabled = true;
      start.classList.remove('is-next');
      const buttons = t.packs.map((pk, i) => {
        const b = button('', () => {
          picked = i;
          pack = pk.shake;
          buttons.forEach((x, j) => x.setAttribute('aria-pressed', String(i === j)));
          say.textContent = pk.say;
          start.disabled = false;
          start.classList.add('is-next');
        }, {class: 'ms-choice', 'data-pack': i, 'aria-pressed': false});
        b.append(el('span', {class: 'ms-letter'}, 'ABC'[i]), el('strong', {}, pk.label));
        return b;
      });
      card.append(el('p', {class: 'ms-label'}, t.packQ), el('div', {class: 'rl-options gm-packs'}, ...buttons), say);
      onDown = e => {
        const i = 'ABC'.indexOf(e.key.toUpperCase());
        if (i >= 0 && buttons[i]) buttons[i].click();
        if (['PageDown', 'Enter', ' '].includes(e.key) && picked >= 0) { e.preventDefault(); play(); }
      };
    } else {
      card.append(el('p', {class: 'ms-label'}, GL.howto), el('p', {}, game.howto));
      onDown = e => { if (['PageDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); play(); } };
    }
    card.append(el('div', {class: 'ms-actions'}, start));
    stage.append(el('div', {class: 'ms-scrim'}), card);
  };

  // ── 한 판 ──
  const play = () => {
    dispose();
    held.clear();
    onDown = () => {};
    onUp = () => {};
    stage.replaceChildren();
    for (const k of Object.keys(stage.dataset)) delete stage.dataset[k];
    hud(stage, title, {href: '?mode=games', label: GL.toHub}, game.id);
    const area = el('div', {class: `gm-area gm-${game.id}`, 'data-testid': 'game-area'});
    const p = power();
    const side = el('aside', {class: 'gm-side'}, el('p', {class: 'gm-stage-name'}, info.name), powerLine(game, p));
    stage.append(el('p', {class: 'gm-howto'}, game.howto), area, side, el('div', {class: 'ms-keys'}, KEYS[game.id]));
    playing = true;
    let over = false;
    const env: GameEnv = {
      game, stage: no, power: p, stageEl: stage, area, side, held, pack,
      onKey: (down, up) => { onDown = down; onUp = up ?? (() => {}); },
      end: (medal, why) => {
        if (over) return;
        over = true;
        playing = false;
        held.clear();
        dispose();
        dispose = () => {};
        result(medal, why);
      },
    };
    dispose = MOUNTS[game.id](env);
  };

  // ── 결과 카드 ──
  const result = (medal: Medal | null, why?: string) => {
    const better = medal ? saveMedal(game.id, no, medal) : false;
    if (medal) setTimeout(() => showGains(stage, award(h => {
      const a = gainXp(h, game.role, rpg.xp.medal[medal]);
      const gift = rpg.gifts.gold[game.id];
      const b = medal === 'gold' && gift ? giveItem(a.hero, gift) : {hero: a.hero, gains: []};
      return {hero: b.hero, gains: [...a.gains, ...b.gains]};
    })), 700);
    const next = medal && no < 3 ? (no + 1) as StageNo : null;
    const retry = button(GL.retry, () => play(), {class: 'ms-btn' + (next ? '' : ' primary'), 'data-testid': 'retry'});
    const toNext = next ? el('a', {class: 'ms-btn primary', href: gameUrl(game.id, next), 'data-testid': 'next-stage'}, `${GL.nextStage} →`) : null;
    const card = el('section', {class: 'ms-card gm-result pop', 'data-testid': 'game-result', 'data-medal': medal ?? 'none'},
      el('div', {class: 'gm-result-medal'}, medalIcon(medal ?? undefined)),
      el('h1', {}, medal ? `${gamesData.medals[medal]} · ${GL.medalGot}` : GL.tryAgain),
      better ? el('p', {class: 'gm-best'}, GL.newBest) : null,
      el('p', {class: 'ms-sub'}, medal ? game.win : (why ?? game.lose ?? '')),
      medal ? null : needBox(game, no, power()),
      el('p', {class: 'gm-tip'}, game.tip),
      el('div', {class: 'ms-actions'}, el('a', {class: 'ms-btn', href: '?mode=games'}, GL.toHub), retry, toNext));
    stage.append(el('div', {class: 'ms-scrim gm-scrim'}), card);
    onDown = e => {
      if (['PageDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); if (toNext) location.search = gameUrl(game.id, next!); else play(); }
      if (e.key.toLowerCase() === 'r') play();
    };
  };

  intro();
}
