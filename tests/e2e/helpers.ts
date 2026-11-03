import {expect, type Page} from '@playwright/test';
import {resolve} from 'node:path';

export const base = process.env.E2E_BASE_URL ?? 'file://' + resolve('dist/index.html');
export async function open(page: Page, query = '') {
  await page.goto(base + query);
  await expect(page.locator('#app')).not.toBeEmpty();
}
