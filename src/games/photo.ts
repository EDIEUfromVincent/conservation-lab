import type {PhotoGame, Power, StageNo} from './data';
import type {GameMount} from './env';
import {hearts, seeded, shuffle} from './env';
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
/** 모두 놓은 뒤 확인: 제자리인 자리와 아닌 자리. at은 자리 → 놓인 조각 */
export function check(at: Map<number, number>) {
  const right: number[] = [], wrong: number[] = [];
  for (const [slot, piece] of at) (fits(piece, slot) ? right : wrong).push(slot);
  return {right, wrong};
}
/** 몇 번째 확인에서 다 맞혔는지로 메달: 첫 번째 금, 두 번째 은, 그 뒤 동 */
export const medalFor = (round: number) => (round <= 1 ? 'gold' : round === 2 ? 'silver' : 'bronze') as 'gold' | 'silver' | 'bronze';

export const mountPhoto: GameMount = env => {
  const game = env.game as unknown as PhotoGame;
  const cfg = STAGES[env.stage];
  const tools = toolsOf(env.power);
  const list = pieces(env.stage);
  const order = shuffle(list.map(p => p.id), seeded(200 + env.stage));
  const at = new Map<number, number>();      // 자리 → 놓인 조각
  const locked = new Set<number>();          // 확인해서 맞은 자리(더 못 움직인다)
  let marks = new Map<number, 'right' | 'wrong'>();
  let picked: number | null = null;
  let round = 0;
  let phase: 'memo' | 'place' | 'check' = 'memo';
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
  env.side.append(el('p', {class: 'gm-count'}, `${GL.placed} `, prog), el('p', {class: 'gm-count'}, `${GL.left} `, left), msg);
  if (peek) env.side.append(peek);

  const render = () => {
    const showAll = phase === 'memo' || peeking;
    board.replaceChildren(...list.map(p => {
      const piece = at.get(p.id);
      const mark = marks.get(p.id);
      const slot = el('button', {type: 'button', class: 'ph-slot' + (piece !== undefined ? ' filled' : '') + (locked.has(p.id) ? ' done' : '') + (mark ? ` ${mark}` : ''),
        'data-slot': p.id, 'aria-label': `${p.id + 1}`, onclick: () => tapSlot(p.id)});
      if (peeking) { slot.append(art(p.id, false)); slot.classList.add('ghost'); }
      else if (showAll) slot.append(art(p.id, tools.tags && phase === 'memo'));
      else if (piece !== undefined) slot.append(art(piece, false));
      if (mark) slot.append(el('span', {class: 'ph-mark'}, mark === 'right' ? '✓' : '✕'));
      return slot;
    }));
    const inTray = order.filter(id => ![...at.values()].includes(id));
    tray.replaceChildren(...(phase === 'memo' ? [] : inTray.map(id => {
      const b = el('button', {type: 'button', class: 'ph-piece', 'data-piece': id, 'aria-pressed': picked === id, onclick: () => { if (phase === 'place') { picked = id; render(); } }});
      b.append(art(id, false));
      return b;
    })));
    prog.textContent = `${at.size} / ${cfg.n}`;
    env.stageEl.dataset.phase = phase;
  };

  /** 자리 누르기: 고른 조각을 놓거나(놓인 조각이 있으면 바꿔 넣기), 아무것도 안 골랐으면 놓인 조각을 빼낸다 */
  const tapSlot = (slot: number) => {
    if (phase !== 'place' || locked.has(slot)) return;
    if (picked !== null) { at.set(slot, picked); picked = null; }
    else if (at.has(slot)) at.delete(slot);
    else return;
    msg.textContent = '';
    render();
    if (at.size === cfg.n) judge();
  };

  /** 모두 놓으면 한꺼번에 확인한다 */
  const judge = () => {
    round += 1;
    phase = 'check';
    const {right, wrong} = check(at);
    marks = new Map([...right.map(s => [s, 'right'] as const), ...wrong.map(s => [s, 'wrong'] as const)]);
    right.forEach(s => locked.add(s));
    if (!wrong.length) { render(); env.end(medalFor(round)); return; }
    left.textContent = hearts(cfg.lives - round, cfg.lives);
    msg.className = 'gm-flash';
    msg.textContent = `${GL.rightCount} ${right.length} / ${cfg.n} · ${game.wrong}`;
    banner.textContent = game.check;
    env.stageEl.dataset.wrong = String(wrong.length);
    render();
    if (round >= cfg.lives) { timers.push(window.setTimeout(() => env.end(null), 1400)); return; }
    timers.push(window.setTimeout(() => {
      wrong.forEach(s => at.delete(s));
      marks = new Map([...marks].filter(([, m]) => m === 'right'));
      phase = 'place';
      banner.textContent = game.place;
      render();
    }, 1600));
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
