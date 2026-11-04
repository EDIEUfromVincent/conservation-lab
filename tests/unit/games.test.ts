import {describe, it, expect} from 'vitest';
import * as T from '../../src/games/transport';
import * as R from '../../src/games/rust';
import {gamesData} from '../../src/games/data';

/** 수레를 목표 좌표 쪽으로 천천히(최고 속력 limit) 몬다 */
function drive(s: T.TransportState, to: {x: number; y: number}, limit: number, pack: number) {
  for (let i = 0; i < 2000 && !s.done && Math.hypot(to.x - s.x, to.y - s.y) > 12; i++) {
    const dx = to.x - s.x, dy = to.y - s.y, d = Math.hypot(dx, dy);
    const v = Math.hypot(s.vx, s.vy);
    s = T.step(s, v < limit ? {x: dx / d, y: dy / d} : {x: 0, y: 0}, 1 / 60, pack);
  }
  return s;
}
const ROUTE = [{x: 480, y: 160}, {x: 480, y: 600}, {x: 1120, y: 600}, {x: 1120, y: 160}, {x: 1500, y: 160}];

describe('안전 운반', () => {
  it('천천히 가면 금메달로 도착한다', () => {
    let s = T.newTransport();
    for (const p of ROUTE) s = drive(s, p, 100, 0.5);
    expect(s.done).toBe('win');
    expect(T.medalFor(s.shake)).toBe('gold');
  });
  it('빨리 달리면 빈 상자는 실패하고, 완충재로 감싸면 같은 속력에도 도착한다', () => {
    const fast = (pack: number) => { let s = T.newTransport(); for (const p of ROUTE) s = drive(s, p, 340, pack); return s; };
    expect(fast(1.6).done).toBe('lose');
    expect(fast(0.5).done).toBe('win');
  });
  it('벽에 거듭 세게 부딪히면 실패한다(벽에 기대 서 있기만 하면 괜찮다)', () => {
    let s = T.newTransport();
    for (let i = 0; i < 60; i++) s = T.step(s, {x: 0, y: -1}, 1 / 60, 1.6);
    const afterFirstBump = s.shake;
    for (let i = 0; i < 300; i++) s = T.step(s, {x: 0, y: -1}, 1 / 60, 1.6);
    expect(s.shake).toBe(afterFirstBump);
    for (let round = 0; round < 20 && !s.done; round++) {
      for (let i = 0; i < 25 && !s.done; i++) s = T.step(s, {x: -1, y: 0}, 1 / 60, 1.6);
      for (let i = 0; i < 40 && !s.done; i++) s = T.step(s, {x: 1, y: 0}, 1 / 60, 1.6);
    }
    expect(s.done).toBe('lose');
  });
  it('포장 보기 중 완충재가 가장 덜 흔들린다', () => {
    const t = gamesData.games.find(g => g.id === 'transport') as unknown as {packs: {shake: number; best?: boolean}[]};
    const best = t.packs.find(p => p.best)!;
    expect(Math.min(...t.packs.map(p => p.shake))).toBe(best.shake);
  });
});

describe('돋보기 녹 찾기', () => {
  it('붉은 녹만 세고, 초록 녹·빈 곳은 실수로 센다', () => {
    let s = R.newRust();
    const green = R.SPOTS.find(p => p.kind === 'green')!;
    s = R.mark(s, green.x, green.y);
    expect(s).toMatchObject({mistakes: 1, lastMsg: 'green'});
    s = R.mark(s, 5, 5);
    expect(s).toMatchObject({mistakes: 2, lastMsg: 'miss'});
    for (const p of R.SPOTS.filter(p => p.kind === 'rust')) s = R.mark(s, p.x + 4, p.y - 4);
    expect(R.isDone(s)).toBe(true);
    expect(R.medalFor(s.mistakes)).toBe('silver');
  });
});
