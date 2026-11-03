# 실행 및 검증 인계

코딩·의존성·빌드: Codex. 개발·미리보기 서버 실행과 유지: Grok. 현재 서버 주소는 Grok의 `docs/SERVER.md` 및 상태 파일을 따른다. Codex 테스트는 서버를 띄우지 않는다.

```sh
npm run dev -- --host 127.0.0.1
npm run preview -- --host 127.0.0.1 --port 4173
```

Vite 설정에는 포트·호스트·strictPort를 고정하지 않았다. Grok의 기존 프로세스를 재사용하며 다른 서버를 중복 기동하지 않는다.

```sh
npm run typecheck
npm run validate
npm test
npm run build
npm run e2e
node tools/check-hardcoded-text.mjs
```

`npm run build`는 타입·콘텐츠 검증을 먼저 실행한다. 산출물은 `dist/index.html` 하나이며, CSP·단일 파일·5MB 제한도 자동 검사한다. `pretest`도 콘텐츠 검증을 수행한다.

E2E는 기본적으로 `file://…/dist/index.html`을 연다. macOS에 설치된 Google Chrome이 있으면 이를 사용하며, 그 외에는 Playwright Chromium을 사용한다. 별도 서버 자동 실행 설정은 없다. 필요할 때만 `E2E_BASE_URL`로 Grok의 미리보기 주소를 지정한다. 오프라인 검사는 기본 file 모드로 실행한다.

개발 모드에는 HMR을 위해 CSP를 넣지 않는다. 배포 파일에는 `connect-src 'none'`, 외부 프레임·객체 금지, 인라인 스크립트·스타일 허용 정책을 넣는다. 글꼴·SVG·데이터·라이브러리는 모두 번들 내부에 있다.

샌드박스 환경에서 `tsx`의 로컬 IPC 또는 Chrome 실행이 차단되면 승인된 실행 권한으로 같은 검증 명령을 실행해야 한다. npm 의존성을 다시 설치할 필요는 없다.

테스트 증빙: `output/playwright/`(화면 PNG·학습지 PDF), `playwright-report/`(HTML), 실패 시 `test-results/`(추적 파일). 생성물은 Git에서 제외한다.
