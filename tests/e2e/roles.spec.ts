import {test, expect, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {open} from './helpers';
import {roles} from '../../src/roles/engine';

async function fresh(page: Page) {
  await open(page, '?mode=roles');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'intro');
}

/** 화면마다 카드·패널이 무대 안에 있고 안에서 스크롤이 없는지 */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector('#stage')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.ms-card, .ms-side')].filter(e => {
      const b = e.getBoundingClientRect();
      return e.scrollHeight > e.clientHeight + 2 || b.bottom > stage.bottom + 1 || b.top < stage.top - 1 || b.left < stage.left - 1 || b.right > stage.right + 1;
    }).map(e => `${document.querySelector<HTMLElement>('#stage')!.dataset.screen}/${e.className}`);
  });
}

for (const size of [{width: 1920, height: 1080}, {width: 1280, height: 720}]) {
  test(`역할 변신 ${size.width}×${size.height}: 클리커와 A~C로 네 역할 모두 변신, 잘림·오류·외부 요청 없음`, async ({page}) => {
    test.setTimeout(120000);
    mkdirSync('output/playwright', {recursive: true});
    await page.setViewportSize(size);
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
    await fresh(page);
    const bad: string[] = [];
    bad.push(...await overflow(page));
    await page.keyboard.press('PageDown');
    for (const r of roles) {
      await page.keyboard.press('PageDown');
      await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'webtoon');
      await expect(page.locator('.wt-panel')).toHaveCount(4);
      bad.push(...await overflow(page));
      if (size.width === 1920) await page.screenshot({path: `output/playwright/roles-${r.id}-webtoon.png`});
      await page.keyboard.press('PageDown');
      for (const [qi, q] of r.quiz.entries()) {
        if (qi === 0) {
          await page.keyboard.press('ABC'[(q.answer + 1) % q.options.length]);
          await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'quiz');
          await expect(page.getByTestId('quiz-right')).toHaveCount(0);
        }
        await page.keyboard.press('ABC'[q.answer]);
        await expect(page.getByTestId('quiz-right')).toBeVisible();
        bad.push(...await overflow(page));
        await page.keyboard.press('PageDown');
      }
      await expect(page.getByTestId('transform')).toContainText(r.name);
      bad.push(...await overflow(page));
      await page.keyboard.press('PageDown');
    }
    await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'done');
    await expect(page.getByTestId('role-count')).toContainText('4/4');
    await page.keyboard.press('PageDown');
    await expect(page).toHaveURL(/mode=mission/);
    expect([...new Set(bad)]).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('역할 변신: 방향키로 갈래길 문 앞에 가서 E로 들어가고, 새로고침해도 이어진다', async ({page}) => {
  await fresh(page);
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('joystick')).toBeVisible();
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#stage')).toHaveAttribute('data-near', 'analyze', {timeout: 8000});
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('e');
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'analyze');
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'webtoon');
  await page.keyboard.press('Escape');
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'map');
});
