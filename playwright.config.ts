import { defineConfig } from '@playwright/test';
import {existsSync} from 'node:fs';
// 탐험·4D 프레임 E2E는 VITE_EXTRAS=1로 빌드했을 때만 돈다(docs/12 §9).
const extras=process.env.VITE_EXTRAS==='1';
export default defineConfig({testDir:'tests/e2e',testIgnore:extras?[]:['**/immersive.spec.ts'],timeout:120000,fullyParallel:true,workers:2,use:{browserName:'chromium',channel:existsSync('/Applications/Google Chrome.app')?'chrome':undefined,headless:true,viewport:{width:1280,height:720},trace:'retain-on-failure'},reporter:[['list'],['html',{open:'never'}]]});
