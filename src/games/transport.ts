import type {Medal, StageNo, TransportGame, Power} from './data';
import type {GameMount} from './env';
import {el, add} from '../ui/dom';
import {GL} from './labels';
import {joystick} from '../mission/joystick';

// 안전 운반: 위에서 내려다본 S자 복도. 수레를 몰아 분석실까지 간다.
// 규칙은 두 가지뿐이다: ① 노란 문턱 위에서 '안전 속력'(속력 막대의 초록 선)보다 빠르면 흔들린다. ② 벽에 부딪히면 흔들린다.
// 흔들림이 100이 되면 다시 한다. 포장이 흔들림의 크기를 정한다.
// 2·3단계는 문턱이 많고 안전 속력이 낮으며 시간 제한이 있다. 완충재를 장착하면 안전 속력이 크게 올라간다.
// 3단계는 완충재 없이는 문턱마다 너무 천천히 가야 해서 시간 안에 도착할 수 없다.

export const W = 1600, H = 760;
type Rect = [number, number, number, number];   // x1, y1, x2, y2
const FLOOR: Rect[] = [[40, 80, 560, 240], [400, 80, 560, 680], [400, 520, 1200, 680], [1040, 80, 1200, 680], [1040, 80, 1560, 240]];
const B1: Rect[] = [[330, 80, 356, 240], [400, 400, 560, 426], [790, 520, 816, 680], [1040, 300, 1200, 326]];
const B2: Rect[] = [...B1, [200, 80, 226, 240], [400, 250, 560, 276], [620, 520, 646, 680], [1040, 440, 1200, 466]];
const B3: Rect[] = [...B2, [1300, 80, 1326, 240], [960, 520, 986, 680], [1040, 370, 1200, 396], [400, 325, 560, 351]];
const START = {x: 120, y: 160}, GOAL_X = 1440, R = 28;
export const MAX = 340;
const ACCEL = 900;

/** 단계 설정: 문턱, 흔들림 배수, 안전 속력(px/초), 시간 제한(초, 0이면 없음), 메달 기준 */
export interface TransportCfg {bumps: Rect[]; mult: number; safe: number; time: number; medal: [number, number]}
const STAGE: Record<StageNo, Omit<TransportCfg, 'mult'> & {base: number}> = {
  1: {bumps: B1, base: 1, safe: 110, time: 0, medal: [25, 55]},
  2: {bumps: B2, base: 1.3, safe: 90, time: 70, medal: [25, 55]},
  3: {bumps: B3, base: 1.6, safe: 30, time: 0, medal: [25, 55]},
};
/** 완충재: 안전 속력 +CUSHION. 재료 감각 레벨마다 +3(최대 +12) */
export const CUSHION = 130;
export function cfgFor(stage: StageNo, pack: number, power: Power): TransportCfg {
  const c = STAGE[stage];
  const skill = Math.min(12, 3 * (power.lv('material') - 1));
  return {...c, mult: pack * c.base, safe: c.safe + (power.has('cushion') ? CUSHION : 0) + skill, time: stage === 3 ? STAGE3_TIME : c.time};
}
export const STAGE3_TIME = 28;
export const STAGE1: TransportCfg = {...STAGE[1], mult: 1};

export interface TransportState {x: number; y: number; vx: number; vy: number; shake: number; done: 'win' | 'lose' | null; hitCool: number; bumpFlash: number; wallFlash: number; inBump: number}
export const newTransport = (): TransportState => ({x: START.x, y: START.y, vx: 0, vy: 0, shake: 0, done: null, hitCool: 0, bumpFlash: 0, wallFlash: 0, inBump: -1});

const inside = (x: number, y: number, r: Rect) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
/** 수레(원)가 바닥 위에 온전히 있는지: 둘레 여덟 점이 모두 어느 바닥 칸 안에 있으면 된다 */
const onFloor = (x: number, y: number) =>
  Array.from({length: 8}, (_, i) => [x + Math.cos(i * Math.PI / 4) * R, y + Math.sin(i * Math.PI / 4) * R])
    .every(([px, py]) => FLOOR.some(f => inside(px, py, f)));

/** 한 틱(dt초) 진행. input은 -1~1(위가 -y). pack은 흔들림 배수(숫자) 또는 단계 설정. 순수 함수라 단위 테스트한다. */
export function step(prev: TransportState, input: {x: number; y: number}, dt: number, pack: number | TransportCfg): TransportState {
  const cfg = typeof pack === 'number' ? {...STAGE1, mult: pack} : pack;
  const m = cfg.mult;
  const s = {...prev};
  if (s.done) return s;
  s.hitCool = Math.max(0, s.hitCool - dt);
  s.bumpFlash = Math.max(0, s.bumpFlash - dt);
  s.wallFlash = Math.max(0, s.wallFlash - dt);
  if (input.x || input.y) { s.vx += input.x * ACCEL * dt; s.vy += input.y * ACCEL * dt; }
  else { s.vx *= Math.max(0, 1 - 4 * dt); s.vy *= Math.max(0, 1 - 4 * dt); }
  const speed = Math.hypot(s.vx, s.vy);
  if (speed > MAX) { s.vx *= MAX / speed; s.vy *= MAX / speed; }
  const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
  // 벽: 막힌 방향만 튕겨 나오고 다른 방향으로는 벽을 따라 미끄러진다. 막힌 쪽 속력이 클수록 크게 흔들린다.
  const hit = (v: number) => {
    if (s.hitCool === 0 && Math.abs(v) > 40) { s.shake += (6 + Math.abs(v) * 0.05) * m; s.hitCool = 0.4; s.wallFlash = 0.8; }
  };
  if (onFloor(nx, ny)) { s.x = nx; s.y = ny; }
  else if (onFloor(nx, s.y)) { s.x = nx; hit(s.vy); s.vy *= -0.3; }
  else if (onFloor(s.x, ny)) { s.y = ny; hit(s.vx); s.vx *= -0.3; }
  else { hit(speed); s.vx *= -0.3; s.vy *= -0.3; }
  const v = Math.hypot(s.vx, s.vy);
  const b = cfg.bumps.findIndex(r => inside(s.x, s.y, r));
  s.inBump = b;
  if (b >= 0 && v > cfg.safe) { s.shake += (v - cfg.safe) * 1.3 * m * dt; s.bumpFlash = 0.8; }
  s.shake = Math.min(100, s.shake);
  if (s.shake >= 100) s.done = 'lose';
  else if (s.x > GOAL_X && s.y < 240) s.done = 'win';
  return s;
}
export const medalFor = (shake: number, cfg: TransportCfg = STAGE1): Medal => (shake < cfg.medal[0] ? 'gold' : shake < cfg.medal[1] ? 'silver' : 'bronze');

export const mountTransport: GameMount = env => {
  const game = env.game as unknown as TransportGame;
  const cfg = cfgFor(env.stage, env.pack, env.power);
  const canvas = el('canvas', {class: 'gm-canvas', width: W, height: H});
  env.area.append(canvas);
  const g = canvas.getContext('2d')!;
  const meter = el('div', {class: 'gm-meter'}, el('span', {}));
  const fill = el('span', {class: 'tr-fill'});
  const speedBar = el('div', {class: 'tr-speed'}, fill, el('i', {class: 'tr-safe', style: `left:${Math.min(100, (cfg.safe / MAX) * 100)}%`}));
  const flash = el('p', {class: 'gm-flash'});
  const clock = el('strong', {});
  let joy = {x: 0, y: 0};
  const stick = joystick(GL.joystick, v => { joy = v; });
  add(env.side, el('p', {class: 'ms-label'}, GL.shake), meter, el('p', {class: 'ms-label'}, `${GL.speed} · ${GL.safeLine}`), speedBar,
    cfg.time ? el('p', {class: 'gm-count'}, `${GL.time} `, clock) : null, flash, stick.el);
  let s = newTransport();
  const t0 = performance.now();
  let last = t0;
  let frame = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = (a: string, b: string) => (env.held.has(a) || env.held.has(b) ? 1 : 0);
    const ix = k('arrowright', 'd') - k('arrowleft', 'a') + joy.x;
    const iy = k('arrowdown', 's') - k('arrowup', 'w') - joy.y;
    const len = Math.hypot(ix, iy);
    s = step(s, len > 1 ? {x: ix / len, y: iy / len} : {x: ix, y: iy}, dt, cfg);
    draw(g, s, game, now / 1000, cfg.bumps);
    (meter.firstChild as HTMLElement).style.width = `${s.shake}%`;
    meter.className = 'gm-meter' + (s.shake > 66 ? ' high' : s.shake > 33 ? ' mid' : '');
    const v = Math.hypot(s.vx, s.vy);
    fill.style.width = `${(v / MAX) * 100}%`;
    fill.classList.toggle('over', v > cfg.safe);
    flash.textContent = s.wallFlash > 0 ? game.wall : s.bumpFlash > 0 ? game.bump : '';
    env.stageEl.dataset.shake = String(Math.round(s.shake));
    env.stageEl.dataset.pos = `${Math.round(s.x)},${Math.round(s.y)}`;
    if (s.done) { env.end(s.done === 'win' ? medalFor(s.shake, cfg) : null); return; }
    if (cfg.time) {
      const left = cfg.time - (now - t0) / 1000;
      clock.textContent = `${Math.max(0, Math.ceil(left))}`;
      if (left <= 0) { env.end(null, game.timeUp); return; }
    }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(frame); stick.release(); };
};

export function draw(g: CanvasRenderingContext2D, s: TransportState, game: TransportGame, t: number, bumps: Rect[] = B1) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#5b6b62';
  g.fillRect(0, 0, W, H);
  // 바닥 칸
  for (const [x1, y1, x2, y2] of FLOOR) {
    g.fillStyle = '#efe5cf';
    g.fillRect(x1, y1, x2 - x1, y2 - y1);
  }
  g.strokeStyle = '#e2d6bb';
  g.lineWidth = 2;
  for (let x = 0; x < W; x += 40) for (const f of FLOOR) if (x > f[0] && x < f[2]) { g.beginPath(); g.moveTo(x, f[1]); g.lineTo(x, f[3]); g.stroke(); }
  // 문턱(노란 줄무늬)
  for (const [x1, y1, x2, y2] of bumps) {
    g.fillStyle = '#f2b632';
    g.fillRect(x1, y1, x2 - x1, y2 - y1);
    g.fillStyle = '#1d2a2a';
    const vertical = y2 - y1 > x2 - x1;
    for (let i = 0; i < (vertical ? y2 - y1 : x2 - x1); i += 22)
      vertical ? g.fillRect(x1, y1 + i, x2 - x1, 9) : g.fillRect(x1 + i, y1, 9, y2 - y1);
  }
  // 출발·도착 방
  g.font = '800 34px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#3a6d93';
  g.fillText(game.start, 150, 230);
  g.fillStyle = 'rgba(31,122,77,.18)';
  g.fillRect(GOAL_X, 80, 1560 - GOAL_X, 160);
  g.fillStyle = '#1f7a4d';
  g.fillText(game.goal, 1500, 170);
  // 수레: 흔들림이 크면 떨린다
  const jitter = Math.min(6, s.shake / 15) * Math.sin(t * 40);
  g.save();
  g.translate(s.x + jitter, s.y);
  g.fillStyle = '#9a6b45';
  g.strokeStyle = '#1d2a2a';
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(-R, -R, R * 2, R * 2, 10);
  g.fill();
  g.stroke();
  g.fillStyle = '#c7a26b';
  g.fillRect(-16, -16, 32, 32);
  g.strokeRect(-16, -16, 32, 32);
  g.restore();
}
