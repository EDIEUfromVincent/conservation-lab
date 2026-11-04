import {test, expect, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {open} from './helpers';
import {SPOTS, W, H} from '../../src/games/rust';

async function fresh(page: Page, query: string) {
  await open(page, query);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

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

test('훈련장: 두 게임이 나오고, 사건 목록에서 갈 수 있다', async ({page}) => {
  await fresh(page, '?mode=mission');
  await page.getByTestId('to-games').click();
  await expect(page.locator('.gm-card')).toHaveCount(2);
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
  await expect(page.getByTestId('depart')).toBeEnabled();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.gm-canvas')).toBeVisible();
  await driveTo(page, 'ArrowRight', x => x >= 470);
  await driveTo(page, 'ArrowDown', (_, y) => y >= 590);
  await driveTo(page, 'ArrowRight', x => x >= 1110);
  await driveTo(page, 'ArrowUp', (_, y) => y <= 170);
  await driveTo(page, 'ArrowRight', x => x > 1450);
  await expect(page.getByTestId('game-result')).toBeVisible();
  await expect(page.getByTestId('game-result')).not.toHaveAttribute('data-medal', 'none');
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
    for (const q of ['?mode=games', '?mode=games&game=transport', '?mode=games&game=rust']) {
      await fresh(page, q);
      const out = await page.evaluate(() => {
        const st = document.querySelector('#stage')!.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>('.ms-card, .gm-card, .gm-canvas, .gm-side')].filter(e => {
          const b = e.getBoundingClientRect();
          return e.scrollHeight > e.clientHeight + 2 || b.bottom > st.bottom + 1 || b.right > st.right + 1 || b.left < st.left - 1;
        }).map(e => e.className);
      });
      expect(out, q).toEqual([]);
    }
  });
}
