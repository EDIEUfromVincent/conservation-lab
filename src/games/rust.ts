import type {Medal} from './data';

// 돋보기 녹 찾기: 여신상 몸속 뼈대 단면 그림. 붉은 갈색 녹(철)만 찾아 표시하고, 초록 녹(보호막)은 그대로 둔다.
// 바탕 그림은 흐리게, 돋보기 안은 2.6배로 또렷하게 보인다.

export const W = 1600, H = 760, ZOOM = 2.6, LENS = 120;
export interface Spot {x: number; y: number; kind: 'rust' | 'green'}
/** 녹은 철 뼈대 위, 초록 녹은 구리 겉면 위 */
export const SPOTS: Spot[] = [
  {x: 260, y: 214, kind: 'rust'}, {x: 640, y: 470, kind: 'rust'}, {x: 980, y: 214, kind: 'rust'},
  {x: 1340, y: 470, kind: 'rust'}, {x: 460, y: 620, kind: 'rust'}, {x: 1160, y: 350, kind: 'rust'},
  {x: 360, y: 380, kind: 'green'}, {x: 820, y: 300, kind: 'green'}, {x: 1260, y: 620, kind: 'green'}, {x: 540, y: 130, kind: 'green'},
];
const HIT = 30;

export interface RustState {found: number[]; mistakes: number; lastMsg: 'found' | 'green' | 'miss' | null}
export const newRust = (): RustState => ({found: [], mistakes: 0, lastMsg: null});

/** (x, y)에 표시하기. 순수 함수 */
export function mark(prev: RustState, x: number, y: number): RustState {
  const s = {...prev, found: [...prev.found]};
  const i = SPOTS.findIndex(p => Math.hypot(p.x - x, p.y - y) < HIT);
  if (i >= 0 && SPOTS[i].kind === 'rust') {
    if (!s.found.includes(i)) s.found.push(i);
    s.lastMsg = 'found';
  } else {
    s.mistakes += 1;
    s.lastMsg = i >= 0 ? 'green' : 'miss';
  }
  return s;
}
export const rustTotal = SPOTS.filter(p => p.kind === 'rust').length;
export const isDone = (s: RustState) => s.found.length === rustTotal;
export const medalFor = (mistakes: number): Medal => (mistakes <= 1 ? 'gold' : mistakes <= 4 ? 'silver' : 'bronze');

/** 그림 한 장(2배 해상도)을 미리 그려 둔다 */
export function paintScene() {
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  // 구리 겉면(초록 판) + 판 이음매
  g.fillStyle = '#5fae96';
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,40,30,.07)';
    g.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 10, 3 + rnd() * 8);
  }
  g.strokeStyle = 'rgba(20,60,50,.35)';
  g.lineWidth = 3;
  for (let x = 0; x < W; x += 200) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  // 철 뼈대: 가로·세로 막대 + 못
  g.fillStyle = '#6d4632';
  for (const y of [200, 456]) g.fillRect(0, y, W, 28);
  for (const x of [250, 630, 970, 1330]) g.fillRect(x - 14, 0, 28, H);
  g.fillStyle = '#4f3324';
  for (const y of [214, 470]) for (let x = 40; x < W; x += 120) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  // 녹(붉은 갈색 부푼 자국) · 초록 녹(조금 다른 초록)
  for (const p of SPOTS) {
    const rust = p.kind === 'rust';
    for (let k = 0; k < 6; k++) {
      g.fillStyle = rust ? (k % 2 ? '#a3502a' : '#c0622d') : (k % 2 ? '#3f8f73' : '#7cc7a9');
      g.beginPath();
      g.arc(p.x + Math.cos(k) * 6, p.y + Math.sin(k * 1.7) * 5, rust ? 9 - k : 8 - k, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

export function draw(g: CanvasRenderingContext2D, scene: HTMLCanvasElement, s: RustState, lens: {x: number; y: number}) {
  g.clearRect(0, 0, W, H);
  // 바탕: 흐리고 어둡게(맨눈으로는 잘 안 보인다)
  g.save();
  g.filter = 'blur(2.2px) brightness(.82) saturate(.7)';
  g.drawImage(scene, 0, 0, W, H);
  g.restore();
  // 찾은 녹 표시
  for (const i of s.found) {
    const p = SPOTS[i];
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(p.x, p.y, 26, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#1f7a4d';
    g.lineWidth = 4;
    g.stroke();
  }
  // 돋보기: 또렷하게 확대
  g.save();
  g.beginPath();
  g.arc(lens.x, lens.y, LENS, 0, Math.PI * 2);
  g.clip();
  const sw = (LENS * 2) / ZOOM;
  g.drawImage(scene, (lens.x - sw / 2) * 2, (lens.y - sw / 2) * 2, sw * 2, sw * 2, lens.x - LENS, lens.y - LENS, LENS * 2, LENS * 2);
  g.restore();
  g.strokeStyle = '#1d2a2a';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(lens.x, lens.y, LENS, 0, Math.PI * 2);
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
  g.moveTo(lens.x + LENS * 0.72, lens.y + LENS * 0.72);
  g.lineTo(lens.x + LENS * 1.25, lens.y + LENS * 1.25);
  g.stroke();
}
