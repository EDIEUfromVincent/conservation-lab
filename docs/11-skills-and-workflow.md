# 11. 스킬과 작업 순서 (Claude Code)

## 1. 공식 스킬 (anthropics/skills)
```
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
/plugin install document-skills@anthropic-agent-skills
```
| 스킬 | 쓰는 Phase | 하는 일 |
|---|---|---|
| `doc-coauthoring` | 0, 5 | 설계 문서 보완, 교사용 안내서 공동 작성 |
| `frontend-design` | 3, 6 | 프로젝터용 화면 디자인(연구실 작업 노트 분위기, 큰 글씨, 대비) |
| `algorithmic-art` | 4, 6 | 녹·단청 갈라짐·깨짐 무늬 질감을 p5.js로 생성 → PNG로 저장해 내장 |
| `canvas-design` | 6 | 사건 일러스트, 증거 카드, 배지 등 정적 그림 |
| `webapp-testing` | 3~7 | Playwright E2E, 스크린샷, 외부 요청 0건 검증 |
| `docx` | 7 | AIEDAP 양식 지도안(docs/02 §5), 학습지 W1~W4 |
| `xlsx` (선택) | 7 | 수업 후 CSV → 분석용 엑셀 |
| `theme-factory` (선택) | 6 | 앱·학습지·슬라이드 색·글꼴 통일 |
| `web-artifacts-builder` (선택) | — | React로 바꾸기로 결정할 때만. 기본은 바닐라 TS |

쓰지 않는 것: `claude-api`(학생용 파일에 API 키를 넣지 않는다).

## 2. 맞춤 스킬 4개 — `skill-creator`로 만들기
아래 명세를 skill-creator에 붙여 넣는다. 저장 위치는 프로젝트(`.claude/skills/`) 또는 개인 스킬 중 선택.

### 2.1 `lesson-sw-design`
- **설명**: LDT × AIEDAP 방식으로 수업용 소프트웨어를 설계할 때 사용. 학습 문제 → 이론 → 증거 → 시나리오 → 프로토타입 → 사용성 평가 → 실행·환류.
- **담을 내용**: docs/01의 §2~§9 구조(학습 문제 가설표, 이론→기능 매핑표, AIEDAP 지도안 칸, 평가 8문항 점검, 스탠퍼드 7문항 점검), 직소 역할 설계 규칙, 결정 기록(Decision Log) 양식.
- **산출물**: `docs/01-design-rationale.md` 형식의 문서.

### 2.2 `choice-graph-scenario`
- **설명**: 선택-결과 그래프 시나리오(JSON)를 쓰거나 고칠 때 사용.
- **담을 내용**: docs/05 전체(노드 종류, flow 키워드, ✓△✕, 지연 결과, retry, 역사 합류, 단계 태그, 점수 규칙, V01~V19 검증 규칙), `data/scenario.schema.json`, 좋은 선택지 쓰기 규칙(함정은 '빠르고 깔끔해 보이는 것', ✓가 둘 이상 가능, 지연 결과는 사실 근거), 검증 스크립트 실행 방법.
- **산출물**: 검증을 통과한 `data/scenario.json`.

### 2.3 `virtual-lab-sim`
- **설명**: 초등 과학 가상 실습을 만들 때 사용.
- **담을 내용**: docs/06 §0(POE, 상태 기반 모델, 시드 재현, 빠른 모드, 대체 증거, 실물 기준 사진), 공통 `LabModule` 인터페이스, 모델 값은 '설명용 근사값' 표기 규칙, 정답이 새지 않는 UI 규칙(예측 잠금 전 결과 비노출), 큰 조작 영역(최소 64px), 단위 테스트 패턴(순서·불변식 검사).
- **산출물**: `src/labs/labN*.ts` + 단위 테스트.

### 2.4 `kr-elementary-copy`
- **설명**: 초등 고학년용 한국어 화면 문구를 쓰거나 검토할 때 사용.
- **담을 내용**: docs/09 §1~§2(문장 길이, 해요체, 한자어 풀이, 금지어, 인물 실명 금지, 과거 결정 비난 금지, 용어 사전), 검토 체크리스트.
- **산출물**: 수정 제안 표(원문 / 문제 / 고친 문장).

## 3. 서브에이전트 (`.claude/agents/`, 이 패키지에 포함)
| 파일 | 언제 | 하는 일 |
|---|---|---|
| `fact-checker.md` | 역사 사실(날짜·숫자·인과)을 추가·수정한 뒤 | `data/scenario.json`의 문장을 `history.sources`와 docs/07 출처에 대조, 근거 없는 문장 표시 |
| `kid-reader.md` | 학생 화면 문구를 추가·수정한 뒤 | 초5 독자 입장에서 어려운 낱말·긴 문장·헷갈리는 표현 지적 |

만드는 쪽과 검토하는 쪽을 분리하는 장치다. 메인 세션이 자기 결과를 스스로 채점하지 않게 한다.

## 4. 훅 예시 (Phase 1 이후 켜기)
`.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "npm run validate --silent" }
        ]
      }
    ]
  }
}
```
- `package.json`과 validate 스크립트가 생긴 Phase 1 이후에 추가한다(그 전에는 명령이 실패한다).
- E2E는 오래 걸리므로 훅에 넣지 않고 Phase 끝에 수동 실행.

## 5. 작업 순서 — Phase 0~7
각 Phase는 Plan 모드로 계획 → 승인 → 구현 → 완료 기준 확인 순서.

### Phase 0. 이해와 질문 (코드 없음)
```
CLAUDE.md와 docs/01~11, data/*.json을 모두 읽어 줘.
구현하지 말고: (1) 이해한 수업 흐름을 10줄로 요약, (2) 문서끼리 어긋나는 곳,
(3) 구현 전에 정해야 할 질문을 목록으로 보고해. README의 미결 사항 표도 확인해.
```
**완료 기준**: 질문 목록에 교사가 답함. 어긋난 곳이 문서에 반영됨.

### Phase 1. 골격
```
Vite + TypeScript(프레임워크 없음) + vite-plugin-singlefile 프로젝트를 만들어 줘.
- npm 스크립트: dev, build, validate, test, e2e
- tools/validate-scenario.mjs를 TypeScript(tools/validate-scenario.ts)로 옮기고, 앞단에 Ajv로 data/scenario.schema.json 검증을 붙여 줘
- CSP 메타 태그, 1920×1080 무대 비율 맞춤, 모드 분기(teacher/manual/print/team) 뼈대
- S00~S25 빈 화면을 →/← 로 넘길 수 있게
Plan 모드로 먼저 파일 구조를 보여 줘.
```
**완료 기준**: `npm run build` → `dist/index.html` 하나. `npm run validate` 통과. 빈 화면 전체 이동 가능. 훅 활성화.

### Phase 2. 코어 엔진 (글자 UI)
```
docs/03 §4~§7과 docs/05를 구현해 줘: store, lessonMachine, caseRunner, scoring,
logger(CSV/JSON), persistence(localStorage try/catch), keyboard, timer.
화면은 꾸미지 말고 글자와 버튼만. 연습 사건과 사건 1~5를 끝까지 진행할 수 있어야 해.
docs/10 §3.2의 단위 테스트를 함께 작성해.
```
**완료 기준**: 단위 테스트 통과. 글자 UI로 120분·80분 프로필 끝까지 진행. CSV 열이 docs/10 §1과 일치.

### Phase 3. 화면 UI
```
frontend-design 스킬과 kr-elementary-copy 스킬을 써서 docs/04의 S00~S25와 교사 패널을 만들어 줘.
docs/09의 색 토큰·기호 체계·글자 크기를 따를 것. 결과는 색+모양+글자 세 겹으로.
끝나면 webapp-testing으로 docs/10 §3.3의 1~4번 E2E를 돌려 줘.
```
**완료 기준**: E2E 1~4 통과. 1920×1080 스크린샷에서 글자 잘림 없음. kid-reader 검토 반영.

### Phase 4. 가상 실습 5종 (실습 하나씩)
```
virtual-lab-sim 스킬로 docs/06의 실습 N을 만들어 줘. data/labs.config.json의 매개변수를 쓰고,
질감이 필요하면 algorithmic-art로 PNG를 미리 만들어 assets/textures에 넣어.
실습 N의 완료 기준(docs/06)과 단위 테스트를 통과시키고 S13 화면에 연결해.
```
실습 1 → 2 → 3 → 4 → 5 순서. 실습마다 따로 커밋.
**완료 기준**: 실습별 완료 기준 + 빠른 모드 + 대체 증거 동작.

### Phase 5. 알고리즘·AI 점검·전이, manual·print 모드
```
docs/04의 S20~S23과 docs/05 §6 알고리즘 매트릭스를 만들어 줘.
manual 모드(M01·M02)와 print 모드(P01·P02)를 data/manuals.json으로 구현해.
AI 답변이 비어 있을 때 교사 패널에서 붙여넣는 기능도.
```
**완료 기준**: E2E 7~9 통과. AI 답변 없음 경고가 교사에게만 보임.

### Phase 6. 그림·디자인 다듬기
```
canvas-design으로 docs/09 §4의 에셋을 만들어 넣어 줘(실존 인물 얼굴 금지, 유명 유산은 단순화 일러스트).
접근성(대비 4.5:1, reduced-motion), 성능(dist ≤ 5MB)을 점검해.
```
**완료 기준**: 파일 크기 기준 충족, 에셋 출처 표 작성(`docs/ASSETS.md`).

### Phase 7. 전체 검증과 수업 준비물
```
webapp-testing으로 docs/10 §3.3 전체 E2E를 돌리고 실패를 고쳐 줘.
fact-checker로 data/scenario.json 전체 사실을 재검증해.
docx 스킬로 AIEDAP 지도안(docs/02 §5)과 학습지 W1~W4를 만들어 줘.
마지막으로 교사용 1쪽 안내서(키보드 단축키, 수업 전 점검표)를 만들어.
```
**완료 기준**: CLAUDE.md의 전체 완료 기준 모두 충족.
