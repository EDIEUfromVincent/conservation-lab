# 계획 점검 — 완료 기준 vs 설계 문서 (Claude, 2026-11-03)

점검 대상: `docs/IMPLEMENTATION_PLAN.md`의 §4.3·§5·§9·§10 완료 기준을 `CLAUDE.md` DoD, `docs/02~06·08·10`, `data/*.json`과 대조. Codex의 Phase 1 골격(`package.json`, `vite.config.ts`, `src/content/rules.ts`, `src/ui/labels.ts`, `playwright.config.ts`)도 확인했다. 이 문서는 **계획을 넓히지 않고**, 실제로 양립하지 않거나 막다른 길이 생길 수 있는 지점에 대한 구현자용 해석만 적는다. 이 문서의 해석은 `IMPLEMENTATION_PLAN.md`보다 우선한다.

## 판정 요약
- 필수 기능 누락: **없음**. CLAUDE.md DoD 6항목이 모두 계획 §9~§11에 대응한다.
- 양립하지 않는 기준: **7건**(R01~R07). 모두 해석으로 해결되며 새 기능을 요구하지 않는다.
- 보강 해석: **4건**(R08~R11). 문서가 침묵한 곳을 작게 고정한다.
- Codex Phase 1 산출물과 계획의 충돌: 없음. `vite.config.ts`의 CSP·포트 미고정, scripts, 의존성 모두 계획과 일치.

## A. 양립하지 않는 기준과 해석

| # | 충돌 | 해석(구현자가 적용) |
|---|---|---|
| R01 | CLAUDE.md DoD "클리커만으로 처음부터 끝까지" vs docs/05 §9 "한 팀도 투표 안 하고 확정 → 확정 불가", 계획 §4.3 "예측 안 잠그면 토스트" | 입력 단계(예측·투표·동점)는 본질적으로 키보드나 마우스가 필요하다(docs/03 §7도 인정). 단, **하드 블록 금지**. 입력 0건에서 Enter/다음을 누르면 토스트 대신 **모달**을 띄운다. 투표: [입력으로 돌아가기(기본)] [교사가 대신 고르기 A/B/C → `decidedBy:"teacher"`, 모든 팀은 '미입력'(감점·배지 없음)]. 예측: [입력으로 돌아가기(기본)] [예측 없이 실습으로 → `skipped` 로그, 예측 비교 표시 생략]. 모달 안에서 A/B/C 키로 선택, Enter 확정. 이렇게 하면 어떤 단계에서도 진행 불가 상태가 없다 |
| R02 | 계획 §4.3 재선택·동점 모달의 기본 버튼이 정의되지 않아 클리커(PageDown=다음)로 멈출 수 있음 | 모든 모달은 **기본 버튼 하나**를 갖고 Enter·Space·PageDown이 그것을 실행한다. 재선택 모달 기본 = [그대로 진행]. 동점 모달은 기본 버튼 없음이지만 동점 선택지만 A/B/C 키로 고르고 Enter로 확정(선택 전 Enter는 무시). 이어하기 모달 기본 = [이어하기]. 새로 시작·초기화의 2차 확인은 기본 = [취소] |
| R03 | docs/03 §10 "실습 렌더 오류 → 증거 카드 버튼" vs 계획 §7은 '다음' 눌렀을 때의 모달만 정의 | `labHost`가 `mount/start`를 try/catch로 감싼다. 예외가 나면 **자동으로** `fallbackEvidence` 카드를 그 자리에 그리고 `labSkipped=true`, `error` 로그를 남긴다. 교사 조작 없이 다음으로 넘어갈 수 있어야 한다. 실습 중 `report()` 전에 '다음'을 누른 경우의 모달(계획 §4.3)은 그대로 |
| R04 | 80분 프로필: 2차시에 파일을 다시 열면 S00 → 이어하기인데, 계획 §5.6 타이머가 1차시 `phaseStartedAt` 기준이라 즉시 '초과(빨강)'로 보임. 손상된 저장 데이터의 처리도 미정 | 이어하기 시 `phaseStartedAt = now`, `timerOffsetSec = 0`으로 재설정하고 `phase_enter` 로그에 `note:"resumed"`. 복원 위치는 저장된 그대로(BREAK 화면이면 BREAK, 다음 → 사건 3). 저장 데이터가 JSON 파싱·구조 검사에 실패하면 '저장 없음'으로 취급해 S00을 보이고, 교사 패널에 "이전 기록을 읽지 못했어요"만 표시한다(수업은 계속) |
| R05 | 80분 프로필 퀴즈 2문항(docs/02 §1.2, docs/08 "앞의 2문항") vs 계획 §6 M02 `&n=2`를 **누가 붙이는지** 미정 | S04의 QR 내용은 `${manualBaseUrl}?mode=manual&expert=<id>` + (프로필이 80이면) `&n=2`. manual 모드는 `n`이 없으면 3, 있으면 `quiz.slice(0, n)`(앞의 n문항). print 모드 P01은 항상 3문항 전부를 인쇄한다(교사가 2문항만 쓰라고 안내) |
| R06 | 계획 §9.2 E2E 5 "`page.route("**/*")`로 모든 요청 차단" — 기본 대상이 `file://`라서 페이지 자체 로드도 차단됨 | `page.on("request")`로 모든 요청 URL을 수집해 **`file:`·`data:`·`blob:` 외 스킴이 0건**임을 단언한다. 덧붙여 `page.route(/^https?:\/\//, r => r.abort())`로 혹시 모를 외부 요청을 끊는다. `context.setOffline(true)`는 쓰지 않는다(file 로드 동작이 브라우저마다 다름). 기본 URL은 `process.env.E2E_BASE_URL ?? "file://" + path.resolve("dist/index.html")`, 쿼리는 그 뒤에 `?mode=…` |
| R07 | 계획 §9.2 E2E 8 "print PDF 페이지 수 ≤ 8" vs 접착 매뉴얼(도구 8·단서 4·원리 4·사건 5·연습 3·퀴즈 3)은 A4 1쪽을 넘을 수 있음(docs/08 "한 쪽 분량"은 목표) | 게이트는 **"매뉴얼 4종·학습지 4종이 각각 새 쪽에서 시작(`break-before: page`)하고 전체 ≤ 12쪽"**. 1쪽/매뉴얼은 목표이며 넘치면 교사 패널 문구 없이 2쪽 허용. print 출력에는 `teacher` 필드와 퀴즈 `answer/why`를 넣지 않는다. 퀴즈 정답은 **S04 교사 패널**에 표시한다(종이 퀴즈 채점용). 새 모드 옵션은 추가하지 않는다 |

## B. 보강 해석(문서가 침묵한 곳)

| # | 지점 | 해석 |
|---|---|---|
| R08 | docs/04 S13 와이어프레임 "예측 vs 결과: 1팀 ✓ 2팀 ✗" — ✗가 결과 기호 ✕(되돌릴 수 없음)과 겹치고, 계획 §7 "틀린 팀 강조 안 함"과 어긋남 | 예측 비교는 글자 **"맞음 / 다름 / 미입력"**만 중립 색으로 표시. ✓·✕ 기호는 결과 배지에만 쓴다 |
| R09 | 연습 사건(`scored:false`)에서 무엇을 끄는지 | 건강도·원칙 카드·근거 배지·`classPath` 집계(매트릭스) 모두 제외. 결과 배지와 '다른 길 보기'는 그대로 보여 조작을 익힌다. 상단 바 건강도 자리에는 `labels.ts` 문구 "연습 · 점수 없음" |
| R10 | 계획 §9.2 E2E 2 "모든 선택지 결과 노드가 한 번 이상 표시" 범위 | 집계 집합 = `tutorial` + `cases[]`의 `type:"outcome"` 노드 전부(현재 35개). 120분·`skipOptional=false`로 돌린다. 재선택 경로는 2회차에서 1회차와 **다른** 선택을 한 번, 재선택 거절을 한 번 포함. 80분 실행(E2E 3)은 선택적 결정 결과를 덮지 않아도 된다 |
| R11 | 계획 §5.3 no-network 테스트의 문자열 검사가 `rules.ts`의 URL 정규식(`^https?:\/\/`)이나 라벨에 걸릴 수 있음 | 검사 대상은 `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `importScripts`, `<link`/`src=`/`href=` 뒤의 `http`. 정규식 리터럴 안의 `https?:`는 제외. `tools/check-hardcoded-text.mjs`의 한글 허용 경로는 `src/ui/labels.ts`, `tests/**`, `assets/**`, `docs/**` |

## C. 집중 점검 항목별 확인 결과

| 항목 | 결과 |
|---|---|
| 교실 진행 중 막다른 길 | 데이터: V05(결정마다 solved ≥1)·V19(고아 노드 없음) 통과, 세 역사 합류 노드 모두 flow에 있음. 엔진: ✕ 뒤 진행, 알 수 없는 노드 → wrap, 실습 예외 → 증거 카드(R03), 입력 0건 → 모달(R01), 모달 기본 버튼(R02). **남는 막다른 길 없음** |
| offline file:// 실행 | CSP(`connect-src 'none'`, `media-src file:`)는 Codex `vite.config.ts`에 계획대로 주입됨. 인라인 모듈 스크립트·data: 이미지·blob: 다운로드·localStorage 모두 file://에서 동작. E2E 5는 R06으로 교정. 로컬 영상 재생은 계획 Q10대로 Phase 7에서 실측 |
| 80분/120분 | 프로필 분 합계 일치, 80분은 `skipOptional`·`quickLabs`·사건 2 뒤 BREAK. 이어하기 타이머(R04), 퀴즈 2문항 전달 경로(R05) 보강. 80분에서 사건 2는 c2d2 하나만 남지만 V15 통과 |
| 모든 선택 결과 | 결정 12개(연습 1 + 본 11), 결과 노드 35개, 선택지 2개짜리는 c3d3 하나(계획 C19로 C 키 무시). 집계 범위는 R10 |
| 매뉴얼·인쇄 | `manuals.json` 4종 모두 퀴즈 3·answer 범위·calledIn/callouts 대응 통과. manual 모드는 교사 세션 저장소와 독립. print는 R07(쪽 나눔, 정답·교사 노트 제외). QR은 http(s) 공유 주소일 때만 의미가 있고, 비어 있으면 "인쇄 매뉴얼을 나눠 주세요"(계획 C06) |

## D. Codex Phase 1 산출물 메모(충돌 아님)
- `playwright.config.ts`에 기본 URL이 아직 없다. R06의 `E2E_BASE_URL ?? file://…` 규칙을 `tests/e2e/helpers.ts`에 넣으면 된다.
- `labels.ts`의 `latest`(숭례문 현황 안내)는 교사 패널 전용 문구로만 쓴다(학생 화면 금지, CLAUDE.md 규칙 11과 같은 취지).
- `check-build.mjs`가 단일 파일·5MB·CSP를 검사한다. 계획 §11 게이트와 일치.
