import {test, expect} from '@playwright/test';
import {readFileSync, mkdirSync} from 'node:fs';
import {open, play, step, snapshotState, stored} from './helpers';
import {cases, manuals, scenario} from '../../src/content/loadContent';
import {L} from '../../src/ui/labels';

const SCREENS = ['S00', 'S01', 'S02', 'S03', 'S04', 'S05', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S18', 'S19',
  'S20', 'S21', 'S30', 'S31', 'S32', 'S33', 'S34', 'S24', 'S25'];

test('하루 전체: 모든 결과 노드, 새 화면, 오프라인, 내보내기·복원', async ({page}) => {
  test.setTimeout(300000);
  const seen = new Set<string>();
  const screens = new Set<string>();
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.route(/^https?:\/\//, r => r.abort());
  for (const key of ['A', 'B', 'C']) {
    await open(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await play(page, [key, key, key, key], {retry: key === 'A', seen, screens, allDecisions: true});
    await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S25');
  }
  expect([...seen].sort()).toEqual(cases.flatMap(c => c.nodes.filter(n => n.type === 'outcome').map(n => n.id)).sort());
  for (const id of SCREENS) expect(screens.has(id), id).toBe(true);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);

  const session = await stored(page);
  expect(session.state.journal).toHaveLength(11);
  expect(session.state.clusters.map((c: {name: string}) => c.name)).toEqual(['살피고 기록하기', '진짜 까닭 찾기', '다시 뗄 수 있게']);
  expect(session.state.program.decisions.every((d: {situation: string}) => d.situation)).toBe(true);
  expect(session.state.testRuns).toHaveLength(4);
  expect(session.state.aiCheck.trust[1]).toEqual({before: 'trust', after: 'unsure'});

  const csvWait = page.waitForEvent('download');
  await page.getByRole('button', {name: 'CSV', exact: true}).click();
  const csv = readFileSync((await (await csvWait).path())!, 'utf8');
  expect(csv).toContain('﻿t,elapsed_s,phase,case_id,node_id,event');
  for (const event of ['journal_card', 'cluster_move', 'program_edit', 'program_test', 'program_retest', 'ai_trust']) expect(csv).toContain(event);
  const wait = page.waitForEvent('download');
  await page.getByRole('button', {name: 'JSON', exact: true}).click();
  const path = (await (await wait).path())!;
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  expect(saved.state.phase).toBe('WRAPUP');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('input[type=file]').setInputFiles(path);
  await page.getByRole('dialog').getByRole('button', {name: L.import, exact: true}).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S25');
  expect((await stored(page)).state).toEqual(saved.state);
});

test('학생 화면에는 S21 비교 전까지 원칙 이름이 나오지 않는다', async ({page}) => {
  test.setTimeout(180000);
  await open(page);
  const leaks: string[] = [];
  const principleText = scenario.principles.flatMap(p => [p.label, p.kid]);
  const memo = {didRetry: false};
  for (let i = 0; i < 300; i++) {
    const s = await snapshotState(page);
    if (s.phase === 'ALGORITHM' && s.subscreen === '1') break;
    const text = await page.locator('#stage').evaluate(el => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelector('.panel')?.remove();
      return clone.innerText;
    });
    if (/\bP[1-5]\b/.test(text) || principleText.some(p => text.includes(p))) leaks.push(`${s.screen} ${s.case ?? ''}`);
    await step(page, ['B', 'B', 'B', 'B'], {}, memo);
  }
  expect(leaks).toEqual([]);
  await expect(page.locator('.journal-principle').first()).toBeVisible();
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

test('시작 화면에는 설정 없이 수업 시작과 사건 파일 1~5만 있다', async ({page}) => {
  await open(page);
  await expect(page.locator('#stage input[type=checkbox]')).toHaveCount(0);
  await expect(page.getByTestId('mission-cases').locator('a')).toHaveCount(5);
  await page.locator('[data-case="case3"]').click();
  await expect(page).toHaveURL(/mode=mission&case=case3/);
});

test('S03 의뢰 후보 카드에 사건 그림을 쓰지 않고, 손든 수를 센다', async ({page}) => {
  await open(page);
  // 시작 → 출근 → 영상 → 의뢰 고르기
  for (let i = 0; i < 3; i++) await page.keyboard.press('PageDown');
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S03');
  await expect(page.locator('.heritage svg')).toHaveCount(0);
  const first = scenario.heritagePick.examples[0];
  await page.getByRole('button', {name: `${first.name} +1`}).click();
  await page.getByRole('button', {name: `${first.name} +1`}).click();
  await expect(page.locator(`[data-heritage="${first.name}"]`)).toContainText(`2${L.personUnit}`);
  await page.getByLabel(L.heritageName).fill('할머니의 놋그릇');
  await page.getByRole('button', {name: L.addHeritage}).click();
  await expect(page.locator('[data-heritage="할머니의 놋그릇"]')).toBeVisible();
});

test('버그가 있으면 디버깅 화면에 보이고, 고친 뒤 다시 실행하면 통과', async ({page}) => {
  test.setTimeout(180000);
  await open(page);
  await play(page, ['B', 'B', 'B', 'B'], {stop: 'BUILD'});
  // 1팀 결정만 일부러 해결 길 없이 둔다(B3, B1)
  const {buildProgram} = await import('./helpers');
  await buildProgram(page);
  const form = page.locator('[data-decision=p1]');
  await page.getByTestId('tab-p1').click();
  await form.getByRole('group', {name: `A ${L.resultLabels}`}).locator('[data-result=solved]').click();
  await page.keyboard.press('PageDown');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('B');
    await page.keyboard.press('PageDown');
  }
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S33');
  await expect(page.getByTestId('bug-list').locator('[data-rule=B3]')).toBeVisible();
  await page.getByTestId('bug-list').locator('[data-rule=B3]').getByRole('button', {name: L.fixThis}).click();
  await page.locator('[data-decision=p1]').getByRole('group', {name: `A ${L.resultLabels}`}).locator('[data-result=solved]').click();
  await page.getByTestId('retest').click();
  await expect(page.getByTestId('pass')).toBeVisible();
  expect((await stored(page)).state.program.version).toBe(2);
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

test('잘못된 가져오기·옛 형식은 거부, 붙여 넣은 답은 실행되지 않음, 저장 거부에도 진행', async ({page}) => {
  await open(page);
  const input = page.locator('input[type=file]');
  await input.setInputFiles({name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"state":{"phase":"WRAPUP"}}')});
  await expect(page.getByRole('status')).toContainText(L.importError);
  await input.setInputFiles({name: 'old.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":1,"state":{},"log":[]}')});
  await expect(page.getByRole('status')).toContainText(L.oldVersion);
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S00');
  await page.keyboard.press('T');
  await page.getByLabel(L.modelName, {exact: true}).fill('test model');
  await page.getByLabel(L.date, {exact: true}).fill('2026-11-03');
  await page.getByLabel(L.answer, {exact: true}).fill('<img src=x onerror="window.__bad=true"><script>window.__bad=true</script>');
  await page.getByRole('button', {name: L.save, exact: true}).click();
  await expect(page.locator('img[src=x]')).toHaveCount(0);
  expect(await page.evaluate(() => '__bad' in window)).toBe(false);
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', {get() { throw Error('denied'); }}); });
  await page.reload();
  await page.keyboard.press('PageDown');
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'S01');
  await expect(page.locator('#save-status')).toContainText(L.saveFailed);
});

for (const size of [{width: 1920, height: 1080}, {width: 1366, height: 768}, {width: 1280, height: 720}]) {
  test(`프로젝터 ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await open(page);
    mkdirSync('output/playwright', {recursive: true});
    await page.screenshot({path: `output/playwright/setup-${size.width}.png`});
    expect(await page.locator('#stage').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    for (const node of await page.locator('h1,button,input').all()) {
      expect(await node.evaluate(e => e.scrollWidth <= e.clientWidth + 2), (await node.textContent()) ?? '').toBe(true);
    }
  });
}
