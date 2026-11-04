import type {Medal, Power, StageNo, TetrisGame} from './data';
import type {GameMount} from './env';
import {seeded, shuffle} from './env';
import {el} from '../ui/dom';
import {GL} from './labels';

// 유물 조각 테트리스: 일반 테트리스. 일곱 가지 조각(색·결이 다른 유물 조각)을 돌리고 옮겨 한 줄을 채우면 그 줄이 지워진다.
// 정해진 줄 수를 시간 안에 맞추면 이긴다. 꼭대기까지 쌓이거나 시간이 다 되면 다시 한다.
// 떨어지는 빠르기는 되돌리기 솜씨 레벨에 따라 느려진다: 간격 × (1 + 0.6 × (레벨 − 1)).
// 3단계는 아주 빠르고 아래에 깨진 줄 6개가 미리 쌓여 있어, 레벨 3이 안 되면 거의 깰 수 없다.

export const COLS = 10, ROWS = 18;
export type Grid = number[][];                       // 0 빈칸, 1~7 조각 종류, 8 미리 쌓인 깨진 줄
type Cell = [number, number];                        // [x, y]
const BASE: Cell[][] = [
  [[0, 1], [1, 1], [2, 1], [3, 1]],                  // I
  [[0, 0], [1, 0], [0, 1], [1, 1]],                  // O
  [[1, 0], [0, 1], [1, 1], [2, 1]],                  // T
  [[1, 0], [2, 0], [0, 1], [1, 1]],                  // S
  [[0, 0], [1, 0], [1, 1], [2, 1]],                  // Z
  [[0, 0], [0, 1], [1, 1], [2, 1]],                  // J
  [[2, 0], [0, 1], [1, 1], [2, 1]],                  // L
];
/** 조각 k의 r번 돌린 모양(오른쪽으로 90도씩) */
export function shape(k: number, r: number): Cell[] {
  let c = BASE[k - 1];
  const size = k === 1 ? 4 : k === 2 ? 2 : 3;
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) c = c.map(([x, y]) => [size - 1 - y, x] as Cell);
  return c;
}

export interface TetrisCfg {goal: number; time: number; ms: number; junk: number}
export const STAGES: Record<StageNo, TetrisCfg> = {
  1: {goal: 5, time: 150, ms: 480, junk: 0},
  2: {goal: 10, time: 180, ms: 240, junk: 3},
  3: {goal: 14, time: 180, ms: 75, junk: 6},
};
/** 한 칸 떨어지는 간격(ms): 되돌리기 솜씨가 높을수록 느긋하다 */
export const intervalFor = (stage: StageNo, p: Power) => STAGES[stage].ms * (1 + 0.6 * (p.lv('undo') - 1));

export interface TetrisState {grid: Grid; k: number; r: number; x: number; y: number; next: number; lines: number; done: 'win' | 'lose' | null; bag: number[]; seed: number; cleared: number}
const emptyRow = () => Array<number>(COLS).fill(0);

function bagFrom(seed: number) { return shuffle([1, 2, 3, 4, 5, 6, 7], seeded(seed)); }
function pull(s: TetrisState): number {
  if (!s.bag.length) { s.seed += 1; s.bag = bagFrom(s.seed); }
  return s.bag.shift()!;
}

export function newTetris(stage: StageNo, seed = 600 + stage): TetrisState {
  const r = seeded(seed + 99);
  const grid: Grid = Array.from({length: ROWS}, emptyRow);
  for (let i = 0; i < STAGES[stage].junk; i++) {
    const hole = Math.floor(r() * COLS);
    grid[ROWS - 1 - i] = Array.from({length: COLS}, (_, x) => (x === hole ? 0 : 8));
  }
  const s: TetrisState = {grid, k: 0, r: 0, x: 0, y: 0, next: 0, lines: 0, done: null, bag: bagFrom(seed), seed, cleared: 0};
  s.next = pull(s);
  return spawn(s);
}

export const collide = (grid: Grid, k: number, r: number, x: number, y: number) =>
  shape(k, r).some(([cx, cy]) => { const gx = x + cx, gy = y + cy; return gx < 0 || gx >= COLS || gy >= ROWS || (gy >= 0 && grid[gy][gx] !== 0); });

function spawn(s: TetrisState): TetrisState {
  s.k = s.next;
  s.next = pull(s);
  s.r = 0;
  s.x = s.k === 2 ? 4 : 3;
  s.y = 0;
  if (collide(s.grid, s.k, s.r, s.x, s.y)) s.done = 'lose';
  return s;
}
const clone = (s: TetrisState): TetrisState => ({...s, grid: s.grid.map(row => [...row]), bag: [...s.bag]});

export function move(prev: TetrisState, dx: number): TetrisState {
  if (prev.done || collide(prev.grid, prev.k, prev.r, prev.x + dx, prev.y)) return prev;
  return {...prev, x: prev.x + dx};
}
/** 돌리기: 벽에 걸리면 옆으로 조금 비켜 본다 */
export function rotate(prev: TetrisState): TetrisState {
  if (prev.done) return prev;
  const r = prev.r + 1;
  for (const dx of [0, -1, 1, -2, 2]) if (!collide(prev.grid, prev.k, r, prev.x + dx, prev.y)) return {...prev, r, x: prev.x + dx};
  return prev;
}
/** 한 칸 내리기. 막히면 그 자리에 굳히고, 꽉 찬 줄을 지우고, 다음 조각을 꺼낸다 */
export function down(prev: TetrisState, goal: number): TetrisState {
  if (prev.done) return prev;
  if (!collide(prev.grid, prev.k, prev.r, prev.x, prev.y + 1)) return {...prev, y: prev.y + 1, cleared: 0};
  const s = clone(prev);
  for (const [cx, cy] of shape(s.k, s.r)) if (s.y + cy >= 0) s.grid[s.y + cy][s.x + cx] = s.k;
  const keep = s.grid.filter(row => row.some(v => v === 0));
  s.cleared = ROWS - keep.length;
  s.lines += s.cleared;
  s.grid = [...Array.from({length: s.cleared}, emptyRow), ...keep];
  if (s.lines >= goal) { s.done = 'win'; return s; }
  return spawn(s);
}
export function hardDrop(prev: TetrisState, goal: number): TetrisState {
  let s = prev;
  while (!s.done && !collide(s.grid, s.k, s.r, s.x, s.y + 1)) s = {...s, y: s.y + 1};
  return down(s, goal);
}
export const ghostY = (s: TetrisState) => { let y = s.y; while (!collide(s.grid, s.k, s.r, s.x, y + 1)) y += 1; return y; };
/** 남은 시간 비율로 메달 */
export const medalFor = (left: number, total: number): Medal => (left / total >= 0.5 ? 'gold' : left / total >= 0.25 ? 'silver' : 'bronze');

// ── 그리기 ──
const CELL = 36;
const COLORS = ['', '#5fae96', '#e8e4d6', '#b2583f', '#3a6d93', '#c98a52', '#7a5a92', '#d9a62e', '#8a8170'];
function block(g: CanvasRenderingContext2D, x: number, y: number, k: number, alpha = 1) {
  const px = x * CELL, py = y * CELL;
  g.globalAlpha = alpha;
  g.fillStyle = COLORS[k];
  g.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(px + 3, py + 3, CELL - 6, 5);
  g.strokeStyle = 'rgba(29,42,42,.55)';
  g.lineWidth = 2;
  g.beginPath();                                  // 조각의 금
  g.moveTo(px + 6 + ((x * 7 + y * 3) % 10), py + 4);
  g.lineTo(px + CELL / 2, py + CELL / 2);
  g.lineTo(px + CELL - 6, py + CELL - 8 - ((x + y * 5) % 8));
  g.stroke();
  g.strokeStyle = '#1d2a2a';
  g.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
  g.globalAlpha = 1;
}
export function draw(g: CanvasRenderingContext2D, s: TetrisState) {
  g.fillStyle = '#2b3433';
  g.fillRect(0, 0, COLS * CELL, ROWS * CELL);
  g.strokeStyle = 'rgba(255,255,255,.06)';
  g.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { g.beginPath(); g.moveTo(x * CELL, 0); g.lineTo(x * CELL, ROWS * CELL); g.stroke(); }
  for (let y = 1; y < ROWS; y++) { g.beginPath(); g.moveTo(0, y * CELL); g.lineTo(COLS * CELL, y * CELL); g.stroke(); }
  s.grid.forEach((row, y) => row.forEach((v, x) => { if (v) block(g, x, y, v); }));
  if (s.done) return;
  const gy = ghostY(s);
  for (const [cx, cy] of shape(s.k, s.r)) block(g, s.x + cx, gy + cy, s.k, 0.22);
  for (const [cx, cy] of shape(s.k, s.r)) if (s.y + cy >= 0) block(g, s.x + cx, s.y + cy, s.k);
}
function drawNext(g: CanvasRenderingContext2D, k: number) {
  g.clearRect(0, 0, 4 * CELL, 3 * CELL);
  const c = shape(k, 0);
  const w = Math.max(...c.map(p => p[0])) + 1, h = Math.max(...c.map(p => p[1])) + 1;
  g.save();
  g.translate(((4 - w) * CELL) / 2, ((3 - h) * CELL) / 2);
  for (const [x, y] of c) block(g, x, y, k);
  g.restore();
}

export const mountTetris: GameMount = env => {
  const game = env.game as unknown as TetrisGame;
  const cfg = STAGES[env.stage];
  const every = intervalFor(env.stage, env.power);
  const board = el('canvas', {class: 'tt-board', width: COLS * CELL, height: ROWS * CELL});
  const nextCv = el('canvas', {class: 'tt-next', width: 4 * CELL, height: 3 * CELL});
  const bar = el('div', {class: 'gm-meter tt-goal'}, el('span', {}));
  env.area.append(board, el('div', {class: 'tt-panel'}, el('p', {class: 'ms-label'}, game.next), nextCv, el('p', {class: 'ms-label'}, game.lines), bar));
  const lines = el('strong', {}, `0 / ${cfg.goal}`);
  const clock = el('strong', {});
  const msg = el('p', {class: 'gm-flash'});
  env.side.append(el('p', {class: 'gm-count'}, `${game.lines} `, lines), el('p', {class: 'gm-count'}, `${GL.time} `, clock), msg);
  const g = board.getContext('2d')!, gn = nextCv.getContext('2d')!;
  let s = newTetris(env.stage);
  let shownNext = -1;
  const t0 = performance.now();
  let fallAt = t0 + every;
  let frame = 0;
  const after = () => {
    if (s.cleared) {
      msg.className = 'gm-flash found';
      msg.textContent = s.cleared > 1 ? game.multi : game.line;
      s = {...s, cleared: 0};
    }
    lines.textContent = `${Math.min(s.lines, cfg.goal)} / ${cfg.goal}`;
    (bar.firstChild as HTMLElement).style.width = `${Math.min(100, (s.lines / cfg.goal) * 100)}%`;
    env.stageEl.dataset.lines = String(s.lines);
    env.stageEl.dataset.filled = String(s.grid.flat().filter(Boolean).length);
    if (s.done === 'win') env.end(medalFor(cfg.time - (performance.now() - t0) / 1000, cfg.time));
    else if (s.done === 'lose') env.end(null);
  };
  const loop = (now: number) => {
    if (now >= fallAt) { s = down(s, cfg.goal); fallAt = now + every; after(); }
    if (s.done) return;
    draw(g, s);
    if (shownNext !== s.next) { drawNext(gn, s.next); shownNext = s.next; }
    const left = cfg.time - (now - t0) / 1000;
    clock.textContent = `${Math.max(0, Math.ceil(left))}`;
    if (left <= 0) { env.end(null, game.timeUp); return; }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  env.onKey(e => {
    if (s.done) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') s = move(s, -1);
    else if (k === 'arrowright' || k === 'd') s = move(s, 1);
    else if ((k === 'arrowup' || k === 'w') && !e.repeat) s = rotate(s);
    else if (k === 'arrowdown' || k === 's') { s = down(s, cfg.goal); fallAt = performance.now() + every; after(); }
    else if (k === ' ' && !e.repeat) { s = hardDrop(s, cfg.goal); fallAt = performance.now() + every; after(); }
    else return;
    e.preventDefault();
    if (!s.done) draw(g, s);
  });
  return () => cancelAnimationFrame(frame);
};
