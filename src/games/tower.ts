import type {Power, StageNo, TowerGame} from './data';
import type {GameMount} from './env';
import {hearts, medalByMistakes, seeded} from './env';
import {el, button, add} from '../ui/dom';
import {GL} from './labels';

// 증거가 있는 층까지만: 돌탑의 층마다 카드가 있다. 증거가 있는 층이면 쌓고, 상상·짐작이면 뺀다.
// 2단계는 카드 셋 중 하나, 3단계는 모든 카드 글씨가 흐리다. 돋보기나 현미경을 장착하면 흐린 글씨도 또렷하게 읽힌다.
// 3단계를 도구 없이 찍어서 깰 확률은 0.3%쯤(12장 중 1장까지만 틀려야 한다).

export interface TowerCfg {n: number; lives: number; blurEvery: number}   // blurEvery: 0 없음, k면 k장마다 한 장(1이면 모두)
export const STAGES: Record<StageNo, TowerCfg> = {
  1: {n: 6, lives: 3, blurEvery: 0},
  2: {n: 9, lives: 3, blurEvery: 3},
  3: {n: 12, lives: 2, blurEvery: 1},
};
export const canRead = (p: Power) => p.has('loupe') || p.has('microscope');

/** 층 카드: 증거 문장(true) 또는 상상 문장(false). 단계마다 늘 같다 */
export function cards(stage: StageNo, game: Pick<TowerGame, 'evidence' | 'imagined'>) {
  const c = STAGES[stage];
  const r = seeded(400 + stage);
  return Array.from({length: c.n}, (_, i) => {
    const real = r() < 0.5;
    const pool = real ? game.evidence : game.imagined;
    return {real, text: pool[Math.floor(r() * pool.length)], blurry: c.blurEvery > 0 && (i + 1) % c.blurEvery === 0};
  });
}
/** 쌓기(true)·빼기(false)가 맞는지 */
export const judge = (real: boolean, build: boolean) => (real === build ? 'right' : build ? 'wrongBuild' : 'wrongSkip');

export const mountTower: GameMount = env => {
  const game = env.game as unknown as TowerGame;
  const c = STAGES[env.stage];
  const deck = cards(env.stage, game);
  const sharp = canRead(env.power);
  let i = 0, mistakes = 0;
  const tower = el('div', {class: 'tw-tower'});
  const card = el('div', {class: 'tw-card', 'data-testid': 'tower-card'});
  const build = button(`A · ${game.build}`, () => choose(true), {class: 'ms-btn primary', 'data-testid': 'tower-build'});
  const skip = button(`B · ${game.skip}`, () => choose(false), {class: 'ms-btn', 'data-testid': 'tower-skip'});
  env.area.append(tower, el('div', {class: 'tw-right'}, card, el('div', {class: 'ms-actions'}, build, skip)));
  const left = el('strong', {}, hearts(c.lives, c.lives));
  const prog = el('strong', {}, `0 / ${c.n}`);
  const msg = el('p', {class: 'gm-flash'});
  env.side.append(el('p', {class: 'gm-count'}, `${GL.progress} `, prog), el('p', {class: 'gm-count'}, `${GL.left} `, left), msg);

  const show = () => {
    const d = deck[i];
    const blur = d.blurry && !sharp;
    card.replaceChildren();
    add(card,
      el('p', {class: 'tw-floor'}, `${i + 1}${GL.floor}`),
      el('p', {class: 'tw-text' + (blur ? ' blur' : ''), 'data-blur': blur}, d.text),
      d.blurry ? el('p', {class: 'tw-note'}, blur ? game.blurry : `🔍 ${GL.powerOn}`) : null);
    env.stageEl.dataset.card = String(i);
  };
  const choose = (b: boolean) => {
    if (i >= deck.length) return;
    const d = deck[i];
    const r = judge(d.real, b);
    tower.append(el('span', {class: 'tw-layer' + (b ? ' built' : ' skipped') + (r === 'right' ? '' : ' wrong')}, b ? '' : '✕'));
    if (r === 'right') { msg.className = 'gm-flash found'; msg.textContent = game.right; }
    else { mistakes += 1; msg.className = 'gm-flash'; msg.textContent = game[r]; left.textContent = hearts(c.lives - mistakes, c.lives); }
    i += 1;
    prog.textContent = `${i} / ${c.n}`;
    if (mistakes >= c.lives) { env.end(null); return; }
    if (i >= deck.length) { env.end(medalByMistakes(mistakes, 0, 1)); return; }
    show();
  };
  env.onKey(e => {
    const k = e.key.toLowerCase();
    if (e.repeat) return;
    if (k === 'a' || k === 'arrowleft') choose(true);
    if (k === 'b' || k === 'arrowright') choose(false);
  });
  show();
  return () => {};
};
