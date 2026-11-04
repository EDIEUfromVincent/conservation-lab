import {test, expect, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {open} from './helpers';
import {SPOTS, W, H} from '../../src/games/rust';

async function fresh(page: Page, query: string, store: Record<string, unknown> = {}) {
  await open(page, query);
  await page.evaluate(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); }, store);
  await page.reload();
}
const hero = (items: string[], equipped: Record<string, string>, xp: Record<string, number> = {}) =>
  ({version: 1, xp: {record: 0, analyze: 0, material: 0, undo: 0, ...xp}, items, equipped, talked: [], mentorDone: true});
const ds = async (page: Page, key: string) => page.locator('#stage').getAttribute(`data-${key}`);

/** 방향키를 누른 채 수레가 목표 좌표에 닿을 때까지(천천히: 짧게 끊어 누른다) */
async function driveTo(page: Page, key: string, done: (x: number, y: number) => boolean) {
  for (let i = 0; i < 400; i++) {
    const [x, y] = ((await page.locator('#stage').getAttribute('data-pos')) ?? '0,0').split(',').map(Number);
    if (done(x, y)) return;
    await page.keyboard.down(key);
    await page.waitForTimeout(90);
    await page.keyboard.up(key);
    await page.waitForTimeout(110);
    if (await page.getByTestId('game-result').count()) return;
  }
}

test('훈련장: 일곱 게임이 3단계씩 나오고, 1단계만 열려 있다', async ({page}) => {
  await fresh(page, '?mode=mission');
  await page.getByTestId('to-games').click();
  await expect(page.locator('.gm-card')).toHaveCount(7);
  await expect(page.locator('a.gm-stage')).toHaveCount(7);
  await expect(page.locator('.gm-stage.locked')).toHaveCount(14);
});

test('안전 운반: 완충재를 고르고 천천히 가면 메달을 받는다, 오류·외부 요청 없음', async ({page}) => {
  test.setTimeout(180000);
  mkdirSync('output/playwright', {recursive: true});
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await fresh(page, '?mode=games&game=transport');
  await page.keyboard.press('B');
  await expect(page.getByTestId('start-game')).toBeEnabled();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.gm-canvas')).toBeVisible();
  await driveTo(page, 'ArrowRight', x => x >= 470);
  await driveTo(page, 'ArrowDown', (_, y) => y >= 590);
  await driveTo(page, 'ArrowRight', x => x >= 1110);
  await driveTo(page, 'ArrowUp', (_, y) => y <= 170);
  await driveTo(page, 'ArrowRight', x => x > 1450);
  await expect(page.getByTestId('game-result')).toBeVisible();
  await expect(page.getByTestId('game-result')).not.toHaveAttribute('data-medal', 'none');
  await expect(page.getByTestId('next-stage')).toBeVisible();
  await page.screenshot({path: 'output/playwright/game-transport-result.png'});
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('돋보기 녹 찾기: 붉은 녹만 모두 찾으면 메달, 초록 녹은 실수로 센다', async ({page}) => {
  await fresh(page, '?mode=games&game=rust');
  await page.keyboard.press('PageDown');
  await expect(page.locator('.gm-canvas')).toBeVisible();
  const box = (await page.locator('.gm-canvas').boundingBox())!;
  // 그림 좌표 → 화면 좌표(테두리 5px 안쪽)
  const at = (x: number, y: number) => [box.x + 5 + (x / W) * (box.width - 10), box.y + 5 + (y / H) * (box.height - 10)] as const;
  const green = SPOTS.find(s => s.kind === 'green')!;
  await page.mouse.click(...at(green.x, green.y));
  await expect(page.locator('.gm-flash.green')).toBeVisible();
  for (const s of SPOTS.filter(s => s.kind === 'rust')) await page.mouse.click(...at(s.x, s.y));
  await expect(page.getByTestId('game-result')).toHaveAttribute('data-medal', 'gold');
  await page.screenshot({path: 'output/playwright/game-rust-result.png'});
});

for (const size of [{width: 1920, height: 1080}, {width: 1280, height: 720}]) {
  test(`미니게임 ${size.width}×${size.height}: 카드·그림이 무대 밖으로 나가지 않는다`, async ({page}) => {
    await page.setViewportSize(size);
    const all = {'cons-lab:games': Object.fromEntries(['transport', 'rust', 'photo', 'climate', 'peel', 'tetris', 'catch'].map(id => [id, {1: 'gold', 2: 'gold'}]))};
    const qs = ['?mode=games', ...['transport', 'rust', 'photo', 'climate', 'peel', 'tetris', 'catch'].map(id => `?mode=games&game=${id}&stage=3`)];
    for (const q of qs) {
      await fresh(page, q, all);
      const out = await page.evaluate(() => {
        const st = document.querySelector('#stage')!.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>('.ms-card, .gm-card, .gm-area, .gm-side')].filter(e => {
          const b = e.getBoundingClientRect();
          return e.scrollHeight > e.clientHeight + 2 || b.bottom > st.bottom + 1 || b.right > st.right + 1 || b.left < st.left - 1;
        }).map(e => e.className);
      });
      expect(out, q).toEqual([]);
      // 놀이 화면도
      if (q.includes('game=')) {
        if (q.includes('transport')) await page.keyboard.press('B');
        await page.keyboard.press('PageDown');
        await expect(page.getByTestId('game-area')).toBeVisible();
        const bad = await page.evaluate(() => {
          const st = document.querySelector('#stage')!.getBoundingClientRect();
          const area = document.querySelector('.gm-area')!.getBoundingClientRect();
          const inArea = [...document.querySelectorAll<HTMLElement>('.gm-area > *, .gm-area button')].filter(e => {
            const b = e.getBoundingClientRect();
            return b.bottom > area.bottom + 1 || b.right > area.right + 1 || b.top < area.top - 1;
          }).map(e => e.className);
          const side = [...document.querySelectorAll<HTMLElement>('.gm-side')].filter(e => e.getBoundingClientRect().bottom > st.bottom + 1).map(e => e.className);
          return [...inArea, ...side];
        });
        expect(bad, q + ' play').toEqual([]);
        await page.screenshot({path: `output/playwright/game-${q.split('game=')[1].split('&')[0]}-s3-${size.width}.png`});
      }
    }
  });
}

test('3단계: 필요한 도구가 없으면 경고와 얻을 곳을 보여 주고, 장착하면 도구의 힘이 나온다', async ({page}) => {
  const medals = {'cons-lab:games': {rust: {1: 'gold', 2: 'gold'}, climate: {1: 'gold', 2: 'gold'}}};
  await fresh(page, '?mode=games&game=rust&stage=3', medals);
  await expect(page.getByTestId('need-warning')).toContainText('돋보기');
  await expect(page.getByTestId('need-warning')).toContainText('거북이');
  await fresh(page, '?mode=games&game=climate&stage=3', medals);
  await expect(page.getByTestId('need-warning')).toContainText('재료 감각');
  await fresh(page, '?mode=games&game=rust&stage=3', {...medals, 'cons-lab:hero': hero(['loupe'], {analyze: 'loupe'})});
  await expect(page.getByTestId('need-warning')).toHaveCount(0);
  await expect(page.getByTestId('power-on')).toContainText('돋보기');
  // 잠긴 단계는 훈련장으로 돌아간다
  await fresh(page, '?mode=games&game=catch&stage=3');
  await expect(page.locator('.gm-card')).toHaveCount(7);
});

test('3단계 실패 카드에도 도구를 얻을 곳을 다시 알려 준다', async ({page}) => {
  test.setTimeout(60000);
  await fresh(page, '?mode=games&game=catch&stage=3', {'cons-lab:games': {catch: {1: 'gold', 2: 'gold'}}});
  await page.keyboard.press('PageDown');
  // 바구니를 가만히 두면 떨어지는 조각을 아무거나 받는다 → 다른 조각 3개면 실패
  await expect(page.getByTestId('game-result')).toBeVisible({timeout: 50000});
  if ((await page.getByTestId('game-result').getAttribute('data-medal')) === 'none') await expect(page.getByTestId('game-result').getByTestId('need-warning')).toBeVisible();
  const fit = await page.getByTestId('game-result').evaluate(e => e.scrollHeight <= e.clientHeight + 2 && e.getBoundingClientRect().bottom <= document.getElementById('stage')!.getBoundingClientRect().bottom + 1);
  expect(fit).toBe(true);
});

test('번호 붙여 사진 찍기: 번호표는 기억하는 동안만 보이고, 기억한 자리에 놓으면 메달', async ({page}) => {
  await fresh(page, '?mode=games&game=photo', {'cons-lab:hero': hero(['tags', 'camera'], {record: 'tags'})});
  await page.keyboard.press('PageDown');
  await expect(page.locator('.ph-slot .ph-tag')).toHaveCount(4);
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'place', {timeout: 12000});
  await expect(page.locator('.ph-tag')).toHaveCount(0);
  for (let i = 0; i < 4; i++) {
    await page.locator(`.ph-piece[data-piece="${i}"]`).click();
    await page.locator(`.ph-slot[data-slot="${i}"]`).click();
  }
  await expect(page.getByTestId('game-result')).toHaveAttribute('data-medal', 'gold');
  await page.screenshot({path: 'output/playwright/game-photo-result.png'});
});

test('번호 붙여 사진 찍기: 모두 놓은 뒤에야 맞는지 알려 주고, 틀린 조각만 돌아온다', async ({page}) => {
  await fresh(page, '?mode=games&game=photo');
  await page.keyboard.press('PageDown');
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'place', {timeout: 8000});
  const put = async (piece: number, slot: number) => { await page.locator(`.ph-piece[data-piece="${piece}"]`).click(); await page.locator(`.ph-slot[data-slot="${slot}"]`).click(); };
  await put(0, 0); await put(1, 2); await put(2, 1);
  await expect(page.locator('.ph-mark')).toHaveCount(0);           // 아직 다 놓지 않았으면 말하지 않는다
  await put(3, 3);
  await expect(page.locator('.ph-slot.wrong')).toHaveCount(2);
  await expect(page.locator('.ph-slot.right')).toHaveCount(2);
  await expect(page.locator('.ph-piece')).toHaveCount(2, {timeout: 4000});   // 틀린 두 조각이 돌아온다
  await put(1, 1); await put(2, 2);
  await expect(page.getByTestId('game-result')).toHaveAttribute('data-medal', 'silver');
});

test('번호 붙여 사진 찍기: 사진기를 장착하면 처음 모습을 다시 볼 수 있다', async ({page}) => {
  await fresh(page, '?mode=games&game=photo', {'cons-lab:hero': hero(['camera'], {record: 'camera'})});
  await page.keyboard.press('PageDown');
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'place', {timeout: 8000});
  await page.getByTestId('peek').click();
  await expect(page.locator('.ph-slot.ghost')).toHaveCount(4);
  await expect(page.locator('.ph-tag')).toHaveCount(0);
});

test('유물 조각 테트리스: 조각이 떨어져 쌓이고, 키로 옮기고 돌린다', async ({page}) => {
  await fresh(page, '?mode=games&game=tetris');
  await page.keyboard.press('PageDown');
  await expect(page.locator('.tt-board')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  for (let i = 0; i < 3; i++) await page.keyboard.press(' ');
  await expect(page.locator('#stage')).toHaveAttribute('data-filled', '12');
});

test('하늘에서 떨어지는 유물 조각: 바구니가 움직이고 조각을 받는다', async ({page}) => {
  test.setTimeout(60000);
  await fresh(page, '?mode=games&game=catch');
  await page.keyboard.press('PageDown');
  await expect(page.locator('#stage')).toHaveAttribute('data-basket', '800');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowLeft');
  expect(Number(await ds(page, 'basket'))).toBeLessThan(700);
  await page.waitForFunction(() => Number(document.getElementById('stage')!.dataset.got ?? 0) + Number(document.getElementById('stage')!.dataset.bad ?? 0) > 0 || !!document.querySelector('[data-testid=game-result]'), null, {timeout: 50000});
});

test('살살 떼기: 초록 칸에서 데우기를 멈추고, 바늘이 초록 칸일 때 떼면 메달', async ({page}) => {
  test.setTimeout(60000);
  await fresh(page, '?mode=games&game=peel');
  await page.keyboard.press('PageDown');
  for (let blob = 0; blob < 3; blob++) {
    await page.keyboard.down(' ');
    await page.waitForFunction(() => Number(document.getElementById('stage')!.dataset.heat) >= 59, null, {polling: 'raf'});
    await page.keyboard.up(' ');
    await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'press');
    await page.waitForFunction(() => { const n = Number(document.getElementById('stage')!.dataset.needle); return n > 59 && n < 65; }, null, {polling: 'raf'});
    await page.keyboard.press(' ');
    if (blob < 2) await expect(page.locator('#stage')).toHaveAttribute('data-blob', String(blob + 1));
  }
  await expect(page.getByTestId('game-result')).not.toHaveAttribute('data-medal', 'none', {timeout: 5000});
});

test('전시실 습도 지키기: 기계 버튼과 키로 바늘이 움직이고 시간이 흐른다', async ({page}) => {
  await fresh(page, '?mode=games&game=climate');
  await page.keyboard.press('PageDown');
  await expect(page.locator('.cl-gauge')).toHaveCount(2);
  await page.waitForTimeout(2500);
  await expect(page.locator('.cl-banner')).not.toBeEmpty();
  expect(Number(await ds(page, 'out'))).toBeGreaterThanOrEqual(0);
});

test('다시하기: 이번 게임 메달만 지우거나, 처음부터 모든 기록을 지운다', async ({page}) => {
  const store = {'cons-lab:games': {rust: {1: 'gold', 2: 'gold'}, photo: {1: 'silver'}}, 'cons-lab:hero': hero(['loupe'], {analyze: 'loupe'}, {analyze: 100})};
  await fresh(page, '?mode=games&game=rust&stage=2', store);
  // 이번 활동: 녹 찾기 메달만 지워지고 1단계로 돌아간다(잠긴 단계는 훈련장으로)
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('reset-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('reset-modal')).toHaveCount(0);
  await page.getByTestId('reset').click();
  await page.keyboard.press('1');
  await expect(page.locator('.gm-card')).toHaveCount(7);
  const games = await page.evaluate(() => JSON.parse(localStorage.getItem('cons-lab:games')!));
  expect(games).toEqual({photo: {1: 'silver'}});
  expect(await page.evaluate(() => localStorage.getItem('cons-lab:hero'))).not.toBeNull();
  // 처음부터: 확인 한 번 더 → 모든 기록을 지우고 갈래길로
  await page.getByTestId('reset').click();
  await page.getByTestId('reset-all').click();
  await page.getByTestId('reset-no').click();
  await expect(page.getByTestId('reset-activity')).toBeVisible();
  await page.getByTestId('reset-all').click();
  await page.getByTestId('reset-yes').click();
  await expect(page).toHaveURL(/mode=roles/);
  const left = await page.evaluate(() => ({games: localStorage.getItem('cons-lab:games'), hero: JSON.parse(localStorage.getItem('cons-lab:hero') ?? 'null')}));
  expect(left.games).toBeNull();
  expect(left.hero?.items ?? []).toEqual([]);
});
