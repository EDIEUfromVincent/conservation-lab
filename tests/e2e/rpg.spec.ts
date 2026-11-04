import {test, expect, type Page} from '@playwright/test';
import {open} from './helpers';
import {roles} from '../../src/roles/engine';
import {rpg} from '../../src/rpg/hero';

const hero = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('cons-lab:hero') ?? 'null'));
const dialogAt = (page: Page) => page.locator('#stage').getAttribute('data-dialog');

/** 대화를 끝까지: 말은 Space로 넘기고, 물음에서는 picks 순서대로 숫자를 누른다 */
async function talkThrough(page: Page, picks: string[]) {
  for (let i = 0; i < 40 && (await dialogAt(page)); i++) {
    if (await page.locator('.rpg-choice').count()) await page.keyboard.press(picks.shift() ?? '1');
    else await page.keyboard.press('Space');
    await page.waitForTimeout(60);
  }
}

test('스승님: 갈래길에 처음 들어서면 말을 걸고, 1·2로 고르며 넘어간다', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page, '?mode=roles');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.rpg-dialog')).toBeVisible();
  await expect(page.locator('.rpg-name')).toHaveText(rpg.mentor.name);
  await expect(page.locator('#stage')).toHaveClass(/talking/);
  // m1 → m2 → m3(물음): '네, 알려 주세요' → … → m8(물음): '네, 출발할래요!'
  for (let i = 0; i < 8 && (await dialogAt(page)) !== 'm3'; i++) await page.keyboard.press('Space');
  await expect(page.locator('.rpg-choice')).toHaveCount(2);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.rpg-choice.on')).toHaveAttribute('data-choice', '2');
  await page.keyboard.press('1');
  await expect.poll(() => dialogAt(page)).toBe('m4');
  await talkThrough(page, ['1']);
  await expect(page.locator('.rpg-dialog')).toHaveCount(0);
  expect((await hero(page)).mentorDone).toBe(true);
  // 대화 중에 눌린 키는 뒤 화면을 움직이지 않았다
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'map');
  // 다시 들어와도 스승님은 먼저 말을 걸지 않는다
  await page.reload();
  await page.waitForTimeout(1200);
  await expect(page.locator('.rpg-dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('변신하면 그 역할 경험치와 첫 도구를 받고, 가방에서 장착을 본다', async ({page}) => {
  await open(page, '?mode=roles');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cons-lab:hero', JSON.stringify({version: 1, xp: {record: 0, analyze: 0, material: 0, undo: 0}, items: [], equipped: {}, talked: [], mentorDone: true}));
  });
  await page.reload();
  await page.keyboard.press('PageDown');
  const r = roles[0];
  await page.keyboard.press('1');
  await page.keyboard.press('PageDown');
  for (const q of r.quiz) {
    await page.keyboard.press('ABC'[q.answer]);
    await page.keyboard.press('PageDown');
  }
  await expect(page.getByTestId('transform')).toBeVisible();
  await expect(page.getByTestId('got-item')).toContainText(rpg.items.find(i => i.id === rpg.gifts.roleChange.record)!.name);
  const h = await hero(page);
  expect(h.xp.record).toBe(rpg.xp.roleChange);
  expect(h.equipped.record).toBe(rpg.gifts.roleChange.record);
  await page.keyboard.press('PageDown');
  await page.keyboard.press('i');
  await expect(page.getByTestId('bag-panel')).toBeVisible();
  await expect(page.locator(`.rpg-slot.on[data-item="${rpg.gifts.roleChange.record}"]`)).toBeVisible();
  await expect(page.locator('[data-stat="record"] strong')).toHaveText(String(1 + 1));   // 레벨 1 + 번호표 +1
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bag-panel')).toHaveCount(0);
});

test('3D 미션: 단서를 풀면 그 역할 경험치를 얻는다', async ({page}) => {
  await open(page, '?mode=mission&case=case1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.keyboard.press('A');          // 금속 전문가
  await page.keyboard.press('PageDown');   // 조사 시작
  await page.keyboard.press('1');          // 여신상 겉면
  await page.keyboard.press('1');          // 초록 겉면(되돌리기 담당 단서)
  await page.keyboard.press('B');          // 맞는 카드
  await expect(page.getByTestId('fact')).toBeVisible();
  expect((await hero(page)).xp.undo).toBe(rpg.xp.clue);
});

test('3D 미션: 다른 카드를 고르면 연구실장이 다시 볼 곳을 짚어 준다', async ({page}) => {
  await open(page, '?mode=mission&case=case1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.keyboard.press('A');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('1');
  await page.keyboard.press('1');
  await page.keyboard.press('A');          // 다른 카드
  await expect(page.locator('.ms-mentor.warn')).toBeVisible();
});
