import {expect, type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {scenario} from '../../src/content/loadContent';
import {L} from '../../src/ui/labels';

export const base = process.env.E2E_BASE_URL ?? 'file://' + resolve('dist/index.html');
export async function open(page: Page, query = '') {
  await page.goto(base + query);
  await expect(page.locator('#app')).not.toBeEmpty();
}
export async function snapshotState(page: Page) {
  return page.locator('#stage').evaluate(el => ({...(el as HTMLElement).dataset}));
}
export const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('cons-lab:current')!));

export interface PlayOptions {
  profile?: '80' | '120';
  actualLabs?: boolean;
  retry?: boolean;
  stop?: string;
  seen?: Set<string>;
  allDecisions?: boolean;
  screens?: Set<string>;
}

/** 지금 화면에서 한 걸음 진행한다. 끝(WRAPUP 또는 stop)에 닿으면 false. */
export async function step(page: Page, pattern: string[], opts: PlayOptions = {}, memo = {didRetry: false}): Promise<boolean> {
  const s = await snapshotState(page);
  opts.screens?.add(s.screen!);
  if (s.phase === opts.stop || s.phase === 'WRAPUP') return false;
  if (await page.locator('dialog').count()) {
    await page.keyboard.press('Enter');
    return true;
  }
  if (s.phase === 'SETUP') {
    if (opts.profile === '80') {
      await page.getByTestId('profile-80').focus();
      await page.keyboard.press('Space');
    }
    if (opts.allDecisions) await page.getByLabel(L.optional).uncheck();
  }
  if (s.phase === 'TEAM_SETUP') await chooseTeamHeritage(page);
  if (s.kind === 'predict') {
    const c = scenario.cases.find(c => c.id === s.case)!;
    await page.keyboard.press('1');
    const length = c.lab!.predict.type === 'rank' ? c.lab!.predict.options!.length : 1;
    for (let k = 0; k < length; k++) await page.keyboard.press(String.fromCharCode(65 + k));
    await page.keyboard.press('Enter');
    return true;
  }
  if (s.kind === 'lab') {
    if (opts.actualLabs) await completeLab(page, s.case!);
    else {
      await page.keyboard.press('PageDown');
      await page.keyboard.press('B');
      await page.keyboard.press('Enter');
    }
    await page.keyboard.press('PageDown');
    return true;
  }
  if (s.kind === 'decision' && s.sub === 'vote') {
    const keys = await page.locator('.choices button').allTextContents();
    for (let team = 1; team <= 4; team++) {
      const preferred = s.attempt === '2' ? 'B' : pattern[team - 1];
      const key = keys.some(x => x.startsWith(preferred + ' ')) ? preferred : 'B';
      await page.keyboard.press(String(team));
      await page.keyboard.press(key);
    }
    await page.keyboard.press('Enter');
    if (await page.locator('dialog').count()) {
      await page.keyboard.press('A');
      await page.keyboard.press('Enter');
    }
    return true;
  }
  if (s.sub === 'outcome') {
    for (const id of await page.locator('[data-node]').evaluateAll(nodes => nodes.map(x => x.getAttribute('data-node')!))) opts.seen?.add(id);
  }
  if (s.sub === 'retryOffer' && opts.retry && !memo.didRetry) {
    await page.getByTestId('retry').focus();
    await page.keyboard.press('Enter');
    memo.didRetry = true;
    return true;
  }
  if (s.phase === 'JOURNAL') await sortJournal(page);
  if (s.phase === 'ALGORITHM' && s.subscreen === '0') await nameSteps(page);
  if (s.phase === 'REQUEST') await pickRequest(page);
  if (s.phase === 'BUILD') await buildProgram(page);
  if (s.phase === 'TEST') await page.keyboard.press('A');
  if (s.phase === 'DEBUG') await page.getByTestId('retest').click();
  if (s.phase === 'AI_CHECK' && s.subscreen !== '1') {
    for (let t = 1; t <= 4; t++) {
      await page.keyboard.press(String(t));
      await page.keyboard.press(s.subscreen === '0' ? 'A' : 'B');
    }
  }
  await page.keyboard.press('PageDown');
  return true;
}

/** 하루 전체를 키보드(클리커)와 교사 입력만으로 진행한다. */
export async function play(page: Page, pattern: string[], opts: PlayOptions = {}) {
  const memo = {didRetry: false};
  for (let i = 0; i < 400; i++) if (!(await step(page, pattern, opts, memo))) return;
  throw Error('Lesson did not finish');
}

export async function chooseTeamHeritage(page: Page) {
  const names = scenario.heritagePick.examples.map(x => x.name);
  for (let t = 1; t <= 4; t++) await page.getByLabel(`${t}${L.team} ${L.teamHeritage}`).selectOption(names[t % 2]);
}

/** 카드 11장을 세 묶음으로 나눈다(교사가 학생 발언을 받아 적는 흐름) */
export async function sortJournal(page: Page) {
  for (let i = 0; i < 3; i++) await page.getByTestId('add-cluster').click();
  const ids = await page.locator('.clusters [data-cluster]').evaluateAll(n => n.map(x => x.getAttribute('data-cluster')!));
  for (let n = 0; ; n++) {
    const card = page.getByTestId('unsorted').locator('[data-card]').first();
    if (!(await card.count())) break;
    await card.click();
    await page.getByTestId(`move-${ids[n % ids.length]}`).click();
  }
  await expect(page.getByTestId('unsorted').locator('[data-card]')).toHaveCount(0);
}

export async function nameSteps(page: Page) {
  const names = ['살피고 기록하기', '진짜 까닭 찾기', '다시 뗄 수 있게'];
  const inputs = page.getByLabel(new RegExp(`^${L.stepName} \\d$`));
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    await inputs.nth(i).fill(names[i] ?? `단계 ${i + 1}`);
    await inputs.nth(i).press('Tab');
  }
}

export async function pickRequest(page: Page) {
  await page.locator('button[data-heritage]').first().click();
  await page.getByLabel(L.riskLabel, {exact: true}).fill('비바람에 돌 틈이 벌어졌어요');
  await page.getByLabel(L.riskLabel, {exact: true}).press('Tab');
}

/** 팀마다 결정 하나: 상황, A(✓ + 단계), B(✕) */
export async function buildProgram(page: Page) {
  for (let t = 1; t <= 4; t++) {
    await page.getByTestId(`tab-p${t}`).click();
    const form = page.locator(`[data-decision=p${t}]`);
    const fill = async (label: string, text: string) => {
      const input = form.getByLabel(label, {exact: true});
      await input.fill(text);
      await input.press('Tab');
    };
    await fill(`${t}${L.team} ${L.situation}`, `${t}팀 상황: 무엇부터 할까요?`);
    await fill(`${t}${L.team} A ${L.action}`, '사진을 찍고 상태를 기록한다');
    await form.getByRole('group', {name: `A ${L.resultLabels}`}).locator('[data-result=solved]').click();
    await form.getByLabel(`A ${L.step}`).selectOption({index: 1});
    await fill(`${t}${L.team} B ${L.action}`, '시멘트로 단단히 메운다');
    await form.getByRole('group', {name: `B ${L.resultLabels}`}).locator('[data-result=irreversible]').click();
  }
}

export async function completeLab(page: Page, caseId: string) {
  if (caseId === 'case1') {
    await page.getByRole('button', {name: L.day3, exact: true}).click();
    await page.getByRole('button', {name: L.measure, exact: true}).click();
  }
  if (caseId === 'case2') {
    await page.getByRole('button', {name: L.shuffle, exact: true}).click();
    await page.getByRole('button', {name: L.nextRound, exact: true}).click();
    const number = page.getByRole('button', {name: L.number, exact: true});
    if (await number.isEnabled()) await number.click();
    await page.getByRole('button', {name: L.photo, exact: true}).click();
    await page.getByRole('button', {name: L.shuffle, exact: true}).click();
    const total = await page.getByLabel(L.target, {exact: true}).locator('option').count();
    for (let i = 0; i < total; i++) {
      await page.getByLabel(L.piece, {exact: true}).selectOption(String(i));
      await page.getByLabel(L.target, {exact: true}).selectOption(String(i));
      await page.getByRole('button', {name: L.place, exact: true}).click();
    }
    await page.getByRole('button', {name: L.measure, exact: true}).click();
  }
  if (caseId === 'case3') {
    const stroke = page.getByRole('button', {name: L.stroke, exact: true});
    for (let i = 0; i < 60 && await stroke.isEnabled(); i++) await stroke.click();
    await page.getByRole('button', {name: L.measure, exact: true}).click();
  }
  if (caseId === 'case4') {
    const samples = await page.getByLabel(L.choose, {exact: true}).locator('option').evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value));
    for (const id of samples) {
      await page.getByLabel(L.choose, {exact: true}).selectOption(id);
      await page.getByRole('button', {name: L.dry, exact: true}).click();
      await page.getByRole('button', {name: L.test, exact: true}).click();
      await page.getByRole('button', {name: L.reveal, exact: true}).click();
    }
    await page.getByRole('button', {name: L.measure, exact: true}).click();
  }
  if (caseId === 'case5') {
    const reinforce = page.getByRole('button', {name: L.reinforce, exact: true});
    if (await reinforce.count()) {
      await page.getByLabel(L.choose, {exact: true}).selectOption('concrete');
      await reinforce.click();
      await page.getByRole('button', {name: L.century, exact: true}).click();
      const remove = page.getByRole('button', {name: L.remove, exact: true});
      for (let i = 0; i < 12 && await remove.isEnabled(); i++) await remove.click();
    } else {
      for (let i = 1; i <= 7; i++) await page.getByRole('button', {name: `${i}${L.floor} · ${i <= 6 ? L.evidence : L.imagined}`, exact: true}).click();
      await expect(page.locator('.floor.dashed')).toContainText(L.imagined);
    }
    await page.getByRole('button', {name: L.measure, exact: true}).click();
  }
  await expect(page.getByText(L.completed, {exact: true})).toBeVisible();
}
