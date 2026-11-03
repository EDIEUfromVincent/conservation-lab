import {test, expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {open} from './helpers';
import {manuals, scenario} from '../../src/content/loadContent';
import {L} from '../../src/ui/labels';

test('순서: 시작 → ① 아침 영상 → ② 영상 4편 → ③ 전문가 4분야 → ④ 역할 변신, 클리커만으로, 오프라인', async ({page}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await open(page);
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S00');
  await expect(page.locator('#stage input[type=checkbox]')).toHaveCount(0);
  await page.keyboard.press('PageDown');
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S01');
  await expect(page.locator('.video-box')).toBeVisible();   // dist에는 영상 파일이 없어 안내가 대신 나온다(classroom/에는 있다)
  await expect(page.locator('main')).not.toContainText('자막 없이');
  await page.keyboard.press('PageDown');
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S02');
  await expect(page.locator('.clip-card')).toHaveCount(4);
  await page.keyboard.press('PageDown');
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S03');
  await expect(page.locator('.expert-card')).toHaveCount(4);
  await page.keyboard.press('PageDown');
  await expect(page).toHaveURL(/mode=roles/);
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'intro');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('② 영상 카드와 번호 키는 그 유튜브 영상을 새 탭으로 연다', async ({page}) => {
  // 실제로 열지 않고 열려던 주소만 모은다
  await page.addInitScript(() => {
    (window as unknown as {opened: string[]}).opened = [];
    window.open = ((url: string) => { (window as unknown as {opened: string[]}).opened.push(url); return null; }) as typeof window.open;
  });
  await open(page);
  for (let i = 0; i < 2; i++) await page.keyboard.press('PageDown');
  await page.locator('[data-clip="1"]').click();
  for (const n of ['2', '3', '4']) await page.keyboard.press(n);
  expect(await page.evaluate(() => (window as unknown as {opened: string[]}).opened)).toEqual(scenario.clips.items.map(x => x.url));
});

test('③ 전문가 4분야: 번호로 크게 펼치고 Esc로 닫는다', async ({page}) => {
  await open(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('PageDown');
  await page.keyboard.press('2');
  const sheet = page.locator('.expert-detail');
  await expect(sheet).toContainText(manuals.manuals[1].label);
  await expect(sheet.locator('tbody tr')).toHaveCount(manuals.manuals[1].clues.length);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('시작 화면의 사건 파일 1~5 카드가 각 3D 미션을 연다', async ({page}) => {
  await open(page);
  await expect(page.getByTestId('mission-cases').locator('a')).toHaveCount(5);
  await page.locator('[data-case="case3"]').click();
  await expect(page).toHaveURL(/mode=mission&case=case3/);
});

test('아침 메모는 새로고침해도 남고, 저장이 막혀도 화면은 계속된다', async ({page}) => {
  await open(page);
  await page.evaluate(() => localStorage.clear());
  await page.keyboard.press('PageDown');
  const memo = page.getByLabel(scenario.video.watchFor[0]);
  await memo.fill('돋보기로 먼저 살펴봐요');
  await memo.blur();
  await page.reload();
  await page.keyboard.press('PageDown');
  await expect(page.getByLabel(scenario.video.watchFor[0])).toHaveValue('돋보기로 먼저 살펴봐요');
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  await page.reload();
  await page.keyboard.press('PageDown');
  await page.getByLabel(scenario.video.watchFor[1]).fill('조명');
  await page.getByLabel(scenario.video.watchFor[1]).blur();
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S01');
});

test('누른 버튼은 눌린 모양으로 바뀐다(aria-pressed="true")', async ({page}) => {
  await open(page, '?mode=manual&expert=metal');
  const options = page.locator('[data-quiz="0"] .quiz-options button');
  await options.nth(0).click();
  await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'false');
  const look = (n: number) => options.nth(n).evaluate(e => getComputedStyle(e).backgroundColor);
  expect(await look(0)).not.toEqual(await look(1));
});

for (const expert of manuals.manuals) {
  test(`매뉴얼 ${expert.id}: 퀴즈와 휴대폰 화면`, async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await open(page, `?mode=manual&expert=${expert.id}`);
    for (const [i, q] of expert.quiz.entries()) await page.locator(`[data-quiz="${i}"]`).getByRole('button', {name: q.options[q.answer], exact: true}).click();
    await expect(page.getByTestId('certificate')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('인쇄: 매뉴얼 4 + W1~W5, 교사 노트와 퀴즈 해설은 없다', async ({page}) => {
  await open(page, '?mode=print');
  await expect(page.locator('.sheet')).toHaveCount(9);
  const text = await page.locator('body').innerText();
  expect(text).not.toContain(scenario.cases[0].teacher!.notes![0]);
  expect(text).not.toContain(manuals.manuals[0].quiz[0].why);
  expect(text).toContain(L.worksheet[2]);
  mkdirSync('output/playwright', {recursive: true});
  await page.pdf({path: 'output/playwright/worksheets.pdf', format: 'A4', printBackground: true});
});

for (const size of [{width: 1920, height: 1080}, {width: 1366, height: 768}, {width: 1280, height: 720}]) {
  test(`프로젝터 ${size.width}×${size.height}: 네 화면 모두 잘리지 않는다`, async ({page}) => {
    await page.setViewportSize(size);
    await open(page);
    for (const id of ['S00', 'S01', 'S02', 'S03']) {
      await expect(page.locator('#stage')).toHaveAttribute('data-screen', id);
      expect(await page.locator('main').evaluate(e => e.scrollHeight <= e.clientHeight + 2)).toBe(true);
      const clipped = await page.locator('.expert-card').evaluateAll(cards => cards.filter(c => c.scrollHeight > c.clientHeight + 2).length);
      expect(clipped).toBe(0);
      if (id !== 'S03') await page.keyboard.press('PageDown');
    }
  });
}
