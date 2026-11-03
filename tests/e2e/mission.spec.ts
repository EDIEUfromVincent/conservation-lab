import {test, expect, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {open} from './helpers';
import {missions, missionFor, decisionOf, caseOf} from '../../src/mission/engine';
import {scenario} from '../../src/content/loadContent';
import {ML} from '../../src/mission/labels';
import {L} from '../../src/ui/labels';

const LETTERS = ['A', 'B', 'C', 'D'];
const screen = (page: Page) => page.locator('#stage').getAttribute('data-screen');

async function fresh(page: Page, caseId = 'case1') {
  await open(page, '?mode=mission&case=' + caseId);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'incident');
}

/**
 * 클리커(다음)와 A~D·숫자 키로 미션을 끝까지 진행한다. 실습만 마우스로 한다.
 * wrongFirst면 단서마다 다른 카드를 먼저 골라 본다. 결과 노드 id를 돌려준다.
 */
async function play(page: Page, caseId: string, choice: 'A' | 'B' | 'C', opts: {wrongFirst?: boolean; realLab?: boolean; shots?: string; each?: () => Promise<void>} = {}) {
  const m = missionFor(caseId);
  const outcomes: string[] = [];
  const taken = new Set<string>();
  const shot = async (name: string) => {
    if (!opts.shots || taken.has(name)) return;
    taken.add(name);
    await page.waitForTimeout(500);
    await page.screenshot({path: `output/playwright/mission-${opts.shots}-${name}.png`});
  };
  for (let i = 0; i < 160; i++) {
    await opts.each?.();
    const s = (await screen(page))!;
    if (s === 'complete') break;
    await shot(s);
    if (s === 'incident' && !(await page.locator('.ms-expert.right').count())) {
      const lead = scenario.experts.findIndex(e => e.id === caseOf(caseId).lead);
      if (opts.wrongFirst) {
        await page.keyboard.press(LETTERS[(lead + 1) % 4]);
        await expect(page.getByTestId('expert-feedback')).toBeVisible();
        await shot('incident-wrong');
      }
      await page.keyboard.press(LETTERS[lead]);
      await expect(page.locator('.ms-expert.right')).toHaveCount(1);
      continue;
    }
    if (s === 'clue' && !(await page.getByTestId('fact').count())) {
      const clueId = await page.locator('#stage').getAttribute('data-clue');
      const clue = m.clues.find(c => c.id === clueId)!;
      await expect(page.locator('.ms-turn')).toHaveAttribute('data-role', clue.role);
      if (opts.wrongFirst) {
        const wrong = clue.options.findIndex(o => o !== clue.answer);
        await page.keyboard.press(LETTERS[wrong]);
        await expect(page.locator(`[data-option="${clue.options[wrong]}"]`)).toBeDisabled();
        await shot('clue-wrong');
      }
      await page.keyboard.press(LETTERS[clue.options.indexOf(clue.answer)]);
      await expect(page.getByTestId('fact')).toContainText(clue.fact.slice(0, 8));
      continue;
    }
    if (s === 'lab') {
      if (opts.realLab) {
        await page.getByRole('button', {name: L.day3}).click();
        await page.getByRole('button', {name: L.measure}).click();
        await page.keyboard.press('PageDown');
      } else await page.getByRole('button', {name: ML.labSkip}).click();
      continue;
    }
    if (s === 'decision') {
      const d = decisionOf(caseId, (await page.locator('#stage').getAttribute('data-decision'))!);
      const key = d.choices.some(c => c.key === choice) ? choice : 'A';
      await page.keyboard.press(key);
      await page.keyboard.press('1');
      await expect(page.locator(`[data-choice="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
    }
    if (s === 'outcome') {
      const id = (await page.locator('[data-outcome]').getAttribute('data-outcome'))!;
      if (!outcomes.includes(id)) outcomes.push(id);
    }
    await page.keyboard.press('PageDown');
  }
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'complete');
  await shot('complete');
  return outcomes;
}

for (const {caseId} of missions) {
  test(`3D 미션 ${caseId}: 키보드로 끝까지, 모든 결과, 오프라인, 오류 없음`, async ({page}) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
    const seen = new Set<string>();
    for (const [i, k] of (['A', 'B', 'C'] as const).entries()) {
      await fresh(page, caseId);
      for (const id of await play(page, caseId, k, {wrongFirst: i === 0, realLab: i === 0 && caseId === 'case1'})) seen.add(id);
    }
    const all = missionFor(caseId).decisions.flatMap(g => decisionOf(caseId, g.id).choices.map(c => c.outcome));
    expect([...seen].sort()).toEqual(all.sort());
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('3D 미션: 결정은 단서를 풀기 전까지 잠겨 있고, 새로고침해도 이어진다', async ({page}) => {
  await fresh(page);
  await page.keyboard.press('A');   // 사건 1은 금속 전문가(A)
  await page.keyboard.press('PageDown');
  await page.keyboard.press('5');
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('.ms-toast')).toHaveText(ML.needUnlock);
  await page.keyboard.press('1');
  await page.keyboard.press('1');
  await expect(page.locator('#stage')).toHaveAttribute('data-clue', 'c1-green');
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'clue');
  await page.keyboard.press('B');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-gate="c1d1"]')).toHaveClass(/open/);
});

test('3D 미션: 방향키로 걸어가 E로 들어가고, 조이스틱으로도 걷는다', async ({page}) => {
  await fresh(page);
  await page.keyboard.press('A');
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('joystick')).toBeVisible();
  // 방향키: 위로 걸어 여신상 앞에 서면 들어가기 알림이 뜬다
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#stage')).toHaveAttribute('data-near', 'outside', {timeout: 8000});
  await page.keyboard.up('ArrowUp');
  await expect(page.getByTestId('enter')).toContainText('여신상 겉면');
  await page.keyboard.press('e');
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'place');
  await expect(page.locator('#stage')).toHaveAttribute('data-place', 'outside');
  // 지도로 돌아와 조이스틱을 오른쪽 아래로 끌면 분석실 쪽으로 걸어간다
  await page.keyboard.press('Escape');
  const joy = await page.getByTestId('joystick').boundingBox();
  const cx = joy!.x + joy!.width / 2, cy = joy!.y + joy!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + joy!.width * 0.45, cy + joy!.height * 0.1, {steps: 4});
  await expect(page.locator('#stage')).toHaveAttribute('data-near', /lab|inside/, {timeout: 10000});
  await page.mouse.up();
  await expect(page.locator('.ms-joy-knob')).toHaveAttribute('style', /transform: none|^$/);
});

test('3D 미션: 사건 목록에서 고르고, 끝나면 다음 사건으로 간다', async ({page}) => {
  await open(page, '?mode=mission');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.ms-case')).toHaveCount(5);
  await page.locator('[data-case="case4"]').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'incident');
  await play(page, 'case4', 'B');
  await page.keyboard.press('PageDown');   // 클리커 '다음' = 다음 사건 파일
  await expect(page).toHaveURL(/case=case5/);
  await page.locator('.ms-list').click();
  await expect(page.locator('[data-case="case4"]')).toHaveClass(/done/);
});

test('3D 미션: 3D를 띄울 수 없어도 같은 흐름으로 끝난다', async ({page}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await fresh(page, 'case2');
  await expect(page.locator('.ms-nogl')).toHaveText(ML.noGL);
  await play(page, 'case2', 'B');
});

for (const size of [{width: 1920, height: 1080}, {width: 1280, height: 720}]) {
  test(`3D 미션: ${size.width}×${size.height}에서 다섯 사건 모두 카드가 잘리지 않는다`, async ({page}) => {
    test.setTimeout(240000);
    mkdirSync('output/playwright', {recursive: true});
    await page.setViewportSize(size);
    const overflow: string[] = [];
    // 화면마다 카드·도크·패널이 무대 안에 있고 안에서 스크롤이 생기지 않는지 본다
    const check = async () => {
      const r = await page.evaluate(() => {
        const stage = document.querySelector('#stage') as HTMLElement;
        const box = stage.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>('.ms-card, .ms-dock, .ms-side')].map(e => {
          const b = e.getBoundingClientRect();
          const inside = b.left >= box.left - 1 && b.right <= box.right + 1 && b.top >= box.top - 1 && b.bottom <= box.bottom + 1;
          return {at: `${stage.dataset.screen}/${stage.dataset.clue || stage.dataset.decision || stage.dataset.place}`, inside, scroll: e.scrollHeight > e.clientHeight + 2};
        });
      });
      for (const x of r) if (!x.inside || x.scroll) overflow.push(`${x.at} inside=${x.inside} scroll=${x.scroll}`);
    };
    for (const {caseId} of missions) {
      await fresh(page, caseId);
      await play(page, caseId, 'A', {wrongFirst: true, each: check, shots: size.width === 1920 ? caseId : undefined});
    }
    expect([...new Set(overflow)]).toEqual([]);
  });
}

test('수업 앱 시작 화면의 사건 카드로 3D 미션을 바로 연다', async ({page}) => {
  await open(page);
  await page.locator('[data-testid=mission-cases] [data-case="case1"]').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', /incident|map|place|clue|lab|decision|outcome|history|complete/);
});
