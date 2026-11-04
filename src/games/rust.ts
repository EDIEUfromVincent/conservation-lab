import type {Medal, Power, RustGame, StageNo} from './data';
import type {GameMount} from './env';
import {hearts, seeded} from './env';
import {el, add} from '../ui/dom';
import {GL} from './labels';
import {joystick} from '../mission/joystick';

// 돋보기 녹 찾기: 여신상 몸속 뼈대 단면 그림. 붉은 갈색 녹(철)만 찾아 표시하고, 초록 녹(보호막)은 그대로 둔다.
// 바탕 그림은 흐리게, 돋보기 안은 확대해 또렷하게 보인다.
// 2단계: 녹이 많고 시간 제한. 3단계: 어둡고 녹이 아주 작으며 뼈대 색과 비슷하다. 돋보기·현미경을 장착하면 렌즈가 커지고 밝고 또렷해진다.

export const W = 1600, H = 760, ZOOM = 2.6, LENS = 120;
export interface Spot {x: number; y: number; kind: 'rust' | 'green'}
/** 1단계: 녹은 철 뼈대 위, 초록 녹은 구리 겉면 위 */
export const SPOTS: Spot[] = [
  {x: 260, y: 214, kind: 'rust'}, {x: 640, y: 470, kind: 'rust'}, {x: 980, y: 214, kind: 'rust'},
  {x: 1340, y: 470, kind: 'rust'}, {x: 460, y: 620, kind: 'rust'}, {x: 1160, y: 350, kind: 'rust'},
  {x: 360, y: 380, kind: 'green'}, {x: 820, y: 300, kind: 'green'}, {x: 1260, y: 620, kind: 'green'}, {x: 540, y: 130, kind: 'green'},
];
const HIT = 30;
const BARS_Y = [214, 470], BARS_X = [250, 630, 970, 1330];

/** 뼈대 위 녹 n곳, 겉면 위 초록 녹 m곳을 씨앗 난수로 고른다(서로 120px 넘게 떨어지게) */
function makeSpots(seed: number, rust: number, green: number): Spot[] {
  const rnd = seeded(seed);
  const out: Spot[] = [];
  const far = (x: number, y: number) => out.every(p => Math.hypot(p.x - x, p.y - y) > 120);
  for (let t = 0; out.length < rust && t < 5000; t++) {
    const onRow = rnd() < 0.5;
    const x = onRow ? 60 + rnd() * (W - 120) : BARS_X[Math.floor(rnd() * 4)];
    const y = onRow ? BARS_Y[Math.floor(rnd() * 2)] : 60 + rnd() * (H - 120);
    if (far(x, y)) out.push({x: Math.round(x), y: Math.round(y), kind: 'rust'});
  }
  for (let t = 0; out.length < rust + green && t < 5000; t++) {
    const x = 60 + rnd() * (W - 120), y = 60 + rnd() * (H - 120);
    const offBar = BARS_Y.every(b => Math.abs(y - b) > 40) && BARS_X.every(b => Math.abs(x - b) > 40);
    if (offBar && far(x, y)) out.push({x: Math.round(x), y: Math.round(y), kind: 'green'});
  }
  return out;
}

/** 단계 설정: 점, 시간(초, 0이면 없음), 남은 기회(0이면 없음), 점 크기, 어둡기 */
export interface RustCfg {spots: Spot[]; time: number; lives: number; size: number; dark: boolean}
export const STAGES: Record<StageNo, RustCfg> = {
  1: {spots: SPOTS, time: 0, lives: 0, size: 1, dark: false},
  2: {spots: makeSpots(21, 9, 6), time: 60, lives: 6, size: 0.8, dark: false},
  3: {spots: makeSpots(37, 10, 6), time: 40, lives: 4, size: 0.42, dark: true},
};
/** 렌즈: 맨눈(어두운 3단계는 작고 흐림) · 돋보기 · 현미경. 분석력 레벨마다 시간 +3초 */
export function lensFor(cfg: RustCfg, power: Power) {
  if (power.has('microscope')) return {r: 165, zoom: 3.8, clear: true};
  if (power.has('loupe')) return {r: 145, zoom: 3.2, clear: true};
  return cfg.dark ? {r: 80, zoom: 1.5, clear: false} : {r: LENS, zoom: ZOOM, clear: true};
}
export const bonusTime = (power: Power) => 3 * (power.lv('analyze') - 1);

export interface RustState {found: number[]; mistakes: number; lastMsg: 'found' | 'green' | 'miss' | null}
export const newRust = (): RustState => ({found: [], mistakes: 0, lastMsg: null});

/** (x, y)에 표시하기. 순수 함수 */
export function mark(prev: RustState, x: number, y: number, spots: Spot[] = SPOTS): RustState {
  const s = {...prev, found: [...prev.found]};
  const i = spots.findIndex(p => Math.hypot(p.x - x, p.y - y) < HIT);
  if (i >= 0 && spots[i].kind === 'rust') {
    if (!s.found.includes(i)) s.found.push(i);
    s.lastMsg = 'found';
  } else {
    s.mistakes += 1;
    s.lastMsg = i >= 0 ? 'green' : 'miss';
  }
  return s;
}
export const totalOf = (spots: Spot[]) => spots.filter(p => p.kind === 'rust').length;
export const rustTotal = totalOf(SPOTS);
export const isDone = (s: RustState, spots: Spot[] = SPOTS) => s.found.length === totalOf(spots);
export const medalFor = (mistakes: number): Medal => (mistakes <= 1 ? 'gold' : mistakes <= 4 ? 'silver' : 'bronze');

/** 그림 한 장(2배 해상도)을 미리 그려 둔다 */
export function paintScene(cfg: RustCfg = STAGES[1]) {
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  // 구리 겉면(초록 판) + 판 이음매
  g.fillStyle = cfg.dark ? '#3f7a68' : '#5fae96';
  g.fillRect(0, 0, W, H);
  const rnd = seeded(7);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,40,30,.07)';
    g.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 10, 3 + rnd() * 8);
  }
  g.strokeStyle = 'rgba(20,60,50,.35)';
  g.lineWidth = 3;
  for (let x = 0; x < W; x += 200) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  // 철 뼈대: 가로·세로 막대 + 못
  g.fillStyle = '#6d4632';
  for (const y of BARS_Y) g.fillRect(0, y - 14, W, 28);
  for (const x of BARS_X) g.fillRect(x - 14, 0, 28, H);
  g.fillStyle = '#4f3324';
  for (const y of BARS_Y) for (let x = 40; x < W; x += 120) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  // 녹(붉은 갈색 부푼 자국) · 초록 녹(조금 다른 초록). 3단계 녹은 작고 뼈대 색에 가깝다.
  for (const p of cfg.spots) {
    const rust = p.kind === 'rust';
    for (let k = 0; k < 6; k++) {
      g.fillStyle = rust ? (cfg.dark ? (k % 2 ? '#8a4a2c' : '#9a5530') : (k % 2 ? '#a3502a' : '#c0622d')) : (k % 2 ? '#3f8f73' : '#7cc7a9');
      g.beginPath();
      g.arc(p.x + Math.cos(k) * 6 * cfg.size, p.y + Math.sin(k * 1.7) * 5 * cfg.size, Math.max(1, (rust ? 9 - k : 8 - k) * cfg.size), 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

export function draw(g: CanvasRenderingContext2D, scene: HTMLCanvasElement, s: RustState, lens: {x: number; y: number}, cfg: RustCfg = STAGES[1], view = {r: LENS, zoom: ZOOM, clear: true}) {
  g.clearRect(0, 0, W, H);
  // 바탕: 흐리고 어둡게(맨눈으로는 잘 안 보인다)
  g.save();
  g.filter = cfg.dark ? 'blur(3px) brightness(.42) saturate(.5)' : 'blur(2.2px) brightness(.82) saturate(.7)';
  g.drawImage(scene, 0, 0, W, H);
  g.restore();
  // 찾은 녹 표시
  for (const i of s.found) {
    const p = cfg.spots[i];
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(p.x, p.y, 26, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#1f7a4d';
    g.lineWidth = 4;
    g.stroke();
  }
  // 돋보기: 확대. 도구가 있으면 밝고 또렷하게, 맨눈은 어둡게 흐리다.
  const R = view.r;
  g.save();
  g.beginPath();
  g.arc(lens.x, lens.y, R, 0, Math.PI * 2);
  g.clip();
  if (cfg.dark) g.filter = view.clear ? 'brightness(1.25) contrast(1.5) saturate(1.4)' : 'blur(1.6px) brightness(.5) saturate(.6)';
  const sw = (R * 2) / view.zoom;
  g.drawImage(scene, (lens.x - sw / 2) * 2, (lens.y - sw / 2) * 2, sw * 2, sw * 2, lens.x - R, lens.y - R, R * 2, R * 2);
  g.restore();
  g.strokeStyle = '#1d2a2a';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(lens.x, lens.y, R, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255,255,255,.8)';
  g.beginPath();
  g.moveTo(lens.x - 14, lens.y); g.lineTo(lens.x + 14, lens.y);
  g.moveTo(lens.x, lens.y - 14); g.lineTo(lens.x, lens.y + 14);
  g.stroke();
  g.strokeStyle = '#1d2a2a';
  g.lineWidth = 18;
  g.beginPath();
  g.moveTo(lens.x + R * 0.72, lens.y + R * 0.72);
  g.lineTo(lens.x + R * 1.25, lens.y + R * 1.25);
  g.stroke();
}

export const mountRust: GameMount = env => {
  const game = env.game as unknown as RustGame;
  const cfg = STAGES[env.stage];
  const view = lensFor(cfg, env.power);
  const total = totalOf(cfg.spots);
  const scene = paintScene(cfg);
  const canvas = el('canvas', {class: 'gm-canvas', width: W, height: H});
  env.area.append(canvas);
  const g = canvas.getContext('2d')!;
  const count = el('strong', {}, `0 / ${total}`);
  const misses = el('strong', {}, cfg.lives ? hearts(cfg.lives, cfg.lives) : '0');
  const clock = el('strong', {});
  const msg = el('p', {class: 'gm-flash'});
  let joy = {x: 0, y: 0};
  const stick = joystick(GL.joystick, v => { joy = v; });
  const limit = cfg.time ? cfg.time + bonusTime(env.power) : 0;
  add(env.side, el('p', {class: 'gm-count'}, `${GL.found} `, count),
    el('p', {class: 'gm-count'}, `${cfg.lives ? GL.left : GL.mistakes} `, misses),
    limit ? el('p', {class: 'gm-count'}, `${GL.time} `, clock) : null, msg, stick.el);
  let s = newRust();
  const lens = {x: W / 2, y: H / 2};
  const messages = {found: game.found, green: game.green, miss: game.miss};
  const doMark = () => {
    s = mark(s, lens.x, lens.y, cfg.spots);
    count.textContent = `${s.found.length} / ${total}`;
    misses.textContent = cfg.lives ? hearts(cfg.lives - s.mistakes, cfg.lives) : String(s.mistakes);
    msg.textContent = s.lastMsg ? messages[s.lastMsg] : '';
    msg.className = 'gm-flash ' + (s.lastMsg ?? '');
    env.stageEl.dataset.found = String(s.found.length);
    if (isDone(s, cfg.spots)) { draw(g, scene, s, lens, cfg, view); env.end(medalFor(s.mistakes)); }
    else if (cfg.lives && s.mistakes >= cfg.lives) env.end(null);
  };
  // 마우스: 무대가 줄어든 만큼 되돌려 그림 좌표로
  const toCanvas = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    lens.x = Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W));
    lens.y = Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H));
  };
  canvas.addEventListener('mousemove', toCanvas);
  canvas.addEventListener('click', e => { toCanvas(e); doMark(); });
  const t0 = performance.now();
  let last = t0;
  let frame = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = (a: string, b: string) => (env.held.has(a) || env.held.has(b) ? 1 : 0);
    lens.x = Math.max(0, Math.min(W, lens.x + (k('arrowright', 'd') - k('arrowleft', 'a') + joy.x) * 600 * dt));
    lens.y = Math.max(0, Math.min(H, lens.y + (k('arrowdown', 's') - k('arrowup', 'w') - joy.y) * 600 * dt));
    draw(g, scene, s, lens, cfg, view);
    env.stageEl.dataset.lens = `${Math.round(lens.x)},${Math.round(lens.y)}`;
    if (limit) {
      const left = Math.max(0, limit - (now - t0) / 1000);
      clock.textContent = `${Math.ceil(left)}`;
      if (left <= 0) { env.end(null, game.timeUp); return; }
    }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  env.onKey(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doMark(); } });
  return () => { cancelAnimationFrame(frame); stick.release(); };
};
