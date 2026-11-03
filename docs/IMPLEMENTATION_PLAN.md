# 구현 계획 — 보존과학자의 하루 (교사용 오프라인 단일 HTML 웹앱)

작성: 2026-11-03 · 작성 역할: Claude(계획) · 구현 역할: Codex(코딩) · 서버 역할: Grok(로컬 개발·정적 미리보기 서버)
대상 독자: **Codex**. 이 문서만 읽고도 구현을 시작할 수 있도록 설계 문서(docs/01~11)와 데이터(data/*.json)의 요구를 실행 단위로 풀어 썼다. 문서끼리 어긋나는 부분은 §3에서 확정했다. 확정하지 못한 것은 §12 미결 사항에 기본값과 함께 적었다.

---

## 0. 역할 분담과 작업 규칙

| 역할 | 담당 | 하는 일 | 하지 않는 일 |
|---|---|---|---|
| 계획 | Claude | 이 계획서, 단계별 검증 기준, 미결 사항 정리, 요청 시 학생 문구(kid-reader)·역사 사실(fact-checker) 검토 | 소스 코드·package.json 작성 |
| 코딩 | Codex | `package.json`, `src/`, `tests/`, `tools/`, `assets/` 작성, 단위·E2E 테스트, 빌드 | 런타임 외부 요청 추가, AI API 호출 코드, 학생 문구 하드코딩 |
| 서버 | Grok | `npm run dev`(개발 서버)와 `npm run preview`(dist 정적 미리보기) 실행·유지, 포트·URL·콘솔 오류 보고 | 백엔드·API·DB. 이 앱에는 서버 로직이 없다 |

### 0.1 Codex 작업 규칙(CLAUDE.md 절대 규칙의 실행 버전)
1. **콘텐츠 단일 출처**: 학생에게 보이는 모든 문구는 `data/scenario.json`·`data/manuals.json`에서 읽는다. 코드에는 UI 골격 라벨(버튼 "다음", "확정" 등)만 둔다. 그 라벨도 `src/ui/labels.ts` 한 파일에 모은다.
2. **데이터 수정**: `data/*.json`을 고칠 때는 `npm run validate`가 통과해야 하고, 커밋 메시지에 `[content]` 접두사와 바뀐 JSON 경로를 적는다(Claude가 kid-reader·fact-checker로 검토한다). 학생 문구를 새로 쓰는 일은 최소화한다.
3. **오프라인**: 런타임 `fetch/XMLHttpRequest/WebSocket/<link href=http…>/<img src=http…>` 금지. 모든 에셋은 import로 번들에 인라인한다. 영상 링크 하나만 `window.open(url, "_blank", "noopener")`.
4. **대화상자**: `alert/confirm/prompt` 금지. `src/ui/components/Modal.ts`만 쓴다.
5. **localStorage**: `src/core/persistence.ts`의 `safeGet/safeSet/safeRemove`(try/catch)만 통해 접근한다.
6. **개인정보**: 학생 이름 입력란을 만들지 않는다. 팀 이름 칸은 기본값 "1팀~4팀"이며 교사 패널 안내문에 "학생 이름을 넣지 마세요"를 표시한다.
7. **용어**: 코드 라벨에도 '문화재'·'정답'·'오답'·'틀렸다'를 쓰지 않는다(검증기 V18이 `labels.ts`도 검사하도록 확장한다).
8. **커밋**: Phase(또는 실습) 단위로 커밋한다. 첫 커밋 전에 `.gitignore`(node_modules, dist, test-results, playwright-report)를 만든다.
9. **모르는 것**: 추측하지 말고 §12 표에 행을 추가하고 기본값으로 진행한 뒤 보고한다.

### 0.2 Grok 서버 규칙(상세는 `docs/SERVER.md`, Grok이 관리)
- 개발: Grok이 `npm run dev -- --host 127.0.0.1`로 띄운다. **포트 5173은 이 머신의 다른 앱이 점유 중**이므로 `vite.config`·scripts에 `server.port`/`strictPort`/`server.host`를 고정하지 않는다. Vite가 고른 실제 포트는 Grok이 `docs/SERVER.md`에 적는다. HMR용 WebSocket이 필요하므로 **개발 모드에서는 CSP 메타를 넣지 않는다**(§5.3).
- 미리보기: `dist/index.html`이 생기면 Grok이 `npm run preview -- --host 127.0.0.1 --port 4173`로 띄운다. 127.0.0.1 전용, 외부 바인딩 없음.
- 보고 항목: 서버 URL, 시작 실패 로그, 브라우저 콘솔 오류, 요청 로그에 외부 호스트가 있으면 즉시 보고(오프라인 규칙 위반 신호).
- Codex의 E2E는 **`file://` 경로의 `dist/index.html`을 기본 대상**으로 하여 서버를 중복으로 띄우지 않는다. Playwright `webServer` 항목은 두지 않는다(필요하면 `E2E_BASE_URL` 환경변수로 Grok의 미리보기 URL을 지정).
- Codex의 구현 전 분석은 `docs/CODEX_ANALYSIS.md`에 있다. 이 계획과 어긋나면 이 계획이 우선하되, 그 문서의 테스트 우선순위 항목은 §9에 반영했다.

---

## 1. 수업 흐름 요약(구현자가 머리에 넣어야 할 10줄)
1. 교사 1명이 프로젝터 화면(`?mode=teacher`)을 키보드/클리커로 넘긴다. 학생 16명은 4팀, 팀마다 금속·유리·페인트·접착 전문가 1명씩.
2. S00 설정(프로필 120/80분, 옵션) → S01 미션 → S02 영상(새 탭) → S03 지키고 싶은 문화유산(앱 입력 없음) → S04 전문가 모임(QR 4개 → 학생 기기 `?mode=manual&expert=…`) → S05 팀 구성 → S06 연습 사건.
3. 사건 1~5는 `cases[i].flow` 배열대로 진행: 브리핑 → 전문가 호출 → (예측 → 가상 실습) → 결정(팀 투표 A/B/C → 다수결 = 반 경로) → 결과 ✓/△/✕ → (다른 길 보기) → (지연 결과 → 재선택 1회) → (역사 합류 카드) → 실제 역사 → 정리.
4. 점수는 **팀별** 유물 건강도(사건마다 10에서 시작, 그 팀이 고른 선택지의 결과로 감점, 0 하한). 반 경로와 달라도 팀 점수는 팀 선택으로 계산한다.
5. ✕(되돌릴 수 없음)이 나와도 흐름은 계속된다. 막다른 길 없음.
6. 80분 프로필은 선택적 결정 건너뛰기·실습 빠른 모드 기본 ON, 사건 2 뒤 쉬는 시간 화면.
7. 사건 5 뒤 S20 알고리즘 매트릭스(행=사건, 열=원칙 5단계, 칸=결과 기호) → S21 반 알고리즘 도출(교사 타이핑).
8. S22 AI 조수 점검: 사전 캡처된 생성형 AI 답변 텍스트를 5단계 체크리스트로 점검 → 실제 처리 공개. API 호출 없음.
9. S23 전이(학습지 W3 안내) → S24 성찰 → S25 마무리·CSV/JSON 내보내기.
10. 모든 상태 변화는 이벤트 로그를 거치고 localStorage에 자동 저장되어 새로고침 뒤 이어하기가 된다.

---

## 2. 기술 스택과 의존성(확정)

| 항목 | 선택 | 비고 |
|---|---|---|
| 번들러 | Vite (최신 안정) + `vite-plugin-singlefile` | `base: "./"`, `build.assetsInlineLimit: 1e8`, `build.cssCodeSplit: false`, `build.target: "es2020"` |
| 언어 | TypeScript strict, 프레임워크 없음(바닐라 DOM) | `resolveJsonModule: true`, JSON은 `import`로 번들 포함 |
| 런타임 라이브러리 | `d3-delaunay`(실습 2 보로노이), `qrcode-generator`(S04 QR), `seedrandom`(시드 RNG) | 이 셋만. 차트·애니메이션은 직접 SVG/CSS |
| 테스트 | Vitest(단위, node 환경 기본; DOM이 필요한 테스트만 `jsdom`), Playwright(E2E, Chromium), Ajv(`ajv/dist/2020`, draft 2020-12 스키마) | Ajv는 `tools/`에서만 쓴다(브라우저 번들에 넣지 않음) |
| 글꼴 | 시스템 한글 글꼴 스택만 | Pretendard 내장 안 함(용량·라이선스 작업 생략). §12 |
| 질감 | **SVG `feTurbulence` 필터**로 녹·갈라짐·깨짐 질감 생성 | 사전 생성 PNG·p5.js 불필요. 성능 문제가 보이면 Phase 6에서 Node 스크립트로 PNG 사전 생성으로 전환 |
| Node | ≥ 20 (현재 머신 v26.8.1) | |

`package.json` scripts(정확히 이 이름으로):
```
dev        vite                      (호스트·포트는 Grok이 CLI 인자로 지정. 설정 파일에 고정 금지)
build      vite build
preview    vite preview              (동일)
validate   tsx tools/validate-scenario.ts        (tsx가 싫으면 node --experimental-strip-types)
test       vitest run
test:watch vitest
e2e        playwright test           (기본 대상 file://…/dist/index.html, E2E_BASE_URL로 덮어쓰기 가능)
typecheck  tsc --noEmit
```

---

## 3. 문서 간 어긋남과 확정 사항

구현 전에 어긋남을 정리했다. **이 표가 docs/03~06보다 우선한다.**

| # | 어긋남/모호함 | 확정 |
|---|---|---|
| C01 | docs/03 §5.1 caseRunner 다이어그램은 `experts → predict → lab → decision` 고정 순서처럼 보이지만, 데이터 flow는 사건마다 다름(사건 1은 결정 c1d1이 예측보다 앞) | **`cases[].flow` 배열이 유일한 진실.** 다이어그램은 예시로만 본다 |
| C02 | 지연 결과(S17)를 "반 경로 결과 **또는 어떤 팀의 결과**에 delayed가 있으면" 보여주는데, 재선택은 "반 경로에 한해" | S17은 delayed가 붙은 결과를 고른 팀이 하나라도 있으면 표시(반 경로 결과를 먼저, 그 다음 팀별). **재선택 제안은 반 경로 결과에 `retry: true`일 때만** |
| C03 | 재선택 2회차 점수: "두 번째 결과가 solved가 아니면 그 감점을 더한다" — 2회차에도 delayed 추가 감점을 또 적용하는지 불명 | 2회차는 **기본 감점만** 적용, delayed 추가 감점은 적용하지 않고 S17도 다시 보여주지 않는다(시간 절약). 로그 `retry` 이벤트에 2회차 선택·결과 기록 |
| C04 | docs/03 `predictions` 타입이 `string | string[]`인데 예측 형식에 `number`가 있음 | `PredictionValue = string | string[] | number` |
| C05 | docs/04 S00 "팀 이름 입력" vs 개인정보 규칙 | 팀 이름 입력은 유지하되 기본값 "N팀", 안내문 "학생 이름 금지" 표시(§0.1-6) |
| C06 | docs/04 S04 "파일 경로는 S00에서 교사가 입력" vs `scenario.json.expertStudy.manualBaseUrl` | S00의 입력값(settings.manualBaseUrl)이 비어 있으면 JSON 값 사용. 둘 다 비면 "인쇄 매뉴얼을 나눠 주세요" |
| C07 | docs/10 E2E 화면 크기에 1366×768 포함, CLAUDE.md DoD는 1920×1080·1280×720 | 셋 다 검사한다 |
| C08 | docs/11은 Claude Code 스킬(frontend-design, algorithmic-art, canvas-design, docx, webapp-testing) 사용을 전제 | 스킬·플러그인 설치 없이 구현. 그림은 직접 SVG, 질감은 SVG 필터, 지도안·학습지는 **print 모드(P02)와 Markdown**으로 대체(§12) |
| C09 | docs/11 §4 PostToolUse 훅(`.claude/settings.json`) | Claude Code 전용이므로 Codex는 만들지 않는다. 대신 `npm run validate`를 `pretest`·`prebuild`에 연결한다 |
| C10 | docs/03 §10 "콘텐츠 로드 시 런타임 검증" — 브라우저에 Ajv를 넣으면 용량 증가 | 그래프 규칙 V01~V19를 **순수 TS 모듈 `src/content/rules.ts`**로 구현해 Node(tools)와 브라우저(런타임) 양쪽에서 같은 코드를 쓴다. Ajv 스키마 검증은 tools에서만 |
| C11 | 키보드: 팀 선택 1~4, 선택지 A/B/C. 예측 `rank`는 선택지가 최대 4개라 숫자 키와 충돌 | 예측 입력: 1~4로 팀 선택 뒤 **A/B/C/D**로 옵션 입력(rank는 누른 순서가 순위, choice는 하나, number는 입력창에 타이핑). 마우스 입력도 항상 가능 |
| C12 | `heritagePick.examples`에 일러스트 필드가 없는데 S03은 "일러스트 카드" | 일러스트 키를 `heritage_<index>`로 코드에서 도출. 데이터 변경 없음 |
| C13 | docs/02 80분 표 "전이 안내 + 성찰 3분" vs JSON transfer 2 + reflect 1 + wrapup 0 | JSON 값 사용. wrapup 0분이면 타이머 칩을 숨긴다 |
| C14 | 상태 기계의 단계 이름(docs/03)과 `profiles[].phases[].id`가 다름 | §4.2 매핑표로 고정 |
| C15 | CSP `default-src 'self'`는 `file://`로 열 때 브라우저마다 `'self'` 해석이 달라 `<video src=로컬파일>`이 막힐 수 있음 | CSP를 `default-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' data: blob: file:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'`로 정하고 Phase 7에서 file:// 재생을 실제로 확인. 안 되면 영상 로컬 파일은 "새 탭에서 열기"로 통일(§12) |
| C16 | 이전(←) 키 동작 범위 | 브리핑 줄 되돌리기, 투표 단계에서 마지막 입력 취소까지만. 결과 공개 뒤에는 토스트 "결과를 공개한 뒤에는 되돌릴 수 없어요"(앱도 되돌릴 수 없음을 체험) |
| C17 | 예측 적중(predictMatch) 판정 기준이 문서에 없음 | 실습 모듈이 `judgePrediction(value, metrics)`를 제공. rank: 1위가 모델 1위와 같으면 적중. choice: lab2는 1회 결과로 구간 판정(≤3 거의 못 맞춤 / 4~7 절반 / ≥8 다 맞춤), lab5는 "점토". number: 오차 ±2칸 |
| C18 | docs/07 전이 예시는 '마을 입구 비석', `scenario.json.transfer.example`은 '놋그릇' | JSON을 따른다(콘텐츠 단일 출처) |
| C19 | 선택지가 2개뿐인 결정(c3d3)에서 C 키 입력 | 해당 결정의 `choices`에 없는 키는 무시하고 토스트. 화면에도 두 카드만 그린다 |
| C20 | docs/04 S17 "다시 고르기(사건당 1회)" vs docs/05 "결정당 1회" | **결정당 1회**(docs/05). 데이터상 retry는 c1d2에만 있어 실질 차이는 없다 |
| C21 | 개발 서버 포트: 이 계획 초안은 5173 고정이었으나 Grok 보고로 5173이 다른 앱에 점유됨 | 포트·호스트를 설정에 고정하지 않는다(§0.2, §2) |

---

## 4. 상태 모델(확정 TypeScript)

docs/03 §4를 기준으로 어긋남을 반영해 확정한다. 파일: `src/core/types.ts`(상태), `src/content/types.ts`(콘텐츠).

```ts
export type ProfileId = "120" | "80";
export type TeamId = 1 | 2 | 3 | 4;
export type ExpertId = "metal" | "glass" | "paint" | "adhesive";
export type ChoiceKey = "A" | "B" | "C";
export type ResultType = "solved" | "worse" | "irreversible";
export type StepKey = "investigate" | "rootCause" | "reversible" | "minimal" | "evidence";
export type PrincipleId = "P1" | "P2" | "P3" | "P4" | "P5";
export type ReasonTag = "lab" | "manual" | PrincipleId;
export type PredictionValue = string | string[] | number;

export type LessonPhase =
  | "SETUP" | "INTRO" | "VIDEO" | "HERITAGE_PICK" | "EXPERT_STUDY" | "TEAM_SETUP"
  | "TUTORIAL" | "CASE" | "BREAK" | "ALGORITHM" | "AI_CHECK" | "TRANSFER" | "REFLECT" | "WRAPUP";

/** 사건 안의 현재 위치. caseCursor는 flow 인덱스, stage는 그 항목 안의 세부 단계 */
export type CaseStage =
  | { kind: "brief"; line: number }                      // line: 지금까지 보인 줄 수(1..N)
  | { kind: "experts" }
  | { kind: "predict"; labId: string }
  | { kind: "lab"; labId: string; part?: "A" | "B" }
  | { kind: "decision"; nodeId: string; attempt: 1 | 2;
      sub: "vote" | "outcome" | "otherPaths" | "delayed" | "retryOffer" }
  | { kind: "historyJoin"; nodeId: string }
  | { kind: "history" }
  | { kind: "wrap" };

export interface AppState {
  schemaVersion: 1;
  sessionId: string;                 // 시작 시각 ISO + 난수 4자리
  startedAt: number;                 // epoch ms
  profile: ProfileId;
  phase: LessonPhase;
  phaseStartedAt: number;
  subScreen: number;                 // ALGORITHM: 0=S20,1=S21 / AI_CHECK: 0=점검,1=실제 처리 / 그 외 0
  caseIndex: number;                 // -1=연습(tutorial), 0..4
  caseCursor: number;                // cases[i].flow 인덱스
  stage: CaseStage | null;
  teams: Record<TeamId, TeamState>;
  classPath: PathEntry[];
  predictions: Record<string, Partial<Record<TeamId, PredictionValue>>>;   // labId → 팀별
  predictionLocked: Record<string, boolean>;
  labResults: Record<string, Record<string, number | string>>;            // labId(+":A"/":B") → 측정값
  labSkipped: Record<string, boolean>;                                      // 증거 카드로 대체한 실습
  retryUsed: Record<string, boolean>;                                       // nodeId → 재선택 사용 여부
  skippedDecisions: string[];                                               // optional 건너뛴 nodeId
  algorithmNotes: string[];          // S21 카드 5칸(빈 문자열 허용)
  aiCheck: { answerIndex: number; pastedAnswer?: { model: string; date: string; text: string };
             checks: Record<StepKey, boolean | null> };
  settings: { quickLabs: boolean; skipOptional: boolean; showTeacherPanel: boolean;
              manualBaseUrl: string; showRanking: boolean; timerOffsetSec: number; paused: boolean };
  teamSetupChecked: Record<TeamId, Partial<Record<ExpertId, boolean>>>;      // S05 체크 표시
  expertPassed: Record<ExpertId, boolean>;                                   // S04 통과 체크
}

export interface TeamState {
  id: TeamId;
  name: string;                                   // 기본 "N팀". 학생 이름 금지
  health: Record<string, number>;                 // caseId → 남은 건강도(시작 healthStart)
  votes: Record<string, VoteRecord[]>;            // nodeId → [1회차, (2회차)]
  badges: PrincipleId[];                          // 얻은 원칙 카드(중복 없음)
  evidencePoints: number;                         // 근거 배지 누계
}
export interface VoteRecord { choice: ChoiceKey; reasons: ReasonTag[]; result: ResultType; delta: number; at: number }

export interface PathEntry {
  caseId: string; nodeId: string; attempt: 1 | 2; choice: ChoiceKey; result: ResultType;
  decidedBy: "majority" | "teacher"; step: StepKey; tally: Record<ChoiceKey, number>; at: number;
}
```

### 4.1 저장소(store)
- `createStore(initial)` → `{ get(), set(reducer), subscribe(fn) }`. 갱신은 불변(새 객체). `set`마다 `persistence.save`(200ms 디바운스)와 `logger`는 호출자가 명시적으로 부른다(저장과 로그를 암묵 결합하지 않는다).
- 모든 상태 변경은 `src/core/actions.ts`의 함수(`next()`, `prev()`, `vote(team, choice)`, `setReasons(team, tags)`, `confirmDecision(tieBreak?)`, `showOtherPaths()`, `fastForward()`, `acceptRetry(yes)`, `lockPredictions()`, `reportLab(labId, metrics)`, `skipLab(labId)`, `skipDecision(nodeId)`, `setAlgorithmNote(i, text)`, `setAiCheck(step, value)`, `pasteAiAnswer(...)`, `exportCsv()`, `exportJson()`, `resetSession()`)를 통해서만 일어난다. 키보드와 버튼은 모두 이 함수를 부른다.

### 4.2 수업 단계 ↔ 프로필 phase id ↔ 화면

| LessonPhase | profiles.phases[].id | 화면 |
|---|---|---|
| SETUP | (없음, 타이머 없음) | S00 |
| INTRO | intro | S01 |
| VIDEO | video | S02 |
| HERITAGE_PICK | heritagePick | S03 |
| EXPERT_STUDY | expertStudy | S04 |
| TEAM_SETUP | teamSetup | S05 |
| TUTORIAL | tutorial | S06(= S10/S14/S15/S19 축소판, `scored:false`) |
| CASE(caseIndex=i) | case1..case5 | S10~S19 |
| BREAK | (없음) | SBR(쉬는 시간) — `profile.breakAfterCase`와 같은 사건이 끝난 직후 |
| ALGORITHM | algorithm | S20(subScreen 0), S21(1) |
| AI_CHECK | aiCheck | S22(0: 점검, 1: 실제 처리) |
| TRANSFER | transfer | S23 |
| REFLECT | reflect | S24 |
| WRAPUP | wrapup | S25 |

`next()`의 단계 전이는 위 표 순서. CASE 안에서는 §4.3. 사건 종료 시 `caseIndex+1`; 마지막 사건이면 ALGORITHM.

### 4.3 caseRunner 실행 규칙(확정 알고리즘)
`flow[caseCursor]` 항목에 따라 `stage`를 만든다.

```
brief        : line=1부터 시작. next → line+1. 마지막 줄 뒤 next → 다음 flow 항목. prev → line-1(≥1)
experts      : next → 다음 항목
predict      : lab 예측 입력. 모든 팀 입력 전에도 Enter(=lockPredictions)로 잠글 수 있되 1팀 이상 입력 필요.
               잠근 뒤 next → 다음 항목(보통 lab). 잠그지 않고 next → 토스트 "예측을 먼저 잠가요"
lab / lab:A / lab:B : 실습 모듈 mount. 실습이 report()를 부르면 labResults 저장 + 'lab_metric' 로그 + 예측 vs 결과 표시.
               next → report 전이면 모달 "실습을 끝내지 않았어요: [계속하기] [증거 카드로 건너뛰기]". 건너뛰면 labSkipped + fallbackEvidence 카드 표시.
결정 노드 id : optional && settings.skipOptional → skippedDecisions에 넣고 'skipped' 로그, 다음 항목으로.
               sub=vote: 1~4로 팀, A/B/C로 선택, R로 근거 태그 패널. Enter(confirmDecision):
                 - 투표한 팀 0 → 토스트, 확정 불가
                 - 다수결. 최다 득표가 둘 이상이면 모달에서 교사가 고름(decidedBy="teacher")
                 - 팀별: 그 팀 선택지의 결과 노드 → delta(healthDelta 우선, 없으면 outcomeTypes[result].healthDelta) 적용, 0 하한
                 - solved면 결과 노드 principle 배지 추가(중복 없음)
                 - reasons에 결정 step의 원칙 ID나 lab/manual이 있으면 evidencePoints+1
                 - classPath push, 'vote'×팀, 'decision', 'outcome' 로그
                 - sub=outcome
               sub=outcome: O → otherPaths(오버레이, 다시 O/Esc로 닫음). next →
                 - 어떤 팀(반 경로 포함)의 결과에 delayed가 있고 attempt==1 → sub=delayed
                 - 아니면 → 다음 flow 항목
               sub=delayed: 1.5초 연출(reduced-motion이면 즉시) 뒤 delayed 문구 + extraDelta 적용('delayed_shown' 로그). next →
                 - 반 경로 결과 retry===true && !retryUsed[nodeId] → sub=retryOffer
                 - 아니면 → 다음 flow 항목
               sub=retryOffer: 모달 "다시 고를까요?" [다시 고르기] [그대로 진행]. 다시 고르기 → retryUsed=true, attempt=2, sub=vote(투표 초기화).
                 attempt 2 확정 시: solved가 아닌 팀만 기본 감점 추가, delayed 미적용, 'retry' 로그, sub=outcome → next → 다음 항목(재선택 제안 없음)
historyJoin  : 카드 표시, 'history_shown'(kind=join) 로그. next → 다음 항목
history      : 타임라인. next → 다음 항목
wrap         : 원칙 카드·건강도·정리 질문. next → 사건 종료(BREAK 또는 다음 사건 또는 ALGORITHM)
```
- `prev()`는 brief(줄)와 vote(마지막 입력 취소)에서만 상태를 바꾼다. 그 외는 토스트.
- 알 수 없는 flow 항목/노드 ID: `import.meta.env.DEV`면 throw, 아니면 'error' 로그 후 `wrap`으로 점프.

### 4.4 점수 요약(scoring.ts 순수 함수)
```
applyVote(team, decision, outcome, attempt) → { delta, badge?, evidencePoint }
applyDelayed(team, outcome) → extraDelta   (attempt 1에서만)
clampHealth(h) = max(0, h)
```
팀 합계 = Σ caseId health. 순위는 `settings.showRanking`일 때만 S25에 노출, 기본은 교사 패널에만.

### 4.5 알고리즘 매트릭스(algorithmMatrix.ts 순수 함수)
```
buildMatrix(scenario, state, mode: "class" | TeamId) → Row[]
Row = { caseId, cells: Record<StepKey, Cell[]>, experts: { lead, support[] } }
Cell = { nodeId, result?: ResultType, skipped: boolean, attempt }
```
반 경로 모드는 classPath(attempt 1 기준, 재선택이 있으면 둘 다 표시 "△→✓"), 팀별 모드는 teams[t].votes.

---

## 5. 저장소 구조·모드·공통 기반

### 5.1 파일 구조(docs/03 §2 기준, 확정)
```
index.html                    #app 하나. CSP는 빌드 시 플러그인이 주입
vite.config.ts                singlefile + CSP 주입 플러그인(apply:"build")
src/
  main.ts                     URL 쿼리로 모드 분기 → modes/*.mount(root)
  core/ types.ts store.ts actions.ts lessonMachine.ts caseRunner.ts scoring.ts
        logger.ts persistence.ts timer.ts keyboard.ts rng.ts export.ts
  content/ loadContent.ts(JSON import + rules 검사) types.ts rules.ts(V01~V19 순수 TS)
  engine/ graph.ts algorithmMatrix.ts
  labs/ types.ts labHost.ts  models/lab1Model.ts … lab5Model.ts(순수, DOM 없음)
        views/lab1View.ts … lab5View.ts(DOM·SVG)
  ui/ stage.ts labels.ts theme.css screens/S00.ts … S25.ts SBR.ts
      components/ Modal.ts Toast.ts TeamVotePanel.ts PredictPanel.ts ReasonTags.ts
                  ExpertBadge.ts OutcomeMark.ts HealthBar.ts TimerChip.ts TopBar.ts
                  TeacherPanel.ts QrCard.ts PrincipleCard.ts Timeline.ts
  modes/ teacher.ts manual.ts print.ts team.ts(P2)
assets/ illustrations/*.svg  icons/*.svg  (텍스처는 SVG 필터라 파일 없음)
tools/ validate-scenario.ts (Ajv + rules.ts + manuals/labs/profiles 검사)
tests/ unit/*.test.ts  e2e/*.spec.ts  e2e/helpers.ts
docs/ (설계 문서) + ASSETS.md(Phase 6) + TEACHER_GUIDE.md(Phase 7)
```

### 5.2 모드 분기(`main.ts`)
`new URLSearchParams(location.search)`: `mode` 기본 `teacher`; `manual`은 `expert` 필수(없거나 잘못되면 4개 선택 화면); `print`; `team`(P2, 없으면 안내 화면). `file://`로 열어도 쿼리는 동작한다.

### 5.3 CSP와 오프라인
- 빌드 전용 Vite 플러그인 `transformIndexHtml`로 `<meta http-equiv="Content-Security-Policy">` 주입(값은 §3 C15). 개발 서버에는 주입하지 않는다(HMR WebSocket 때문).
- 코드 검사: `tests/unit/no-network.test.ts`가 `src/**`를 읽어 `fetch(`, `XMLHttpRequest`, `WebSocket`, `http://`, `https://`(영상 링크는 데이터에만 있음) 문자열이 없는지 검사. 예외: 주석.

### 5.4 무대(stage.ts)
`#stage` 1920×1080 고정, `transform: scale(min(innerW/1920, innerH/1080))`, 중앙 정렬. `resize` 리스너. manual/print 모드는 무대를 쓰지 않고 일반 흐름 레이아웃.

### 5.5 키보드(keyboard.ts)
docs/03 §7 표 그대로 + 아래 규칙:
- `input/textarea/[contenteditable]`에 포커스가 있으면 Esc 외 단축키 무시.
- Space·PageDown·→ = next, PageUp·← = prev(클리커 호환). Enter = 확정/공개. 모달이 열려 있으면 Enter/Esc만 모달로.
- 예측 입력 A/B/C/D(§3 C11). `T` 교사 패널, `P` 일시정지, `O` 다른 길, `F` 빨리 감기(sub=delayed로 진입하는 next와 동일), `H` 역사 공개(S22에서 실제 처리), `G` 매트릭스(ALGORITHM 진입 후 S20/S21 토글), `E` 내보내기 모달.

### 5.6 타이머(timer.ts)
phase 진입 시 `planned = profile.phases[id].minutes×60`(CASE는 `caseStepMinutes[stage.kind]`의 합이 아니라 사건 전체 분을 쓰고, 교사 패널에 단계별 권장 분을 표시). 1초 tick, 남은 30초 노랑, 초과 빨강, 자동 전환 없음. `P` 일시정지, 패널에서 ±1분(`timerOffsetSec`). phase 전환 시 `phase_enter` 로그에 `planned_s/actual_s`.

### 5.7 로그·저장·내보내기
- 이벤트 종류(docs/10 §1): `phase_enter prediction lab_metric vote decision outcome delayed_shown retry history_shown algorithm_note ai_check export skipped error`.
- `LogEvent = { t: ISO(+09:00 등 로컬 오프셋), elapsed_s, phase, case_id, node_id, event, team, value, reasons, result, health_after, step, planned_s, actual_s, note }`.
- 저장 키: `cons-lab:current` = `{ schemaVersion, state, log }`. 디바운스 200ms. 실패 시 화면 구석 작은 경고 아이콘 + 패널에 원인.
- S00: 저장 세션이 있으면 모달 "이어하기 / 새로 시작"(새로 시작은 두 번 확인).
- CSV: `conservation-lab_<YYYYMMDD-HHMM>_<profile>.csv`, UTF-8 BOM, 열 순서 docs/10 §1 그대로. JSON: `{ exportedAt, state, log }`. S00의 "JSON 불러오기"(파일 선택)로 복원.
- **입력 안전**: 교사가 타이핑·붙여넣는 텍스트(팀 이름, 알고리즘 카드, AI 답변, 메모)는 `textContent`로만 렌더링한다(innerHTML 금지). CSV 셀은 RFC 4180 따옴표 처리 + `=`, `+`, `-`, `@`, 탭, CR로 시작하는 셀 앞에 `'`를 붙여 수식 주입을 막는다. JSON 불러오기는 `schemaVersion`과 구조(`rules.ts`의 상태 검사 함수)를 통과한 경우에만 **한 번에** 교체한다(부분 복원 금지).

---

## 6. 화면(S00~S25, SBR, T, M01/M02, P01/P02) 구현 지침
docs/04 와이어프레임을 따른다. 여기서는 구현에 필요한 보강만 적는다.
- **공통 TopBar**: 단계 이름, 사건 진행 ●●○○○, TimerChip, 팀별 HealthBar 4개(현재 사건). 오른쪽 아래 "다음 →" 힌트.
- **결과 기호**: `OutcomeMark`는 항상 `shape(원/세모/가위표 SVG) + symbol(✓△✕) + label(해결/악화/되돌릴 수 없음)` 세 겹. `role="img" aria-label`.
- **선택지 기호**: A=○, B=△, C=□ (손 카드와 동일). 결과 △와 선택지 △가 함께 보이는 S15/S16에서는 결과 배지에 색 채움 + 글자 '악화'를 반드시 함께.
- **S14 TeamVotePanel**: 팀 4열, 선택된 팀 강조, 각 팀의 현재 선택·근거 태그 표시. 확정 전까지 수정 가능.
- **S15**: 반 선택, 결과, 획득 원칙 카드(팀별), 팀별 건강도 + 각 팀 선택·결과 기호. 반 경로가 ✕이면 교사 패널에 '사고 보고서' 발문(`labels.ts`의 교사 전용 문구는 허용).
- **S17**: 달력 넘기기 연출 1.5초(CSS keyframes, `prefers-reduced-motion`이면 생략).
- **S20**: 표 + "불려 간 전문가" 행 + 열 강조 + 팀별 보기(1~4) + 그래프 보기 토글(사건 5개 미니 노드-링크 SVG, 반 경로 굵게).
- **S21**: 카드 5칸(드래그 순서 변경은 마우스, 키보드는 ↑↓ 버튼), 텍스트 입력, [원칙과 비교] 버튼.
- **S22**: 캡처 답변(모델·날짜 표기) 스크롤 영역, 체크 5개(예/아니오/미정 3상태), `H` → 실제 처리 타임라인. 답변이 없으면 **교사 패널에만** 경고 + 붙여넣기 폼(localStorage 저장).
- **S25**: 팀별 원칙 카드·반 알고리즘 카드·내보내기 버튼·초기화(두 번 확인 모달). 순위는 showRanking일 때만.
- **SBR**: "저장됨 ✓ · 2차시는 사건 3부터". next → 다음 사건.
- **교사 패널(T)**: 현재 화면의 `teacher.keyQuestions/misconceptions/notes`, 출처 URL(복사 버튼, 클릭 시 새 탭), 타이머 ±1분, 팀 투표 수정, optional 결정 건너뛰기, 실습 건너뛰기, AI 답변 붙여넣기, 로그 미리보기(최근 20행), 실습 모델이 '설명용 근사값'이라는 고정 문구.
- **M01/M02**: `manuals.json`의 분야 하나. 퀴즈는 기본 3문항, `&n=2`면 2문항(80분). 즉시 피드백(`why`), 모두 맞히면 인증 배지 화면. 결과는 `cons-lab:quiz:<expert>`에 저장.
- **P01/P02**: `@page { size: A4 portrait; margin: 12mm }`. P01 분야별 1쪽(+퀴즈 하단). P02 W1(앞: 문화유산 고르기 / 뒤: worksheetPrompt), W2(사건 5행 × 예측·선택·근거·결과), W3(`transfer.fields`), W4(`reflection.questions`). 흑백 인쇄에서도 모양 기호로 구분.

---

## 7. 가상 실습 5종 구현 지침
공통 인터페이스는 docs/06 §0 `LabModule`/`LabContext`를 그대로 쓴다. **모델(순수 함수, `labs/models/`)과 뷰(DOM, `labs/views/`)를 분리**해 모델만으로 단위 테스트가 돌게 한다. 시드 = `sessionId + labId`, RNG는 `rng.ts`(seedrandom).

| 실습 | 모델 함수(순수) | 기대값(현재 config로 계산, 단위 테스트가 검사) | 빠른 모드 |
|---|---|---|---|
| 1 갈바닉 | `rust(k, tDays, tau) = 100·k·(1−e^(−t/τ))` | t=3: bare 39, copper 78, insulated 39, stainless ≈2 → 순위 copper > bare ≈ insulated | 슬라이더 대신 [3일 뒤 보기] |
| 2 조각 | `cutPieces(seed, n)` 보로노이(d3-delaunay), `snap(piece, tol)` | 같은 시드 → 같은 다각형, 겹침 없음, 작은 조각 2개는 가장 작은 셀 2개를 재분할 | n=6, 1회 40초, 번호·사진 자동 |
| 3 접착제 | `simulate(adhesive, tool, warm, cfg)` → `{removed, strokes, scratches, residueBand, days}` | 밀랍+나무 8회·약 6일·흠집 0 / 에폭시+나무+데움 41회·약 29일·흠집 0 / 에폭시+금속 53회·흠집 15 / 에폭시+나무(차가움) 60회 안에 안 떨어짐 / 금속 도구는 어떤 조합이든 흠집 ≥1 / 에폭시 최단(21회)이 다른 접착제 최장(12회)보다 큼 | 조합 3개, 진행·일수 ×2 |
| 4 테이프 | `peelCount(sample, cfg)` = `round(p·25 + 1e-9)` | S1 1, S2 9, S3 3, S4 11 → S4 > S2 > S3 > S1. 말리기 < 1.0이면 측정 무효 | S1·S2·S4, 자동 말리기 |
| 5A 보강 | `removeSequence(reinf, cfg)` | 점토 3단계 손상 0, 콘크리트 12단계 손상 3(4·8·11) | 콘크리트 6단계 손상 2·4·6 |
| 5B 증거 | `canRaise(floor, evidenceFloors)` | 1~6층 실선, 7~9층 점선 '근거 없음' | 동일 |

- 각 실습 화면 상단에 "이 실습의 숫자는 설명용 근삿값이에요"를 작게 표시하지 않는다(학생 화면은 '실제 측정값처럼' 보이지 않게만 하고, 근사값 고지는 **교사 패널**에 둔다. CLAUDE.md 규칙 11).
- `report()`는 한 실습에서 한 번(lab5는 A·B 각각). 이후 조작은 가능하지만 측정값은 처음 값 유지.
- 실물 사진: `assets/pilot/` 폴더가 비어 있으면 버튼을 숨긴다(빌드 시 `import.meta.glob`).
- 예측 vs 결과 비교는 `judgePrediction`(§3 C17)으로. 틀린 팀을 강조하지 않는다.

---

## 8. 콘텐츠 검증기(`tools/validate-scenario.ts`)
1. Ajv(2020) + `data/scenario.schema.json`.
2. `src/content/rules.ts`의 V01~V19(기존 `tools/validate-scenario.mjs`를 TS로 옮기고 함수화).
3. 추가 규칙: `manuals.json`(4종, 퀴즈 3, answer 범위, calledIn/callouts 대응), `labs.config.json`(lab1~5 존재, 숫자 범위: k∈(0,1], τ>0, reversibility∈(0,1], hardness∈[0,1], p 가중치 ≥0, removeSteps ≥1), `profiles`(단계 분 합계 = 프로필 분, 사건 id 존재), `src/ui/labels.ts`의 금지어.
4. 출력: 기존 스크립트와 같은 형식(오류 → exit 1). 기존 `.mjs`는 Phase 1에서 삭제하고 `.ts`로 대체(참조 구현은 git 이력에 남음).

---

## 9. 테스트 계획

### 9.1 단위(Vitest)
| 파일 | 검사 |
|---|---|
| `rules.test.ts` | 현재 데이터 오류 0; 고의로 깨뜨린 픽스처에서 V01·V04·V05·V09·V11·V14·V15 오류 검출 |
| `caseRunner.test.ts` | 사건 1~5 flow 순서대로 stage 전이; optional 건너뛰기(skipOptional on/off); historyJoin 통과; retry는 반 경로 retry일 때만 1회; ✕ 뒤 진행; attempt 2 뒤 재제안 없음; 알 수 없는 노드 → wrap |
| `scoring.test.ts` | 반 경로와 다른 팀 감점, healthDelta 우선, delayed 추가 감점(1회차만), 0 하한, 원칙 카드 중복 없음, 근거 배지 조건, 미투표 팀 무감점, 같은 결정에 확정·지연을 두 번 적용해도 감점이 중복되지 않음, 연습 사건(`scored:false`)은 건강도 변화 없음 |
| `actions.test.ts` | 2선택지 결정에서 C 무시(C19), 투표 0개 확정 불가, 동점 → 교사 선택 필요, 결과 공개 뒤 `prev()` 무효, optional 건너뛰기 로그, 반 경로가 solved이고 한 팀만 delayed일 때도 S17 진입 |
| `lessonMachine.test.ts` | 단계 순서, 80분 BREAK 삽입, 120분 BREAK 없음 |
| `algorithmMatrix.test.ts` | 단계별 칸, 건너뛴 결정 '·', 팀별 보기, 전문가 행에 접착이 5개 사건 모두 |
| `lab1~5Model.test.ts` | §7 기대값 전부 + 시드 재현 |
| `persistence.test.ts` | localStorage throw(용량 초과·접근 거부 모의) 시에도 상태 진행, 복원 시 schemaVersion 검사 |
| `export.test.ts` | CSV 헤더가 docs/10 §1 열 순서와 같음, BOM, 행 수 = 로그 수, 수식 주입 셀 이스케이프, JSON 왕복 복원, 깨진 JSON은 복원 거부(원자성) |
| `sanitize.test.ts` | 사용자 텍스트에 `<script>`·`<img onerror>`를 넣어도 DOM에 요소가 생기지 않음(jsdom) |
| `no-network.test.ts` | §5.3 |

### 9.2 E2E(Playwright, Chromium, 기본 대상 = `file://…/dist/index.html`, `E2E_BASE_URL`로 Grok 미리보기 URL 지정 가능)
`tests/e2e/helpers.ts`에 "키보드로 사건 하나 끝까지" 헬퍼를 만든다(투표 패턴을 인자로).
1. 120분 전체 진행, 모든 결정 (A,A,A,A) → S25 도달, 내보내기 버튼 존재.
2. 같은 흐름 (B,B,B,B) / (C,C,C,C) / (A,B,C,B) / 동점 (A,A,B,B → 교사 선택 모달) / 재선택 수락·거절 → **모든 선택지 결과 노드가 한 번 이상 표시됨**(결과 노드 id를 `data-node` 속성으로 노출해 집계).
3. 80분: c2d1·c3d3·c4d2 건너뜀, 실습 빠른 모드 UI, 사건 2 뒤 SBR.
4. 이어하기: 사건 3 투표 중 `page.reload()` → 같은 stage·같은 건강도.
5. 오프라인: `page.route("**/*")`로 페이지 자체 외 모든 요청 차단·집계 → 0건. 영상 버튼은 `window.open` 호출만 확인(실제 열지 않음).
6. 화면 크기 1920×1080 / 1366×768 / 1280×720: 주요 화면 스크린샷 + 텍스트 요소 `scrollWidth ≤ clientWidth` 검사.
7. manual 모드 4분야: 퀴즈 전부 정답 → 인증 화면; `&n=2`.
8. print 모드: `page.pdf({format:"A4"})` 생성, 페이지 수 = 4(매뉴얼) + 4(학습지) 이하.
9. 내보내기: 다운로드 이벤트로 CSV 받아 헤더 검사; JSON 저장 → S00에서 불러오기 → 상태 동일.
10. 키보드만: 1~2번 시나리오를 마우스 클릭 없이(`page.keyboard`만) 통과.

---

## 10. 단계별 실행 계획과 완료 기준(DoD)

각 Phase 끝에 `npm run typecheck && npm run validate && npm test && npm run build`가 통과해야 하고, Phase 3부터는 `npm run e2e`의 해당 번호도 통과해야 한다. Grok은 Phase 1부터 dev·preview 서버를 유지한다.

### Phase 1. 골격
- 작업: Vite+TS+singlefile 프로젝트, scripts(§2), `.gitignore`, `index.html`, CSP 주입 플러그인, `stage.ts`, 모드 분기, `content/types.ts`·`loadContent.ts`(JSON import), `rules.ts` + `tools/validate-scenario.ts`(Ajv 포함), S00~S25·SBR 빈 화면을 →/←로 이동, `labels.ts`, Vitest·Playwright 설정(webServer 없음, `file://` 기본, `E2E_BASE_URL` 지원). `vite.config`에 host/port/strictPort 고정 금지(§0.2).
- 검증: `npm run validate` 오류 0·경고 1(AI 캡처 비어 있음); `npm run build` → `dist/index.html` 단일 파일, `dist/`에 다른 자산 없음; `file://` 로 열었을 때 콘솔 오류 0; `rules.test.ts` 통과.
- DoD: 위 검증 + 빈 화면 전체 이동이 키보드로 됨 + 첫 커밋.

### Phase 2. 코어 엔진(글자 UI)
- 작업: `store/actions/lessonMachine/caseRunner/scoring/logger/persistence/timer/keyboard/rng/export`, 글자·버튼만 있는 임시 화면으로 연습 사건과 사건 1~5 전체 진행(실습 자리는 "[실습 자리] 증거 카드로 진행" 버튼), 교사 패널 골격(타이머 ±, 투표 수정, 건너뛰기), 이어하기 모달, CSV/JSON 내보내기·불러오기.
- 검증: 단위 테스트 `caseRunner/scoring/lessonMachine/algorithmMatrix/persistence/export` 통과; 120분·80분 프로필을 글자 UI로 S00→S25 수동 통과; CSV 열 = docs/10 §1.
- DoD: 위 + E2E 1·3·4·9의 초안 통과(글자 UI 기준 셀렉터는 `data-testid`로 고정해 Phase 3에서 바뀌지 않게).

### Phase 3. 화면 UI(S00~S25, T, SBR)
- 작업: `theme.css`(docs/09 색 토큰·글자 크기·기호), 공통 컴포넌트, 화면 25개 + 교사 패널 + 쉬는 시간, 토스트·모달 접근성(포커스 트랩, aria-live), reduced-motion.
- 검증: E2E 1~4·6·10 통과; 1920×1080 스크린샷 육안 확인(Grok 미리보기); 대비 4.5:1(색 토큰 조합을 단위 테스트로 계산).
- DoD: 위 + 학생 문구가 코드에 없음(`grep`으로 한글 문자열이 `labels.ts`·테스트 밖에 없음을 확인하는 스크립트 `tools/check-hardcoded-text.mjs` 추가).

### Phase 4. 가상 실습(1 → 2 → 3 → 4 → 5, 실습마다 커밋)
- 작업: `labHost.ts`(POE 틀, 예측 vs 결과, 빠른 모드 스위치, 증거 카드 대체, 실물 사진 버튼), 실습별 모델+뷰, S12 PredictPanel(rank/choice/number).
- 검증: `lab1~5Model.test.ts`(§7 기대값) 통과; 각 실습을 Grok 개발 서버(또는 `file://` 빌드)에서 마우스·터치(Playwright `hasTouch`)로 조작; 빠른 모드·건너뛰기 동작; `report()` 후 S13에 예측 vs 결과 표시.
- DoD: 실습 5개 모두 위 통과 + E2E 1~3이 실습 포함으로 통과(헬퍼가 실습을 "건너뛰기"와 "실제 조작" 두 경로로 돌림).

### Phase 5. 알고리즘·AI 점검·전이 + manual·print
- 작업: S20 매트릭스(표·그래프 보기·팀별 보기), S21 카드 편집, S22(캡처 답변·체크·실제 처리·패널 붙여넣기), S23·S24, M01/M02, P01/P02, S04 QR(qrcode-generator → SVG).
- 검증: E2E 5·7·8 통과; `capturedAnswers`가 비었을 때 학생 화면에는 경고가 없고 교사 패널에만 있음(E2E 단언); QR 내용 = `${manualBaseUrl}?mode=manual&expert=<id>`.
- DoD: 위 + 전체 E2E 1~10 통과.

### Phase 6. 그림·디자인·성능
- 작업: 사건 브리핑 일러스트 5 + 연습·AI 점검 2, 증거 카드(X선·도면·성분 결과지 느낌), 미륵사지 증거 카드 1~6층, 전문가 배지 4, 원칙 아이콘 5, 문화유산 예시 카드 6 — 모두 직접 그린 SVG(실존 인물 얼굴 없음, 유명 유산은 실루엣), "학습용 재현 그림" 작은 표기. 질감은 SVG 필터. `docs/ASSETS.md`(에셋·출처·라이선스 표).
- 검증: `dist/index.html` ≤ 5 MB(빌드 스크립트가 크기를 출력하고 초과 시 실패); 첫 화면 2초 이내(Playwright `performance.timing`); reduced-motion 적용 확인.
- DoD: 위 + E2E 6 스크린샷 재확인.

### Phase 7. 전체 검증과 수업 준비물
- 작업: 전체 E2E, `file://`에서 영상 로컬 파일 재생 확인(C15), `docs/TEACHER_GUIDE.md`(1쪽: 단축키, 수업 전 점검표 docs/10 §4, 수업 당일 순서), `docs/LESSON_PLAN.md`(AIEDAP 지도안 docs/02 §5를 Markdown 표로), 학습지는 print 모드 P02로 갈음. Claude에 `data/scenario.json` 전체 fact-check·kid-reader 검토 요청.
- 검증: CLAUDE.md 전체 완료 기준 9개 항목을 표로 체크하고 증빙(명령 출력·스크린샷 경로)을 `docs/DOD_REPORT.md`에 남긴다.
- DoD: 전부 ✓.

### Phase 8(선택, P2). team 모드
- `?mode=team&team=n`에서 현재 사건의 실습을 팀이 직접 조작(동기화 없음). Phase 7 완료 후, 시간이 남을 때만.

---

## 11. 품질 게이트 요약(모든 Phase 공통)
| 게이트 | 명령/방법 | 기준 |
|---|---|---|
| 타입 | `npm run typecheck` | 오류 0 |
| 콘텐츠 | `npm run validate` | 오류 0 |
| 단위 | `npm test` | 전부 통과 |
| 빌드 | `npm run build` | `dist/index.html` 하나, ≤ 5 MB |
| E2E | `npm run e2e` | Phase별 지정 번호 통과 |
| 오프라인 | E2E 5 + `no-network.test.ts` | 외부 요청 0 |
| 접근성 | 대비 테스트, 키보드 전용 E2E 10 | 통과 |
| 문구 | `tools/check-hardcoded-text.mjs` | 코드 내 학생 문구 0 |

---

## 12. 미결 사항(기본값으로 진행, 교사·사용자 확인 필요)

| # | 항목 | 현재 가정(기본값) | 바꾸면 생기는 영향 | 확인 주체 |
|---|---|---|---|---|
| Q01 | 수업 길이 | 120분 기본, 80분 프로필 동시 지원 | 없음(시작 화면에서 선택) | 교사 |
| Q02 | 학생 기기 유무 | 기기 4대 이상 → manual 모드(QR). 없으면 print | QR용 `manualBaseUrl`(교내 공유 주소) 필요 | 교사 |
| Q03 | 도입 영상 | `video.url` 비어 있음 → S02에 "교사가 링크를 입력하세요" 표시 | 수업 전 JSON 또는 S00에서 입력 | 교사 |
| Q04 | AI 답변 캡처 | 비어 있음 → 교사 패널 경고 + 붙여넣기 | 수업 전 실제 생성형 AI에 질문 후 입력 | 교사 |
| Q05 | 숭례문 단청 최신 상황 | 2022년 보도 기준 문구 유지 | 수업 직전 `case4.history` 마지막 줄 수정 → validate → build | 교사 + Claude(fact-checker) |
| Q06 | "초록색 겉면은 그대로 두었어요"(case1) 1차 출처 | 유지 | fact-checker 결과에 따라 문구 조정 | Claude |
| Q07 | 성취기준·AIEDAP 수업 유형 | 실과 [6실05-01], 'AI 내용요소 연계형' | 지도안 문서(docs/LESSON_PLAN.md)만 영향 | 교사 |
| Q08 | 글꼴 | 시스템 글꼴만(Pretendard 미내장) | 교실 노트북에 한글 글꼴이 있으면 문제 없음. 내장하려면 서브셋+OFL 파일 추가(용량 +300KB~) | 사용자 |
| Q09 | 지도안·학습지 docx | 만들지 않음(print 모드 P02 + Markdown으로 대체) | docx가 꼭 필요하면 별도 작업 | 사용자 |
| Q10 | 로컬 영상 파일 재생(`video.localFile`) | file://에서 CSP·경로 문제가 있으면 "새 탭에서 열기"로 통일 | Phase 7에서 결정 | Codex 보고 → 사용자 |
| Q11 | 재선택 2회차 지연 감점 | 적용하지 않음(§3 C03) | 점수 규칙 변경 시 scoring.ts·테스트 수정 | 사용자 |
| Q12 | 예측 적중 판정 기준 | §3 C17 | 로그 분석(H2)에만 영향 | 사용자 |
| Q13 | 듀얼 모니터 교사 패널(`panel=window`) | 미구현(P2) | 필요 시 Phase 8 | 사용자 |
| Q14 | team 모드 | P2, Phase 8 선택 | 없음 | 사용자 |
| Q15 | Playwright 브라우저 설치 | 개발 머신에서 한 번 `npx playwright install chromium`(이때만 네트워크 사용, 런타임과 무관) | 없으면 E2E 불가 | Grok/Codex |
| Q16 | 팀 이름 입력 유지 | 유지(기본 "N팀", 학생 이름 금지 안내) | 삭제하면 S00 단순화 | 교사 |
| Q17 | 개발 서버 포트 | Vite 자동 선택(5173 점유 중). 실제 포트는 `docs/SERVER.md` | 없음 | Grok |

---

## 13. 참고: 현재 데이터 상태(2026-11-03 검증 결과)
- `node tools/validate-scenario.mjs`: 오류 0, 경고 1(`aiCheck.capturedAnswers` 비어 있음).
- 단계 분포: investigate 3, rootCause 2, reversible 4, minimal 1, evidence 1 → 다섯 단계 모두 1회 이상, '되돌릴 수 있게' 최다(설계 의도와 일치).
- 전문가 주도: metal 1, glass 1, paint 1, adhesive 2. 접착은 5개 사건 모두에 등장(허브).
- 프로필 분 합계: 120 = 120, 80 = 80.
- 실습 모델 기대값(§7)은 `labs.config.json` 현재 값으로 손계산해 docs/06의 수치와 일치함을 확인했다.
