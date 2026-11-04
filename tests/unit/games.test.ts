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

// ── 단계와 도구 ──
import * as C from '../../src/games/climate';
import * as P from '../../src/games/peel';
import * as Tt from '../../src/games/tetris';
import * as Ca from '../../src/games/catch';
import * as Ph from '../../src/games/photo';
import {seeded} from '../../src/games/env';
import {needMet, needHint, sourcesOf, stageOpen, gameOf, type Power, type StageNo} from '../../src/games/data';

const power = (items: string[] = [], lv: Partial<Record<string, number>> = {}): Power => ({has: id => items.includes(id), lv: r => lv[r] ?? 1});

describe('단계와 필요한 도구', () => {
  it('모든 게임은 3단계이고, 3단계에 필요한 도구·능력치는 얻을 곳이 있다', () => {
    for (const g of gamesData.games) {
      expect(g.stages, g.id).toHaveLength(3);
      const need = g.stages[2].need!;
      expect(need, g.id).toBeTruthy();
      for (const id of need.items ?? []) expect(sourcesOf(id).length, `${g.id}:${id}`).toBeGreaterThan(0);
      expect(needHint(need).where.length, g.id).toBeGreaterThan(0);
    }
  });
  it('앞 단계 메달이 있어야 다음 단계가 열린다', () => {
    expect(stageOpen({}, 'rust', 1)).toBe(true);
    expect(stageOpen({}, 'rust', 2)).toBe(false);
    expect(stageOpen({rust: {1: 'bronze'}}, 'rust', 2)).toBe(true);
    expect(stageOpen({rust: {1: 'bronze'}}, 'rust', 3)).toBe(false);
  });
  it('도구 중 하나를 장착하거나 능력치 레벨이 넉넉하면 조건을 채운다', () => {
    expect(needMet({items: ['loupe', 'microscope']}, power(['microscope']))).toBe(true);
    expect(needMet({items: ['loupe', 'microscope']}, power(['tags']))).toBe(false);
    expect(needMet({stat: {role: 'material', level: 3}}, power([], {material: 2}))).toBe(false);
    expect(needMet({stat: {role: 'material', level: 3}}, power([], {material: 3}))).toBe(true);
  });
});

describe('안전 운반 2·3단계', () => {
  const route = (cfg: T.TransportCfg, limit: number) => {
    let s = T.newTransport();
    for (const p of ROUTE) {
      for (let i = 0; i < 4000 && !s.done && Math.hypot(p.x - s.x, p.y - s.y) > 12; i++) {
        const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
        s = T.step(s, Math.hypot(s.vx, s.vy) < limit ? {x: dx / d, y: dy / d} : {x: 0, y: 0}, 1 / 60, cfg);
      }
    }
    return s;
  };
  it('3단계는 완충재 없이는 아무리 천천히 가도 실패하고, 완충재를 장착하면 금메달도 받을 수 있다', () => {
    const best = 0.5;
    expect(route(T.cfgFor(3, best, power([], {material: 9})), 50).done).toBe('lose');
    const s = route(T.cfgFor(3, best, power(['cushion'])), 50);
    expect(s.done).toBe('win');
    expect(T.medalFor(s.shake, T.cfgFor(3, best, power(['cushion'])))).toBe('gold');
  });
  it('2단계는 도구 없이 천천히 가면 깰 수 있다', () => {
    expect(route(T.cfgFor(2, 0.5, power()), 60).done).toBe('win');
  });
});

describe('돋보기 녹 찾기 2·3단계', () => {
  it('단계마다 녹 수와 시간이 다르고, 3단계 맨눈 렌즈는 작고 흐리다', () => {
    expect(R.totalOf(R.STAGES[2].spots)).toBe(9);
    expect(R.totalOf(R.STAGES[3].spots)).toBe(10);
    expect(R.STAGES[3].time).toBe(40);
    expect(R.lensFor(R.STAGES[3], power())).toMatchObject({clear: false});
    expect(R.lensFor(R.STAGES[3], power(['loupe'])).r).toBeGreaterThan(R.lensFor(R.STAGES[3], power()).r);
    expect(R.lensFor(R.STAGES[3], power(['microscope'])).zoom).toBeGreaterThan(R.lensFor(R.STAGES[3], power(['loupe'])).zoom);
  });
  it('녹 자리는 서로 겹치지 않고 그림 안에 있다', () => {
    for (const st of [2, 3] as StageNo[]) {
      const spots = R.STAGES[st].spots;
      for (const [i, a] of spots.entries()) {
        expect(a.x).toBeGreaterThan(0); expect(a.x).toBeLessThan(R.W); expect(a.y).toBeGreaterThan(0); expect(a.y).toBeLessThan(R.H);
        for (const b of spots.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(100);
      }
    }
  });
});

describe('전시실 습도 지키기', () => {
  /** 사람처럼 늦게(react초) 보고, 벗어나는 쪽 반대 기계를 켠다 */
  const bot = (stage: StageNo, lv: number, react = 0.6) => {
    let s = C.newClimate();
    const plan = C.schedule(stage);
    const hist: [number, number][] = [];
    const lag = Math.round(react * 60);
    while (!s.done) {
      hist.push(s.x);
      const seen = hist[Math.max(0, hist.length - 1 - lag)];
      const input = seen.map(v => (v > 51.5 ? -1 : v < 48.5 ? 1 : 0)) as [number, number];
      s = C.tick(s, input, 1 / 60, stage, lv, plan);
    }
    return s;
  };
  it('1·2단계는 레벨 1로도 지킬 수 있다', () => {
    expect(bot(1, 1).done).toBe('win');
    expect(bot(2, 1).done).toBe('win');
  });
  it('3단계는 재료 감각 레벨 3이 안 되면 실패하고, 3이면 지킬 수 있다', () => {
    expect(bot(3, 1).done).toBe('lose');
    expect(bot(3, 2).done).toBe('lose');
    expect(bot(3, 3).done).toBe('win');
    expect(gameOf('climate')!.stages[2].need).toEqual({stat: {role: 'material', level: 3}});
  });
  it('기계는 가운데를 넘어가지 않는다', () => {
    let s = C.newClimate();
    s = C.tick(s, [1, -1], 0.5, 1, 9, []);
    expect(s.x).toEqual([50, 50]);
  });
});

describe('살살 떼기', () => {
  /** 떼기 칸에 바늘이 머무는 시간(ms) */
  const window = (c: P.PeelCfg) => (c.pressZone / c.speed) * 1000;
  it('3단계 맨손은 칸에 머무는 시간이 너무 짧고, 주걱·바람 기계가 있으면 넉넉해진다', () => {
    expect(window(P.cfgFor(3, power()))).toBeLessThan(40);
    expect(window(P.cfgFor(3, power(['spatula'])))).toBeGreaterThan(100);
    expect(window(P.cfgFor(3, power(['warmer'])))).toBeGreaterThan(100);
    // 1단계부터 칸이 좁다(0.1초쯤)
    expect(window(P.cfgFor(1, power()))).toBeGreaterThan(80);
    expect(window(P.cfgFor(1, power()))).toBeLessThan(150);
  });
  it('온도와 바늘 자리로 판정한다', () => {
    const c = P.cfgFor(1, power());
    const [lo, hi] = P.zoneOf(c.heatZone);
    expect(P.judgeHeat((lo + hi) / 2, c)).toBe('ok');
    expect(P.judgeHeat(hi + 1, c)).toBe('tooHot');
    expect(P.judgeHeat(lo - 1, c)).toBe('tooCold');
    expect(P.judgePress(99, c)).toBe('tooHard');
    expect(P.judgePress(1, c)).toBe('tooSoft');
    expect(P.needleAt(0.5, 100)).toBe(50);
    expect(P.needleAt(1.5, 100)).toBe(50);
  });
});

describe('유물 조각 테트리스', () => {
  it('일곱 조각은 네 칸이고, 네 번 돌리면 제자리다', () => {
    for (let k = 1; k <= 7; k++) {
      expect(Tt.shape(k, 0)).toHaveLength(4);
      expect(Tt.shape(k, 4)).toEqual(Tt.shape(k, 0));
    }
  });
  it('한 줄을 채우면 지워지고, 목표 줄 수를 채우면 이긴다', () => {
    let s = Tt.newTetris(1);
    // 맨 아래 줄을 I 조각 자리만 남기고 채운다
    s.grid[Tt.ROWS - 1] = [8, 8, 8, 8, 8, 8, 0, 0, 0, 0];
    s = {...s, k: 1, r: 0, x: 6, y: 0};
    s = Tt.hardDrop(s, 1);
    expect(s.lines).toBe(1);
    expect(s.done).toBe('win');
    expect(s.grid[Tt.ROWS - 1].every(v => v === 0)).toBe(true);
  });
  it('벽 밖으로는 못 가고, 꼭대기까지 쌓이면 진다', () => {
    let s = Tt.newTetris(1);
    for (let i = 0; i < 20; i++) s = Tt.move(s, -1);
    expect(Tt.collide(s.grid, s.k, s.r, s.x - 1, s.y)).toBe(true);
    for (let i = 0; i < 60 && !s.done; i++) s = Tt.hardDrop(s, 99);
    expect(s.done).toBe('lose');
  });
  it('3단계는 아래에 깨진 줄 6개가 있고, 되돌리기 솜씨가 높을수록 천천히 떨어진다', () => {
    expect(Tt.newTetris(3).grid.filter(r => r.some(v => v === 8))).toHaveLength(6);
    expect(Tt.intervalFor(3, power([], {undo: 3}))).toBeGreaterThan(Tt.intervalFor(3, power([], {undo: 1})) * 2);
    expect(Tt.intervalFor(3, power())).toBeLessThan(150);
    expect(gameOf('tetris')!.stages[2].need).toEqual({stat: {role: 'undo', level: 3}});
  });
});

describe('하늘에서 떨어지는 유물 조각', () => {
  const play = (stage: StageNo, aim: (p: Ca.Piece) => boolean) => {
    const cfg = Ca.STAGES[stage];
    const rnd = seeded(700 + stage);
    let s = Ca.newCatch();
    while (!s.done) {
      // 바구니 아래로 내려오는 조각 중 받고 싶은 것 아래로, 받기 싫은 것은 피한다
      const want = s.pieces.filter(aim).sort((a, b) => b.y - a.y)[0];
      const avoid = s.pieces.filter(p => !aim(p) && p.y > Ca.BASKET_Y - 160).map(p => p.x);
      let x = want ? want.x : s.basket;
      if (avoid.some(a => Math.abs(a - x) < Ca.BASKET_W)) x = x < Ca.W / 2 ? x + 300 : x - 300;
      s = Ca.tick(s, 1 / 60, cfg, x, rnd);
    }
    return s;
  };
  it('꽃병 조각만 골라 받으면 완성하고, 아무거나 받으면 기회가 줄어든다', () => {
    const good = play(1, p => p.kind === 'good');
    expect(good.done).toBe('win');
    const any = play(2, () => true);
    expect(any.done).toBe('lose');
  });
  it('3단계는 맨눈으로 무늬가 거의 안 보이고, 돋보기·현미경이면 보인다', () => {
    expect(Ca.sight(Ca.STAGES[3], power())).toBe(0);
    expect(Ca.sight(Ca.STAGES[3], power(['loupe']))).toBe(1);
    expect(Ca.sight(Ca.STAGES[3], power(['microscope']))).toBe(2);
    expect(Ca.STAGES[3].kinds).toEqual(['other']);
  });
});

describe('번호 붙여 사진 찍기', () => {
  it('단계마다 조각 수·기억 시간이 다르고, 3단계는 같은 색 조각이다', () => {
    expect(Ph.pieces(1)).toHaveLength(4);
    expect(Ph.pieces(3)).toHaveLength(10);
    expect(new Set(Ph.pieces(3).map(p => p.color)).size).toBe(1);
    expect(Ph.STAGES[3].memo).toBe(1);
    expect(Ph.TAG_TIME).toBeGreaterThan(0);
    expect(Ph.fits(2, 2)).toBe(true);
    expect(Ph.toolsOf(power(['camera']))).toEqual({tags: false, camera: true});
  });
});
