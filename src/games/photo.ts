import type {PhotoGame, Power, StageNo} from './data';
import type {GameMount} from './env';
import {hearts, medalByMistakes, seeded, shuffle} from './env';
import {el, button} from '../ui/dom';
import {svg} from '../ui/art';
import {GL} from './labels';

// 번호 붙여 사진 찍기: 깨진 꽃병 조각이 놓인 모습을 잠깐 보여 주고, 섞인 조각을 제자리에 놓는다.
// 번호표(도구)를 장착하면 기억하는 동안 조각과 자리에 같은 번호가 붙고 기억 시간이 3초 늘어난다(놓기 시작하면 번호는 사라진다).
// 사진기를 장착하면 처음 모습을 언제든 다시 볼 수 있다.
// 3단계는 똑같은 색의 비슷한 조각 10개를 1초만 보여 줘서, 도구 없이는 거의 깰 수 없다.

export interface PhotoCfg {n: number; memo: number; lives: number; similar: boolean; cols: number}
export const STAGES: Record<StageNo, PhotoCfg> = {
  1: {n: 4, memo: 5, lives: 4, similar: false, cols: 4},
  2: {n: 7, memo: 3, lives: 3, similar: false, cols: 4},
  3: {n: 10, memo: 1, lives: 3, similar: true, cols: 5},
};
export const PEEK_MS = 2000;
export const TAG_TIME = 3;
export const toolsOf = (p: Power) => ({tags: p.has('tags'), camera: p.has('camera')});

const COLORS = ['#c0622d', '#3a6d93', '#2f7d6d', '#f2b632', '#7a5a92', '#b3372f', '#5fae96', '#9a6b45', '#e07fa0', '#4f6d2f'];
/** 조각 모양: 씨앗 난수로 만든 울퉁불퉁한 다각형. 비슷한 조각은 같은 색에 모양만 조금 다르다 */
export function pieces(stage: StageNo) {
  const c = STAGES[stage];
  const rnd = seeded(100 + stage);
  return Array.from({length: c.n}, (_, i) => {
    const k = 6 + Math.floor(rnd() * 3);
    const pts = Array.from({length: k}, (_, j) => {
      const a = (j / k) * Math.PI * 2 + rnd() * 0.4;
      const r = c.similar ? 36 + rnd() * 9 : 26 + rnd() * 20;
      return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
    }).join(' ');
    return {id: i, pts, color: c.similar ? '#3a7fa3' : COLORS[i % COLORS.length], stripe: c.similar ? 44 + rnd() * 12 : 30 + rnd() * 40};
  });
}

/** 조각 i를 자리 j에 놓기: 맞으면 true. 순수 함수 */
export const fits = (piece: number, slot: number) => piece === slot;

export const mountPhoto: GameMount = env => {
  const game = env.game as unknown as PhotoGame;
  const cfg = STAGES[env.stage];
  const tools = toolsOf(env.power);
  const list = pieces(env.stage);
  const order = shuffle(list.map(p => p.id), seeded(200 + env.stage));
  const placed = new Set<number>();
  let picked: number | null = null;
  let mistakes = 0;
  let phase: 'memo' | 'place' = 'memo';
  let peeking = false;
  const timers: number[] = [];

  const art = (id: number, label: boolean) => {
    const p = list[id];
    const s = svg('svg', {viewBox: '0 0 100 100', class: 'ph-art', 'aria-hidden': 'true'});
    s.append(svg('polygon', {points: p.pts, fill: p.color, stroke: '#1d2a2a', 'stroke-width': 4, 'stroke-linejoin': 'round'}),
      svg('path', {d: `M8 ${p.stripe} Q50 ${p.stripe - 8} 92 ${p.stripe}`, stroke: '#fffdf7', 'stroke-width': 5, fill: 'none', opacity: 0.8}));
    const wrap = el('span', {class: 'ph-piece-art'}, s);
    if (label) wrap.append(el('span', {class: 'ph-tag'}, `${id + 1}`));
    return wrap;
  };

  const banner = el('p', {class: 'ph-banner'});
  const board = el('div', {class: 'ph-board', style: `--cols:${cfg.cols}`});
  const tray = el('div', {class: 'ph-tray'});
  env.area.append(banner, board, tray);
  const left = el('strong', {}, hearts(cfg.lives, cfg.lives));
  const prog = el('strong', {}, `0 / ${cfg.n}`);
  const msg = el('p', {class: 'gm-flash'});
  const peek = tools.camera ? button(`📷 ${game.peek}`, () => doPeek(), {class: 'ms-btn', 'data-testid': 'peek'}) : null;
  env.side.append(el('p', {class: 'gm-count'}, `${GL.progress} `, prog), el('p', {class: 'gm-count'}, `${GL.left} `, left), msg);
  if (peek) env.side.append(peek);

  const render = () => {
    const showAll = phase === 'memo' || peeking;
    board.replaceChildren(...list.map(p => {
      const has = placed.has(p.id);
      const slot = el('button', {type: 'button', class: 'ph-slot' + (has ? ' done' : ''), 'data-slot': p.id, 'aria-label': `${p.id + 1}`,
        onclick: () => drop(p.id)});
      if (has || showAll) slot.append(art(p.id, tools.tags && phase === 'memo'));
      if (peeking && !has) slot.classList.add('ghost');
      return slot;
    }));
    tray.replaceChildren(...(phase === 'memo' ? [] : order.filter(id => !placed.has(id)).map(id => {
      const b = el('button', {type: 'button', class: 'ph-piece', 'data-piece': id, 'aria-pressed': picked === id, onclick: () => { picked = id; render(); }});
      b.append(art(id, false));
      return b;
    })));
    env.stageEl.dataset.phase = phase;
  };

  const drop = (slot: number) => {
    if (phase !== 'place' || picked === null || placed.has(slot)) return;
    if (fits(picked, slot)) {
      placed.add(slot);
      picked = null;
      msg.className = 'gm-flash found';
      msg.textContent = game.right;
    } else {
      mistakes += 1;
      msg.className = 'gm-flash';
      msg.textContent = game.wrong;
      left.textContent = hearts(cfg.lives - mistakes, cfg.lives);
    }
    prog.textContent = `${placed.size} / ${cfg.n}`;
    render();
    if (placed.size === cfg.n) env.end(medalByMistakes(mistakes, 0, 1));
    else if (mistakes >= cfg.lives) env.end(null);
  };

  const doPeek = () => {
    if (phase !== 'place' || peeking) return;
    peeking = true;
    render();
    timers.push(window.setTimeout(() => { peeking = false; render(); }, PEEK_MS));
  };

  // 기억하기 → 섞기
  let t = cfg.memo + (tools.tags ? TAG_TIME : 0);
  banner.textContent = `${game.memorize} ${t}`;
  render();
  const tick = () => {
    t -= 1;
    if (t > 0) { banner.textContent = `${game.memorize} ${t}`; timers.push(window.setTimeout(tick, 1000)); return; }
    phase = 'place';
    banner.textContent = game.place;
    render();
  };
  timers.push(window.setTimeout(tick, 1000));
  env.onKey(e => { if (e.key.toLowerCase() === 'p' && peek) doPeek(); });
  return () => timers.forEach(clearTimeout);
};
