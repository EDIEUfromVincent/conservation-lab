import type {Medal, TransportGame} from './data';

// 안전 운반: 위에서 내려다본 S자 복도. 수레를 몰아 분석실까지 간다.
// 문턱을 빨리 넘거나 벽에 부딪히면 흔들림이 쌓이고, 100이 되면 다시 한다. 포장(완충재)이 흔들림을 줄인다.

export const W = 1600, H = 760;
type Rect = [number, number, number, number];   // x1, y1, x2, y2
const FLOOR: Rect[] = [[40, 80, 560, 240], [400, 80, 560, 680], [400, 520, 1200, 680], [1040, 80, 1200, 680], [1040, 80, 1560, 240]];
const BUMPS: Rect[] = [[330, 80, 356, 240], [400, 400, 560, 426], [790, 520, 816, 680], [1040, 300, 1200, 326]];
const START = {x: 120, y: 160}, GOAL_X = 1440, R = 28;
const MAX = 340, ACCEL = 900;

export interface TransportState {x: number; y: number; vx: number; vy: number; shake: number; done: 'win' | 'lose' | null; hitCool: number; bumpFlash: number; wallFlash: number}
export const newTransport = (): TransportState => ({x: START.x, y: START.y, vx: 0, vy: 0, shake: 0, done: null, hitCool: 0, bumpFlash: 0, wallFlash: 0});

const inside = (x: number, y: number, r: Rect) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
/** 수레(원)가 바닥 위에 온전히 있는지: 둘레 여덟 점이 모두 어느 바닥 칸 안에 있으면 된다 */
const onFloor = (x: number, y: number) =>
  Array.from({length: 8}, (_, i) => [x + Math.cos(i * Math.PI / 4) * R, y + Math.sin(i * Math.PI / 4) * R])
    .every(([px, py]) => FLOOR.some(f => inside(px, py, f)));

/** 한 틱(dt초) 진행. input은 -1~1(위가 -y). pack은 포장의 흔들림 배수. 순수 함수라 단위 테스트한다. */
export function step(prev: TransportState, input: {x: number; y: number}, dt: number, pack: number): TransportState {
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
    if (s.hitCool === 0 && Math.abs(v) > 40) { s.shake += (6 + Math.abs(v) * 0.05) * pack; s.hitCool = 0.4; s.wallFlash = 0.8; }
  };
  if (onFloor(nx, ny)) { s.x = nx; s.y = ny; }
  else if (onFloor(nx, s.y)) { s.x = nx; hit(s.vy); s.vy *= -0.3; }
  else if (onFloor(s.x, ny)) { s.y = ny; hit(s.vx); s.vx *= -0.3; }
  else { hit(speed); s.vx *= -0.3; s.vy *= -0.3; }
  const v = Math.hypot(s.vx, s.vy);
  if (BUMPS.some(b => inside(s.x, s.y, b)) && v > 110) { s.shake += (v - 110) * 1.3 * pack * dt; s.bumpFlash = 0.8; }
  if (v > 260) s.shake += (v - 260) * 0.05 * pack * dt;
  s.shake = Math.min(100, s.shake);
  if (s.shake >= 100) s.done = 'lose';
  else if (s.x > GOAL_X && s.y < 240) s.done = 'win';
  return s;
}
export const medalFor = (shake: number): Medal => (shake < 25 ? 'gold' : shake < 55 ? 'silver' : 'bronze');

export function draw(g: CanvasRenderingContext2D, s: TransportState, game: TransportGame, t: number) {
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
  for (const [x1, y1, x2, y2] of BUMPS) {
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
