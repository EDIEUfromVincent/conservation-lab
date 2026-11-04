import type {CatchGame, Medal, Power, StageNo} from './data';
import type {GameMount} from './env';
import {hearts, seeded} from './env';
import {el} from '../ui/dom';
import {GL} from './labels';
import {joystick} from '../mission/joystick';

// 하늘에서 떨어지는 유물 조각: 바구니로 청자 꽃병 조각(동그라미 무늬)만 받아 꽃병을 완성한다.
// 다른 유물 조각을 받으면 점수가 깎이고 기회가 하나 줄어든다.
// 1단계: 다른 조각은 색이 뚜렷이 다르다(백자·토기). 2단계: 빠르고, 색이 비슷한 다른 청자(마름모 무늬)도 섞인다.
// 3단계: 모든 조각이 같은 청자 색이고 무늬가 아주 작고 흐리다. 돋보기·현미경을 장착하면 무늬가 크고 또렷해진다(현미경은 꽃병 조각 테두리도 빛난다).

export const W = 1600, H = 760, BASKET_W = 220, BASKET_Y = 680, R = 36;
type Kind = 'good' | 'white' | 'brown' | 'other';
export interface CatchCfg {goal: number; lives: number; every: number; speed: number; bad: number; kinds: Kind[]; time: number; faint: boolean}
export const STAGES: Record<StageNo, CatchCfg> = {
  1: {goal: 8, lives: 5, every: 1.1, speed: 210, bad: 0.35, kinds: ['white', 'brown'], time: 70, faint: false},
  2: {goal: 12, lives: 4, every: 0.8, speed: 300, bad: 0.5, kinds: ['white', 'brown', 'other'], time: 75, faint: false},
  3: {goal: 16, lives: 3, every: 0.7, speed: 340, bad: 0.5, kinds: ['other'], time: 80, faint: true},
};
/** 무늬가 보이는 정도: 0 거의 안 보임, 1 또렷, 2 또렷 + 꽃병 조각 테두리 */
export const sight = (cfg: CatchCfg, p: Power) => (p.has('microscope') ? 2 : p.has('loupe') ? 1 : cfg.faint ? 0 : 1);

export interface Piece {id: number; x: number; y: number; kind: Kind; spin: number}
export interface CatchState {pieces: Piece[]; basket: number; got: number; bad: number; score: number; t: number; spawnAt: number; nextId: number; done: 'win' | 'lose' | 'time' | null; last: 'right' | 'wrong' | null}
export const newCatch = (): CatchState => ({pieces: [], basket: W / 2, got: 0, bad: 0, score: 0, t: 0, spawnAt: 0.6, nextId: 0, done: null, last: null});

/** 한 틱: 조각을 만들고, 떨어뜨리고, 바구니에 닿으면 받는다. move는 바구니의 새 x. 순수 함수(rnd만 바깥에서) */
export function tick(prev: CatchState, dt: number, cfg: CatchCfg, move: number, rnd: () => number): CatchState {
  if (prev.done) return prev;
  const s: CatchState = {...prev, pieces: prev.pieces.map(p => ({...p})), basket: Math.max(BASKET_W / 2, Math.min(W - BASKET_W / 2, move)), last: null};
  s.t += dt;
  if (s.t >= s.spawnAt) {
    const bad = rnd() < cfg.bad;
    const kind = bad ? cfg.kinds[Math.floor(rnd() * cfg.kinds.length)] : 'good';
    s.pieces.push({id: s.nextId++, x: 60 + rnd() * (W - 120), y: -R, kind, spin: rnd() * 6});
    s.spawnAt = s.t + cfg.every * (0.7 + rnd() * 0.6);
  }
  const keep: Piece[] = [];
  for (const p of s.pieces) {
    const before = p.y;
    p.y += cfg.speed * dt;
    p.spin += dt;
    if (before + R < BASKET_Y && p.y + R >= BASKET_Y && Math.abs(p.x - s.basket) <= BASKET_W / 2 + R * 0.4) {
      if (p.kind === 'good') { s.got += 1; s.score += 10; s.last = 'right'; }
      else { s.bad += 1; s.score -= 15; s.last = 'wrong'; }
      continue;
    }
    if (p.y - R < H) keep.push(p);
  }
  s.pieces = keep;
  if (s.got >= cfg.goal) s.done = 'win';
  else if (s.bad >= cfg.lives) s.done = 'lose';
  else if (s.t >= cfg.time) s.done = 'time';
  return s;
}
export const medalFor = (bad: number): Medal => (bad === 0 ? 'gold' : bad <= 1 ? 'silver' : 'bronze');

// ── 그리기 ──
const LOOK: Record<Kind, {fill: string; mark: string; shape: 'dot' | 'diamond' | 'line'}> = {
  good: {fill: '#7fb8a4', mark: '#fffdf7', shape: 'dot'},
  other: {fill: '#7fb8a4', mark: '#fffdf7', shape: 'diamond'},
  white: {fill: '#eef0ea', mark: '#3a6d93', shape: 'line'},
  brown: {fill: '#9a6b45', mark: '#e2c79a', shape: 'line'},
};
const OTHER2 = '#8cc2a2';   // 2단계 다른 청자는 색이 조금 다르다
function shard(g: CanvasRenderingContext2D, p: Piece, cfg: CatchCfg, see: number) {
  const look = LOOK[p.kind];
  const r = seeded(1000 + p.id);
  g.save();
  g.translate(p.x, p.y);
  g.rotate(Math.sin(p.spin) * 0.35);
  g.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, d = R * (0.75 + r() * 0.3);
    i ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  g.closePath();
  g.fillStyle = p.kind === 'other' && !cfg.faint ? OTHER2 : look.fill;
  g.fill();
  g.lineWidth = see === 2 && p.kind === 'good' ? 7 : 4;
  g.strokeStyle = see === 2 && p.kind === 'good' ? '#f2b632' : '#1d2a2a';
  g.stroke();
  // 무늬: 맨눈으로 보는 3단계는 아주 작고 흐리다
  const size = see ? 6 : 2.2;
  g.globalAlpha = see ? 0.95 : 0.18;
  g.fillStyle = look.mark;
  g.strokeStyle = look.mark;
  g.lineWidth = 3;
  for (const [mx, my] of [[-12, -8], [10, -10], [0, 8], [-14, 12], [14, 10]]) {
    if (look.shape === 'dot') { g.beginPath(); g.arc(mx, my, size, 0, Math.PI * 2); g.fill(); }
    if (look.shape === 'diamond') { g.beginPath(); g.moveTo(mx, my - size); g.lineTo(mx + size, my); g.lineTo(mx, my + size); g.lineTo(mx - size, my); g.closePath(); g.fill(); }
  }
  if (look.shape === 'line') { g.beginPath(); g.moveTo(-R * 0.6, -4); g.quadraticCurveTo(0, -14, R * 0.6, -4); g.stroke(); g.beginPath(); g.moveTo(-R * 0.5, 10); g.lineTo(R * 0.5, 10); g.stroke(); }
  g.restore();
}
/** 완성할 청자 꽃병: 모은 만큼 아래부터 채워진다 */
function vase(g: CanvasRenderingContext2D, ratio: number) {
  const path = () => {
    g.beginPath();
    g.moveTo(90, 40); g.lineTo(130, 40); g.quadraticCurveTo(122, 70, 150, 110);
    g.quadraticCurveTo(190, 170, 150, 230); g.lineTo(70, 230);
    g.quadraticCurveTo(30, 170, 70, 110); g.quadraticCurveTo(98, 70, 90, 40); g.closePath();
  };
  g.save();
  g.translate(20, 10);
  path();
  g.fillStyle = 'rgba(255,253,247,.35)';
  g.fill();
  g.save();
  path();
  g.clip();
  g.fillStyle = '#7fb8a4';
  g.fillRect(0, 230 - 190 * ratio, 240, 190 * ratio);
  g.fillStyle = '#fffdf7';
  for (const [x, y] of [[90, 150], [130, 170], [110, 200], [100, 120], [125, 130]]) if (y > 230 - 190 * ratio) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  g.restore();
  path();
  g.lineWidth = 5;
  g.strokeStyle = '#1d2a2a';
  g.setLineDash([10, 8]);
  g.stroke();
  g.restore();
}
export function draw(g: CanvasRenderingContext2D, s: CatchState, cfg: CatchCfg, see: number) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#bfe3ef'); sky.addColorStop(1, '#f7f0de');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#c9b48c';
  g.fillRect(0, H - 40, W, 40);
  vase(g, Math.min(1, s.got / cfg.goal));
  for (const p of s.pieces) shard(g, p, cfg, see);
  // 바구니
  const bx = s.basket - BASKET_W / 2;
  g.fillStyle = '#b07a45';
  g.strokeStyle = '#1d2a2a';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(bx, BASKET_Y); g.lineTo(bx + BASKET_W, BASKET_Y); g.lineTo(bx + BASKET_W - 22, BASKET_Y + 60); g.lineTo(bx + 22, BASKET_Y + 60); g.closePath();
  g.fill(); g.stroke();
  g.strokeStyle = 'rgba(29,42,42,.4)';
  g.lineWidth = 3;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(bx + (BASKET_W / 6) * i, BASKET_Y + 4); g.lineTo(bx + 22 + ((BASKET_W - 44) / 6) * i, BASKET_Y + 56); g.stroke(); }
}

export const mountCatch: GameMount = env => {
  const game = env.game as unknown as CatchGame;
  const cfg = STAGES[env.stage];
  const see = sight(cfg, env.power);
  const canvas = el('canvas', {class: 'gm-canvas', width: W, height: H});
  env.area.append(canvas);
  const g = canvas.getContext('2d')!;
  const got = el('strong', {}, `0 / ${cfg.goal}`);
  const score = el('strong', {}, '0');
  const left = el('strong', {}, hearts(cfg.lives, cfg.lives));
  const clock = el('strong', {});
  const msg = el('p', {class: 'gm-flash'});
  let joy = {x: 0, y: 0};
  const stick = joystick(GL.joystick, v => { joy = v; });
  env.side.append(el('p', {class: 'gm-count'}, `${game.targetName} `, got), el('p', {class: 'gm-count'}, `${game.score} `, score),
    el('p', {class: 'gm-count'}, `${GL.left} `, left), el('p', {class: 'gm-count'}, `${GL.time} `, clock), msg, stick.el);
  msg.textContent = game.look;
  msg.className = 'gm-flash found';
  let s = newCatch();
  let target = s.basket;
  const rnd = seeded(700 + env.stage);
  canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); target = ((e.clientX - r.left) / r.width) * W; });
  let last = performance.now();
  let frame = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = (a: string, b: string) => (env.held.has(a) || env.held.has(b) ? 1 : 0);
    const dir = k('arrowright', 'd') - k('arrowleft', 'a') + joy.x;
    if (dir) target = s.basket + dir * 900 * dt;
    const step = Math.max(-1100 * dt, Math.min(1100 * dt, target - s.basket));
    s = tick(s, dt, cfg, s.basket + step, rnd);
    if (s.last) {
      msg.className = 'gm-flash' + (s.last === 'right' ? ' found' : '');
      msg.textContent = s.last === 'right' ? game.right : game.wrong;
    }
    got.textContent = `${Math.min(s.got, cfg.goal)} / ${cfg.goal}`;
    score.textContent = String(s.score);
    left.textContent = hearts(cfg.lives - s.bad, cfg.lives);
    clock.textContent = `${Math.max(0, Math.ceil(cfg.time - s.t))}`;
    draw(g, s, cfg, see);
    env.stageEl.dataset.basket = String(Math.round(s.basket));
    env.stageEl.dataset.got = String(s.got);
    env.stageEl.dataset.bad = String(s.bad);
    if (s.done) { env.end(s.done === 'win' ? medalFor(s.bad) : null, s.done === 'time' ? game.timeUp : undefined); return; }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(frame); stick.release(); };
};
