# 보존과학자의 하루 — 오프라인 수업 웹앱

Vanilla TypeScript/Vite로 구현한 교사용 수업 앱이다. 코딩은 Codex, 계획은 Claude, 개발 서버 운영은 Grok이 담당한다. 아래 설계 자료와 초기 이관 절차는 원본 맥락으로 보존한다. 외부 플러그인을 설치할 필요는 없다.

`npm run package:classroom` 후 **`classroom/index.html`을 열면 오프라인 수업을 진행할 수 있다**(같은 폴더의 `video/`에 아침 영상). 영상 없이 쓰려면 `npm run build` 후 `dist/index.html` 하나만 열어도 된다. 기본 교사 모드, `?mode=manual&expert=metal` 전문가 모드, `?mode=print` 인쇄 모드를 지원한다. 다른 전문 분야는 `glass`, `paint`, `adhesive`다.

- **재설계(우선 적용): [docs/12-redesign.md](docs/12-redesign.md)** — 하루 서사, 알고리즘 귀납, 학생이 만드는 선택 그래프 프로그램. 미결 사항은 그 문서 §12
- 교사 안내: [docs/TEACHER_GUIDE.md](docs/TEACHER_GUIDE.md)
- 실행·검증 명령: [docs/RUNNING.md](docs/RUNNING.md)
- 현재 서버 운영: [docs/SERVER.md](docs/SERVER.md)
- 지도안: [docs/LESSON_PLAN.md](docs/LESSON_PLAN.md)
- 검증 결과: [docs/DOD_REPORT.md](docs/DOD_REPORT.md)

의존성은 `npm ci`로 설치한다. 검증 명령은 `npm run typecheck`, `npm run validate`, `npm test`, `npm run build`, `npm run e2e`다. E2E는 파일을 직접 열며 서버를 중복 기동하지 않는다. 영상 URL·실제 AI 캡처는 교사가 입력해야 한다.

## 한 문단 요약
초등 5학년 영재 16명이 '보존과학자'가 되어 2시간 동안 실제 역사 사례 5개(자유의 여신상, 포틀랜드 꽃병, 투탕카멘 가면, 숭례문 단청, 미륵사지 석탑)를 해결한다. 학생들은 직소 구조로 금속·유리·페인트·접착 전문가가 되고, 교사 1명이 조작하는 웹앱에서 사건마다 **예측 → 가상 실습 → 팀별 선택 → 결과(✓/△/✕) → 실제 역사 공개**를 거친다. 마지막에 다섯 사건의 선택을 겹쳐 '보존과학자의 알고리즘'을 스스로 찾아내고, 그 알고리즘으로 생성형 AI의 답을 점검한 뒤, 자기가 고른 문화유산에 적용한다.

## 폴더 구성
```
conservation-lab-blueprint/
├─ CLAUDE.md                         Claude Code 프로젝트 지침(절대 규칙·스택·DoD)
├─ README.md                         이 문서
├─ docs/
│  ├─ 01-design-rationale.md         학습 문제, 이론, LDT×AIEDAP 근거, 결정 기록, 점검표
│  ├─ 02-lesson-flow-and-assessment.md  120/80분 시간표, 직소 운영, 지도안, 평가
│  ├─ 03-architecture.md             모드, 상태 모델, 상태 기계, 모듈 구조, 저장, 키보드
│  ├─ 04-screens.md                  화면별 명세(와이어프레임)
│  ├─ 05-choice-graph-engine.md      선택-결과 그래프 엔진, 점수, 알고리즘 매트릭스, 검증 규칙
│  ├─ 06-virtual-labs.md             가상 실습 5종 명세
│  ├─ 07-content-cases.md            사례 5개 + AI 점검 + 전이: 사실·출처·교사 노트
│  ├─ 08-expert-manuals.md           전문가 매뉴얼 4종 구조와 퀴즈
│  ├─ 09-copy-and-visual-style.md    초5 문구 규칙, 용어, 시각 디자인, 에셋 목록
│  ├─ 10-logging-and-testing.md      기록 스키마, 테스트 계획, 수업 전 점검표
│  └─ 11-skills-and-workflow.md      스킬, 서브에이전트, 훅, Phase 0~7 프롬프트
├─ data/
│  ├─ scenario.schema.json           시나리오 JSON 스키마
│  ├─ scenario.json                  프로필·원칙·사례 5개·AI 점검·전이·성찰 (학생 화면 문구 원본)
│  ├─ manuals.json                   전문가 매뉴얼 4종 + 퀴즈
│  └─ labs.config.json               가상 실습 모델 매개변수
├─ tools/
│  └─ validate-scenario.mjs          그래프 규칙 검증 참조 스크립트(의존성 없음)
└─ .claude/agents/
   ├─ fact-checker.md                역사 사실 검증 서브에이전트
   └─ kid-reader.md                  초5 독자 검토 서브에이전트
```

## Claude Code에서 시작하는 법
1. 이 폴더를 새 저장소 루트로 복사하고 `git init`.
2. 공식 스킬 설치:
   ```
   /plugin marketplace add anthropics/skills
   /plugin install example-skills@anthropic-agent-skills
   /plugin install document-skills@anthropic-agent-skills
   ```
3. 맞춤 스킬 4개 만들기: `docs/11` §2의 명세를 붙여 넣고 `skill-creator`로 생성.
4. Claude Code 첫 프롬프트:
   ```
   CLAUDE.md와 docs/01~06을 읽고, docs/11의 Phase 0을 진행해 줘.
   구현을 시작하지 말고, 이해한 내용과 모호한 점을 목록으로 먼저 보고해.
   ```
5. 이후 `docs/11` §5의 Phase 1~7 프롬프트를 순서대로 쓴다.

## 미결 사항 — 수업 전에 교사가 정할 것
| 항목 | 현재 가정 | 바꾸면 생기는 영향 |
|---|---|---|
| 수업 길이 | **120분 연속(기본)**. 80분(40분×2차시) 프로필도 함께 설계 | 시작 화면에서 프로필만 고르면 됨 |
| 학생 기기 | 전문가 모임용 기기 4대 이상 → `manual` 모드(QR) | 없으면 `print` 모드로 매뉴얼 인쇄 |
| 도입 영상 | 국립문화재연구소 '온라인 생생보존처리데이'(2020) 등 | 수업 전 게시 여부 확인, 링크를 `scenario.json`의 `video`에 입력 |
| AI 답변 캡처 | 비어 있음 | 수업 전 실제 생성형 AI에 `aiCheck.promptToAsk`를 묻고 날짜·모델명과 함께 입력 |
| 실물 기준 사진 | 없음(선택) | 실습 1·4를 실제로 한 번 해 보고 사진을 `assets/pilot/`에 넣으면 시뮬레이션 옆에 표시 |
| 숭례문 단청 현황 | 2022년 보도 기준 '아직 재시공 못 함' | 수업 직전 최신 보도 확인 후 `case4.history` 마지막 줄 수정 |
| 성취기준 코드 | 실과 [6실05-01]만 확정(교사 제공 자료 기준) | 사회·과학 연계 코드는 2022 개정 5~6학년군에서 교사가 확정 |
| AIEDAP 수업 유형 칸 | 'AI 내용요소 연계형' 권장 | 'AI 프로그램 개발'로 쓰려면 전이 활동(학생이 선택 그래프 설계·검증)을 근거로 제시 |
