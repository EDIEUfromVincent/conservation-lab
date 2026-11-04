import type {PigmentGame, Power, StageNo} from './data';
import type {GameMount} from './env';
import {hearts, medalByMistakes, seeded, shuffle} from './env';
import {el, add} from '../ui/dom';
import {svg} from '../ui/art';
import {GL} from './labels';

// 단청 색가루 맞히기: 단청에서 떼어 낸 작은 조각을 보고, 같은 색가루 샘플을 고른다.
// 휴대 현미경을 장착하면 조각과 샘플의 알갱이 모양(둥근·모난·바늘·판)이 보인다. 없으면 색만 보인다.
// 3단계는 네 샘플의 색이 거의 같아서, 알갱이 모양을 보지 않으면 찍을 수밖에 없다.

export type Shape = 'round' | 'sharp' | 'needle' | 'flake';
export interface Sample {name: string; color: string; shape: Shape}
const NAMES = ['가', '나', '다', '라'];
const SHAPES: Shape[] = ['round', 'sharp', 'needle', 'flake'];
const COLORS: Record<StageNo, string[]> = {
  1: ['#b8452f', '#2f5fa8', '#3f8f5a', '#d9a62e'],
  2: ['#b8452f', '#c4583a', '#3f8f5a', '#4c9a68'],
  3: ['#b8452f', '#b9472f', '#b7442e', '#ba462f'],
};
export interface PigmentCfg {n: number; lives: number}
export const STAGES: Record<StageNo, PigmentCfg> = {1: {n: 4, lives: 3}, 2: {n: 6, lives: 3}, 3: {n: 6, lives: 2}};
export const canSeeShape = (p: Power) => p.has('microscope');

/** 샘플 4개(모양은 단계마다 섞인다)와 맞혀야 할 조각들(샘플 번호) */
export function setup(stage: StageNo) {
  const r = seeded(500 + stage);
  const shapes = shuffle(SHAPES, r);
  const samples: Sample[] = NAMES.map((name, i) => ({name, color: COLORS[stage][i], shape: shapes[i]}));
  const base = shuffle([0, 1, 2, 3], r);
  const answers = Array.from({length: STAGES[stage].n}, (_, i) => (i < 4 ? base[i] : Math.floor(r() * 4)));
  return {samples, answers};
}
export const judge = (answer: number, pick: number) => answer === pick;

/** 알갱이 그림: 색 바탕 원 + 모양 알갱이들(모양이 안 보이면 색 바탕만) */
function particles(sample: Sample, showShape: boolean, seed: number, size: number) {
  const s = svg('svg', {viewBox: '0 0 200 200', class: 'pg-view', width: size, height: size, 'aria-hidden': 'true'});
  s.append(svg('circle', {cx: 100, cy: 100, r: 96, fill: sample.color, stroke: '#1d2a2a', 'stroke-width': 6}));
  if (showShape) {
    const r = seeded(seed);
    const ink = {fill: '#fffdf7', 'fill-opacity': 0.55, stroke: '#1d2a2a', 'stroke-width': 2.5};
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = r() * 70;
      const x = 100 + Math.cos(a) * d, y = 100 + Math.sin(a) * d, rot = r() * 180;
      const g = svg('g', {transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})`});
      if (sample.shape === 'round') g.append(svg('circle', {r: 7 + r() * 3, ...ink}));
      if (sample.shape === 'sharp') g.append(svg('polygon', {points: '-9,-6 3,-10 10,2 -2,9', ...ink}));
      if (sample.shape === 'needle') g.append(svg('rect', {x: -14, y: -2, width: 28, height: 4, rx: 2, ...ink}));
      if (sample.shape === 'flake') g.append(svg('polygon', {points: '-12,-4 -4,-9 12,-6 10,5 -6,8', ...ink, 'fill-opacity': 0.3}));
      s.append(g);
    }
  }
  return s;
}

export const mountPigment: GameMount = env => {
  const game = env.game as unknown as PigmentGame;
  const c = STAGES[env.stage];
  const {samples, answers} = setup(env.stage);
  const see = canSeeShape(env.power);
  let i = 0, mistakes = 0;
  const scope = el('div', {class: 'pg-scope'});
  const cards = samples.map((s, k) => {
    const b = el('button', {type: 'button', class: 'pg-card', 'data-sample': k, onclick: () => pick(k)},
      particles(s, see, 900 + k, 150),
      el('strong', {}, `${k + 1} · ${game.sample} ${s.name}`),
      el('span', {class: 'pg-shape'}, see ? game.shapes[s.shape] : `${GL.shape} ?`));
    return b;
  });
  env.area.append(scope, el('div', {class: 'pg-cards'}, ...cards));
  const left = el('strong', {}, hearts(c.lives, c.lives));
  const prog = el('strong', {}, `0 / ${c.n}`);
  const msg = el('p', {class: 'gm-flash'});
  env.side.append(el('p', {class: 'gm-count'}, `${GL.progress} `, prog), el('p', {class: 'gm-count'}, `${GL.left} `, left), msg);
  const show = () => {
    scope.replaceChildren();
    add(scope, particles(samples[answers[i]], see, 700 + i * 13, 380), see ? null : el('p', {class: 'pg-note'}, game.noShape));
    env.stageEl.dataset.piece = String(i);
  };
  const pick = (k: number) => {
    if (i >= answers.length) return;
    if (judge(answers[i], k)) { msg.className = 'gm-flash found'; msg.textContent = game.right; i += 1; prog.textContent = `${i} / ${c.n}`; }
    else { mistakes += 1; msg.className = 'gm-flash'; msg.textContent = game.wrong; left.textContent = hearts(c.lives - mistakes, c.lives); }
    if (mistakes >= c.lives) { env.end(null); return; }
    if (i >= answers.length) { env.end(medalByMistakes(mistakes, 0, 1)); return; }
    show();
  };
  env.onKey(e => { const n = Number(e.key); if (!e.repeat && n >= 1 && n <= 4) pick(n - 1); });
  show();
  return () => {};
};
