# 몰입 확장 계획 — 연구소 탐험(`?mode=expedition`)과 4D 프레임 구조 연구실(`?mode=frame`)

작성: 2026-11-03 · 계획: Claude · 코딩: Codex · 서버: Grok(`docs/SERVER.md`)
대상 독자: Codex. 이 문서와 `frame-lab/4d-frame-spec.json`만 읽고 구현을 시작할 수 있게 썼다. 기존 `docs/IMPLEMENTATION_PLAN.md`·`PLAN_REVIEW.md`의 규칙은 그대로 유효하며, 이 문서는 **추가 범위만** 다룬다.

---

## 0. 범위와 보존 원칙

| 보존(건드리지 않음) | 추가 |
|---|---|
| `teacher`/`manual`/`print` 모드, 120·80분 프로필, S00~S25 흐름 | `?mode=expedition` 연구소 탐험(팀 기기 또는 프로젝터) |
| `data/scenario.json`의 사건·결정·결과·역사 문구(새 역사 사실 추가 금지) | `?mode=frame` 4D 프레임 구조 연구실(앱 내) + `frame-lab/` 독립 폴더(게이트 대상) |
| 저장키 `cons-lab:current`, 기존 CSV/JSON 내보내기 | 저장키 `cons-lab:expedition`, `cons-lab:frame`와 각각의 내보내기 |
| 단위 38개·E2E 17개(모두 계속 통과) | 단위·E2E 추가(§8) |
| 단일 `dist/index.html`, 외부 요청 0건, ≤ 5 MiB | Three.js 번들(MIT) 포함 후에도 같은 예산 |

**장르 변환 규칙(스킬 `classroom-exploration-game`)**: 전투·파괴·속도 경쟁·순위·채팅·이름 입력 없음. 보상은 **증거를 먼저 모았는가, 되돌릴 수 있는 최소 개입을 골랐는가**뿐이다. 탐험은 본 수업의 **선택 활동**이며 120/80분 시간표에 끼워 넣지 않는다(수업 전 예습·수업 후 팀 기기 활동·영재 심화 차시용).

**참고 관찰의 경계**: `docs/GAME_REFERENCE_OBSERVATIONS.md`의 두 게임(2D 픽셀 수학 배틀, 3D 물질 탐험대)에서 **인터페이스 패턴만** 가져온다(아바타 선택, 조이스틱/D-pad 전환, 근접 시 명시적 E/버튼, NPC 대화 패널, 현장 노트, 진행도 HUD). 세 번째 미술관 URL은 404였으므로 관찰한 것이 없고, 연구소 공간·전시실은 **전부 원본 설계**다. 코드·에셋 복사는 없다.

---

## 1. 모드와 진입·복귀

| 모드 | 진입 | 복귀 | 저장키 |
|---|---|---|---|
| `?mode=expedition` | S00(수업 준비 화면)의 버튼 **"연구소 탐험 열기"** (`labels.ts`에 라벨 추가) → 같은 탭에서 이동 | HUD 버튼 **"수업으로 돌아가기"** → `?mode=teacher`(S00이 기존 세션 이어하기 모달을 평소대로 띄움) | `cons-lab:expedition` |
| `?mode=frame` | S00의 링크 **"구조 연구실(4D 프레임)"**, 탐험 안 '구조 연구실' 스테이션의 **"전체 화면으로 열기"** | 상단 버튼 → `?mode=teacher` 또는 `?mode=expedition` | `cons-lab:frame` |
| `frame-lab/index.html`(독립) | 개발·게이트 전용. `npm run gate:frame`이 로컬 http로 띄운다 | 없음 | 같은 `cons-lab:frame` |

`src/main.ts`의 분기에 두 모드를 추가한다. 팀 기기에서 같은 `dist/index.html`을 열어도 교사 세션과 섞이지 않는다(키가 다르고, 탐험은 교사 세션을 읽지도 쓰지도 않는다).

---

## 2. 연구소 탐험 — 세계·아바타·조작

### 2.1 공간(원본 설계, 절차적 voxel/low-poly)
바닥 28×18 단위(1단위 = 1m), 실내 보존연구소. 모든 지오메트리는 Three.js `BoxGeometry`/`InstancedMesh`와 `CanvasTexture`(시스템 글꼴로 표지판 글자)로 만든다. 외부 모델·이미지 파일 없음.

| 구역 | 위치 | 눈에 띄는 표지 | 기능 |
|---|---|---|---|
| 입구·멘토 | 남쪽 중앙 | 연구실장 NPC(단색 voxel 인물, 머리 위 ‘!’) | 첫 대화, 임무 설명, 도움말 |
| 도구대 | 서쪽 벽 | 선반 위 5개 도구 블록 | 도구 5종 집기(§3.2) |
| 유산 스테이션 5 | 중앙 작업대 둘레, 시계 방향 | 사건별 상징 voxel(초록 조각상 팔, 조각난 꽃병 탁자, 진열장 속 가면, 받침 위 채색 들보, 돌 블록 탑) + 표지판(사건 제목) + 담당 연구원 NPC | 관찰→증거→처리→결과(§3) |
| 구조 연구실 | 북동쪽 방 | 책상 위 정육면체 틀 voxel, 벽에 '4D' 표지판 | `?mode=frame`와 같은 뷰어·관찰 입력(§6) |
| 전시실 | 북쪽 벽 | 액자 6개(사건 5 + 구조 1), 완성된 것은 밝게 | 전시 카드 열람 |

바닥 색 구역·표지판·NPC 머리 위 기호로 색 없이도 구분된다(결과 기호 ✓△✕는 패널에서 모양+글자).

### 2.2 아바타
시작 화면에서 **팀 번호(1~4)**와 **전문 분야(●금속 ▲유리 ■페인트 ◆접착, `scenario.experts`)**만 고른다. 아바타는 팀 색 + 분야 기호가 머리 위 표찰에 보이는 voxel 인물. 이름·닉네임 입력란 없음(CLAUDE.md 규칙 5).

### 2.3 조작
- 키보드: WASD/화살표 이동, **E** 조사(근접 시), **M** 임무 목록, **Esc** 패널 닫기. 입력칸 포커스 중엔 이동키 무시.
- 터치: 왼쪽 가상 조이스틱, 오른쪽 **큰 '조사' 버튼**(≥ 56 CSS px, 안전 영역 안), 조이스틱/D-pad 전환 토글. 터치 대상 모두 ≥ 44 px.
- 카메라: 고정 각도 3인칭 추적(요 35°, 피치 −40°), 자유 회전 없음(태블릿 단순화). 창 크기 변경 시 ResizeObserver로 재조정, pixelRatio ≤ 1.5.
- 근접(반지름 1.6m)하면 **프롬프트만** 뜨고 자동으로 열리지 않는다. 패널이 열리면 이동 정지, 닫히면 재개. `blur`·`visibilitychange`·`pointercancel`에서 누른 키·조이스틱을 모두 해제.
- 충돌: 벽·작업대·스테이션 블록의 AABB 목록(레이아웃 JSON에서 생성). 밖으로 나갈 수 없다.
- 소리 없음(기본). 넣지 않으므로 음소거 버튼도 없다. `prefers-reduced-motion`이면 NPC 흔들림·표지판 반짝임 등 주변 움직임을 끈다.

### 2.4 HUD(작게)
현재 임무 한 줄 · 증거 n/15 · 현재 구역 이름 · [임무 목록 M] [기록 내보내기] [도움말] [수업으로 돌아가기]. 점수·순위·타이머 없음.

### 2.5 DOM 임무 목록(필수, 접근성·대체 경로)
`<aside data-mission-list>`는 항상 DOM에 있다(기본 접힘, M 또는 버튼으로 열림). 스테이션마다: 이름, 상태(미조사 / 조사 중 / 전시 완료), 버튼 **[이동]**(3D 가능할 때 아바타를 스테이션 옆으로 순간이동) **[조사하기]**(패널을 바로 연다). **이동 없이 목록만으로 전체 루프를 끝낼 수 있어야 한다**. E2E도 이 경로를 주 경로로 쓴다.

### 2.6 WebGL 대체
시작 시 `WebGLRenderer` 생성을 try/catch로 감싸고 `canvas.getContext('webgl')`도 확인한다. 실패하면 캔버스를 숨기고 안내 문구(`data/expedition.json`의 `fallback.noWebGL`)와 **임무 목록을 펼친 상태**로 시작한다. 기능 차이는 '이동' 버튼이 없는 것뿐이다.

---

## 3. 완결 루프: 관찰 → 증거 기록 → 처리 선택 → 결과 → 전시 카드

### 3.1 스테이션 상태 기계(스테이션 5개 공통)
```
locked? 없음(모두 처음부터 열림, 순서 자유)
idle → observing(도구 고르기 → 증거 카드 1장 공개 → 현장 노트에 기록)
    → deciding(사건의 결정 노드를 flow 순서대로: c1d1, c1d2 …)
    → outcome(✓/△/✕ + 원칙 카드; delayed가 있으면 [시간 빨리 감기] 뒤 추가 문구)
    → (historyJoin 노드는 담당 연구원 대사로 표시) → 다음 결정 …
    → exhibit(전시 카드 생성·전시실 액자 점등) → done
```
- **증거 먼저 규칙(P1)**: 그 스테이션에서 증거를 **1장 이상 기록**하기 전에는 처리 선택 버튼이 비활성(안내 문구 표시). 3장 다 모으면 '근거 배지 3/3'.
- 결정·선택지·결과 문구·원칙·지연 결과는 **`scenario.json`의 노드를 그대로** 쓴다(`cases[].nodes`). 탐험은 `optional` 결정도 모두 진행한다(시간 압박 없음). 재선택은 없다. ✕ 뒤에도 다음 결정으로 진행한다(막다른 길 없음).
- 결과는 팀 건강도 대신 **전시 카드의 결과 칸**으로 남는다. 보상 표시는 두 가지뿐: 근거 배지(결정 전에 기록한 증거 수) · 원칙 카드(해결 결과의 `principle`).

### 3.2 도구와 증거
도구 5종(도구대에서 집음, 집으면 영구 소지): 돋보기 · 사진기 · 기록판 · 작은 시험 키트 · 부드러운 붓. 스테이션마다 증거 3장, 각 증거는 **필요 도구 1개**를 지정한다. 맞는 도구로 '살펴보기'를 누르면 증거 카드가 공개되고, [현장 노트에 기록]을 누르면 기록된다(공개와 기록을 분리해 '기록한다'는 행동을 남긴다). 틀린 도구는 "이 도구로는 보이지 않아요" 문구만(감점 없음).
- 증거 문구는 **새 역사 사실을 만들지 않는다**. 각 증거는 `sourceRef`로 `scenario.json`의 `brief.lines[i]`, `lab.fallbackEvidence`, `history.lines[i]` 중 하나를 가리키고 문구는 그 줄을 그대로 쓰거나 초5 문장으로 줄인다. 검증기가 `sourceRef`의 존재를 검사한다.
- 실습 증거(사건마다 1장)는 `lab.fallbackEvidence`를 쓴다. 가상 실습 UI 자체는 탐험에 넣지 않는다(본 수업 자산 유지, 범위 통제). 단, 모델값을 '실제 측정값'처럼 보이지 않게 `L.model` 문구를 카드 아래에 둔다.

### 3.3 전시 카드
생성 항목: 유산 이름·장소·연도(`cases[]`에서), 팀·분야 표찰, 기록한 증거 제목 목록, 결정별 선택과 결과 기호(✓△✕ + 글자), 얻은 원칙 카드, 학생 한 줄 메모(선택, ≤ 120자, 텍스트로만 렌더). 전시실 액자를 조사하면 카드가 다시 열린다. 다섯 장 + 구조 연구실 카드(§6.5)가 모이면 '연구소 발표' 패널(요약 + 내보내기 + 돌아가기).

### 3.4 NPC 대사
멘토(연구실장) 도입 3줄 + 도움말, 스테이션 담당 연구원 2줄(맥락) + historyJoin 문구(기존). 모두 `data/expedition.json`에서 읽고, 선택지는 "다음 / 나중에"뿐이다(퀴즈 NPC 금지 — 증거 조작이 핵심).

---

## 4. 콘텐츠 파일 `data/expedition.json`(새 단일 출처)
```jsonc
{
  "meta": {"version": 1, "note": "탐험 학생 문구 원본. 역사 사실은 scenario.json을 참조만 한다."},
  "intro": {"title": "...", "mentorLines": ["...", "...", "..."], "help": ["WASD/화살표로 움직여요", "..."]},
  "tools": [{"id": "lens", "label": "돋보기", "symbol": "◎", "hint": "..."} /* ×5 */],
  "zones": [{"id": "entrance", "label": "입구"} /* floor 구역 이름 */],
  "stations": [{
    "caseId": "case1", "zone": "...", "signLabel": "자유의 여신상",
    "researcherLines": ["...", "..."],
    "evidence": [{"id": "c1e1", "title": "...", "text": "...", "tool": "lens", "sourceRef": "case1.brief.lines[2]"} /* ×3 */]
  } /* ×5, caseId는 scenario.cases[].id와 일치 */],
  "frameStation": {"signLabel": "구조 연구실", "lines": ["..."], "openFull": "전체 화면으로 열기"},
  "exhibit": {"title": "전시실", "cardLabels": {"evidence": "모은 증거", "choices": "우리의 선택", "principles": "지킨 원칙", "memo": "한 줄 메모"}},
  "hud": {"mission": "지금 할 일", "evidence": "증거", "zone": "위치", "missions": "임무 목록", "back": "수업으로 돌아가기", "export": "기록 내보내기", "help": "도움말"},
  "rules": {"needEvidence": "먼저 증거를 한 장 이상 기록해요.", "wrongTool": "이 도구로는 보이지 않아요.", "noRedo": "결정은 되돌릴 수 없어요. 다음 결정으로 가요."},
  "fallback": {"noWebGL": "3D를 표시할 수 없어요. 임무 목록으로 진행해요.", "saveFailed": "..."},
  "finish": {"title": "연구소 발표", "lines": ["..."]}
}
```
- 문구는 `docs/09` 규칙(해요체, 35자 안팎). 새 문구는 **`kid-reader`** 서브에이전트 검토를 받는다. 역사 사실을 새로 쓰지 않으므로 `fact-checker`는 `sourceRef` 대조만 한다.
- `tools/validate-scenario.ts`를 확장: 스테이션 5개 = `cases` id 집합, 증거 3장씩, `tool` id 존재, `sourceRef` 경로 존재, 문구 길이 ≤ 60자(제목 ≤ 20자). `npm run validate`에 포함.
- `src/**/*.ts`에 한글 금지는 그대로(`check-hardcoded-text.mjs`). HUD 골격 라벨은 `expedition.json`의 `hud`에서 읽는다.

---

## 5. 상태·저장·내보내기(탐험)
```ts
interface ExpeditionState {
  schemaVersion: 1; startedAt: number; avatar: {team: 1|2|3|4; expert: ExpertId} | null;
  tools: string[];                       // 집은 도구 id
  stations: Record<string, {             // caseId →
    evidence: string[];                  // 기록한 증거 id(순서)
    decisions: {nodeId: string; choice: 'A'|'B'|'C'; result: ResultType; principle: string; evidenceBefore: number; at: number}[];
    cursor: number;                      // flow 안 다음 결정 인덱스
    exhibited: boolean; memo: string;
  }>;
  frameCard: {fewestBraces: number|null; note: string} | null;   // §6.5에서 cons-lab:frame을 읽어 요약
  position: {x: number; z: number};      // 3D 복원용(없어도 됨)
  log: {t: string; event: string; caseId: string; value: string}[];
}
```
- `persistence.ts`와 같은 방식: `safeGet/safeSet`, 로드 시 전체 구조 검증(알 수 없는 키·범위 밖 값이면 '저장 없음' 취급, 수업은 계속). 저장 실패는 HUD 구석 문구.
- 내보내기: JSON(전체) + CSV(`station, evidence_count, node_id, choice, result, principle, at`; UTF-8 BOM, 수식 주입 방지 `'` 접두). 파일명 `conservation-expedition_<YYYYMMDD-HHMM>.{json,csv}`.
- 초기화: 탐험 키만 지운다(이중 확인 모달). 교사 키·프레임 키는 건드리지 않는다.

---

## 6. 4D 프레임 구조 연구실(`frame-lab/` + `?mode=frame`)

### 6.1 명세(단일 출처)
`frame-lab/4d-frame-spec.json` — 설계 게이트 **통과**(`docs/FRAME_SPEC_VALIDATION.txt`). 요지:
- 역할 `structure-model`(부 역할 `design-challenge`). 기하 성질 = 삼각형 분할 유무에 따른 단단함(같은 추로 당겼을 때 윗면 밀림 cm).
- 조립물 `cradle`: 7cm 봉 12개 정육면체 틀(한 변 중심 간 8cm) + 10cm 봉 6개 면 대각선(8√2 ≈ 11.3cm, 허용 ±1cm 안). 꼭짓점 8 = 6발 연결발 4(B0·B2·T1·T3, 사면체 꼴로 마주 봄) + 3발 연결발 4. 봉 순서 = 조립 순서, `steps[].edgesAfter` 4→8→12→14→16→18.
- 조작 M1: 대각선 0·2·4·6개 × 3회 밀림 거리(cm). M2: 6개에서 하나씩 빼며 1cm 미만을 지키는 최소 봉 수·자리 찾기, 종이 모형 유물 손상·복원 확인. 40분, 손에 쥔 시간 70%.
- 안전: 열원 없음(플라스틱 봉은 불꽃·열원 근처 금지 명시), 실제 유물 금지(종이 모형만), 추는 교사가 총질량 50g 이하 확인 + 추 받침(낙하 2cm 이하), 연필 테이프 고정, 당기는 방향 +x(바닥 변 B0→B1과 평행)로 고정. 한계에 「밀림 1cm 미만」은 수업 비교 기준이지 유물 안전 기준이 아님을 명시.
- **좌표·부품·단계를 코드에 다시 적지 않는다.** 뷰어와 안내서 모두 이 파일을 읽는다.

### 6.2 폴더(게이트 대상 = 이 폴더 하나) — 2026-11-03 14:06 Codex가 이미 만든 배치를 기준으로 확정
```
frame-lab/
├─ 4d-frame-spec.json      (완료, 수정 시 validate 재실행 → docs/FRAME_SPEC_VALIDATION.txt 갱신)
├─ index.html              독립 실행 페이지: loadSpec('./4d-frame-spec.json') → mountFrameLab(...)
├─ frame-viewer.js / .css  시작 틀 복사(계약 표식 유지). 변경은 pointercancel·lostpointercapture 해제처럼 최소
├─ frame-app.js / .d.ts / .css  예상 잠금 → 관찰 입력표(M1 4조건×3회, M2 행 추가) → 저장(cons-lab:frame) → JSON 내보내기 → 초기화(2단계 확인)
└─ teacher-guide.md        부품표(7cm 봉 14, 10cm 봉 8, 3발 연결발 5, 6발 연결발 5, 추가 준비물), 40분 흐름, 안전, 한계 — 명세와 같은 숫자
```
결정: 뷰어는 **CSS 3D**(시작 틀), 명세 `app.viewer="css3d"`. 의존성 없이 독립 폴더가 그대로 게이트를 통과하고 같은 모듈을 주 앱이 import해 재사용한다. Three.js는 탐험 세계에만 쓴다. 독립 페이지는 `fetch`를 쓰므로 `file://`에서는 열리지 않는다(개발·게이트 전용). 교실에서는 `dist/index.html?mode=frame`를 쓴다.

### 6.3 뷰어 확장(시작 틀 계약 유지)
계약 표식 유지: `data-4d-viewer`, `data-4d-build`, `data-4d-edges`, `data-4d-step`(단계마다), `data-4d-next-step`, `data-4d-kit`. 추가:
1. **보강 단계 버튼** `braceStages`(0·2·4·6) — 누르면 해당 `edgesAfter`로 `setStep` 동기화(대각선만 켜고 끄는 보기). 대각선 봉은 노랑, 틀 봉은 파랑(명세 `color`).
2. **관찰 입력표**(`app.observationForm`): M1 4조건 × 3회 숫자 입력(0~10, 0.5 단위) + 평균은 학생이 입력한 뒤에만 계산 표시, M2 행 추가(뺀 면·남은 봉 수·밀림 cm·유물에 닿은 봉 수·손상 여부·복원 여부). **예상 칸**(M1·M2 `prediction`)은 측정 칸 위에 있고, 예상을 저장하기 전에는 측정 칸이 잠긴다(예상 먼저).
3. 표 위 고정 문구: 명세 `limits[0]`("화면은 흔들림을 계산하지 않아요…")를 그대로 표시. 화면 어디에도 모의 밀림 값·애니메이션 흔들림을 넣지 않는다.
4. 저장: `cons-lab:frame`(try/catch, 구조 검증). 내보내기 CSV(`manip, condition, trial, value, …`) + JSON.
5. 독립 페이지와 주 앱(`src/modes/frame.ts`, 탐험 '구조 연구실' 패널)은 **같은 `mountFrameLab(root, spec, backHref)`**를 부른다. 뷰어 기하는 `mountFrameViewer`만 그린다.
6. 1번 보강 단계 버튼은 **권장**(게이트 필수 아님). 2~5번과 CSV 내보내기(현재 JSON만 있음)는 필수.

### 6.4 주 앱 연동
- `src/modes/frame.ts`: `import spec from '../../frame-lab/4d-frame-spec.json'`(resolveJsonModule) + `import {mountFrameLab} from '../../frame-lab/frame-app.js'`(`frame-lab/frame-app.d.ts` 선언, CSS 두 파일 import). Vite가 단일 파일에 번들하므로 런타임 fetch 없음. 상단에 단원 제목·돌아가기 버튼·한계 목록(`spec.limits`).
- `frame-viewer.js`·`frame-app.js`는 `src/` 밖이므로 한글 검사 대상이 아니다. 그 안의 골격 라벨은 독립 페이지와 공유하므로 허용한다(결정). 단, 학생 문구(예상·관찰 안내)는 명세 필드에서 읽고 JS 안에 새 문장을 늘리지 않는다.
- 탐험의 '구조 연구실' 스테이션 패널은 같은 `mountFrameViewer`를 패널 안에 마운트한다(저장키 공유).

### 6.5 구조 연구실 카드
`cons-lab:frame`의 M2 행 중 `shiftCm < 1 && !modelDamaged && restoredShape`인 최소 `diagonalsLeft`를 전시 카드 "가장 적은 보강 n개"로 적는다. 값이 없으면 "아직 측정 전". 화면이 값을 추정하지 않는다.

### 6.6 게이트 실행과 보고(완료 조건)
```
# 설계 게이트(완료) — 명세를 고칠 때마다
node ~/.codex/skills/inquiry-science-webapp/scripts/4d/validate-frame-spec.mjs frame-lab/4d-frame-spec.json > docs/FRAME_SPEC_VALIDATION.txt
# 결과물 게이트 — frame-lab/ 완성 후, 브라우저 검사 포함
PLAYWRIGHT_CORE=$PWD/node_modules/playwright-core/index.mjs \
node ~/.codex/skills/inquiry-science-webapp/scripts/4d/gate.mjs frame-lab --json output/frame-gate.json | tee docs/FRAME_GATE_REPORT.txt
```
`npm run gate:frame`로 두 번째 명령을 감싼다(스킬 경로는 `FRAME_GATE_DIR` 환경변수로 바꿀 수 있게). **`판정: PASS`(종료 0)**가 아니면 완료가 아니다. 종료 3(브라우저 미실행)도 미완료. 통과 뒤 **만들지 않은 새 에이전트**에 `references/4d-review-rubric.md` + `frame-lab/`만 주어 판정 JSON을 `docs/FRAME_REVIEW.json`에 그대로 저장한다(편집 금지).
정적 검사 주의: 게이트는 `frame-lab/` 안 텍스트 파일(명세 제외)에서 `7cm`·`10cm`·`3발 연결발`·`6발 연결발`을 찾는다. `teacher-guide.md`에 이 표기가 있어야 한다.

---

## 7. 기술 결정
| 항목 | 결정 |
|---|---|
| 3D 라이브러리 | `three`(npm, MIT) 최신 안정판을 `dependencies`에 추가. `three/src/...` 개별 import로 트리셰이킹. 예상 증가 ≈ 0.6~0.9 MB → dist 약 1.2 MB(예산 5 MiB) |
| 렌더 루프 | 모듈 `src/modes/expedition/world.ts` 하나의 `requestAnimationFrame`. 나가기(돌아가기 버튼·`pagehide`)에서 RAF 취소, 리스너 해제, `geometry/material/texture.dispose()`, `renderer.dispose()` |
| 파일 구조 | `src/modes/expedition.ts`(진입) + `src/expedition/{state.ts(순수 리듀서), world.ts(three), layout.ts(구역·AABB·스테이션 좌표), controls.ts, panels.ts, missionList.ts, export.ts}`, `src/modes/frame.ts`, `frame-lab/frame-app.d.ts` |
| CSP | 기존 유지(`connect-src 'none'`). CanvasTexture·blob 다운로드는 허용 범위 |
| 글꼴 | 표지판 캔버스 글자는 시스템 한글 글꼴. 글꼴 파일 내장 없음 |
| 영상·AI | 탐험·프레임에서 쓰지 않음 |
| 기존 코드 | `src/core`·`labs`·`teacher.ts`는 S00 버튼·링크 추가 외 수정하지 않는다 |

---

## 8. 테스트 계획(추가분)
**단위(Vitest)** `tests/unit/expedition.test.ts`, `frame.test.ts`
1. 증거 0장이면 `decide` 액션 거부, 1장 이상이면 허용. `evidenceBefore`가 기록된다.
2. 결정 순서가 `cases[].flow`의 decision 순서와 같고 historyJoin을 건너뛰지 않는다. ✕ 결과 뒤에도 `cursor`가 전진한다.
3. 전시 카드 생성값(결과 기호·원칙)이 `scenario.json` 노드와 일치. 5개 사건 × 모든 선택지(35 결과) 순회.
4. 저장 검증: 알 수 없는 키·범위 밖 값·프로토타입 키 거부, 정상값 통과. 가져오기 원자성.
5. `layout.ts`: AABB 충돌 함수, 스테이션 반지름 판정, 모든 스테이션이 바닥 안·벽 밖.
6. 프레임: `braceStages[].edgesAfter = 12 + diagonals`, 명세 `edges[12..17]`가 모두 `r10`, 관찰 입력 검증(0~10, 0.5 단위, 예상 전 측정 잠금), 카드 요약(§6.5).

**E2E(Playwright)** `tests/e2e/expedition.spec.ts`, `frame.spec.ts` (기존 `helpers.ts`의 `open`·외부 요청 수집 재사용; Chromium 인자 `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`)
1. 탐험 시작 → 팀·분야 선택 → 임무 목록만으로 case1 루프 완주(도구 집기 → 증거 3장 기록 → 결정 2개 → 전시 카드) → `cons-lab:expedition` 저장, `cons-lab:current` 미생성.
2. 키보드 이동: HUD `data-pos`가 W 500ms 뒤 바뀜 → 스테이션 근접 프롬프트 → E로 패널 → 패널 열린 동안 W로 위치 불변 → Esc.
3. 터치: CDP 터치로 조이스틱 끌기 → 위치 변화, '조사' 버튼 탭 → 패널.
4. 5스테이션 모든 선택지: 임무 목록 경로로 각 결정의 A/B/C를 순회해 35개 결과 문구 모두 표시(막다른 길 없음, ✕ 뒤 진행).
5. WebGL 차단(`addInitScript`로 `HTMLCanvasElement.prototype.getContext`가 webgl에 null) → 대체 문구 + 임무 목록 펼침 + 1번 루프 완주.
6. 새로고침 후 이어짐, JSON/CSV 내려받기 내용 검증, 초기화가 탐험 키만 지움.
7. 돌아가기 → `?mode=teacher` S00, 미리 심어 둔 교사 세션 그대로.
8. 외부 요청 0건, 페이지 오류 0건, 1280×720·1920×1080에서 HUD·패널 넘침 없음, reduced-motion에서 주변 애니메이션 없음.
9. `?mode=frame`: `[data-4d-viewer]` 존재, `data-4d-step` ≥ 3, next-step으로 `data-4d-edges` 증가, `[data-4d-kit]`에 `7cm`·`10cm`, 드래그로 회전(변환값 변화), 예상 저장 전 측정 잠금, 값 입력 → 새로고침 유지 → CSV.
10. S00에 탐험 버튼·프레임 링크가 있고 기존 17개 E2E가 그대로 통과.

**게이트**: `npm run gate:frame` PASS + 독립 검토(§6.6).

---

## 9. 수용 기준(Definition of Done, 구현자가 체크)
- [ ] A1 `npm test`·`npm run build`·`npm run e2e`·`node tools/check-hardcoded-text.mjs` 모두 통과, 기존 38 단위·17 E2E 포함.
- [ ] A2 `dist/index.html` 단일 파일 ≤ 5 MiB, CSP 유지, 런타임 외부 요청 0건(E2E 8).
- [ ] A3 `?mode=expedition`: 팀·분야 선택 → 5스테이션 모두 **관찰→증거 기록→처리 선택→결과→전시 카드** 완주 가능(3D 경로와 임무 목록 경로 둘 다).
- [ ] A4 증거 1장 이상 기록 전 처리 선택 불가, ✕ 결과 뒤에도 진행, 재선택 없음, 점수·순위·타이머·이름 입력 없음.
- [ ] A5 WASD/화살표·터치 조이스틱·E/조사 버튼 동작, 패널 열림 시 이동 정지, blur/visibilitychange/pointercancel에서 입력 해제.
- [ ] A6 WebGL 불가 시 임무 목록만으로 A3 완주.
- [ ] A7 `cons-lab:expedition`·`cons-lab:frame`만 쓰고 `cons-lab:current`를 읽거나 쓰지 않음. 새로고침 복원, JSON/CSV 내보내기, 초기화 범위 분리.
- [ ] A8 S00 버튼으로 탐험 진입, HUD 버튼으로 수업 복귀, 교사 세션 보존.
- [ ] A9 `data/expedition.json`이 학생 문구의 단일 출처. `npm run validate`가 스테이션·도구·`sourceRef`를 검사. 새 문구 kid-reader 검토 기록(`docs/EXPEDITION_COPY_REVIEW.md`).
- [ ] A10 `frame-lab/`가 `gate.mjs` **PASS**(`docs/FRAME_GATE_REPORT.txt`), 독립 검토 JSON(`docs/FRAME_REVIEW.json`) 원문 저장.
- [ ] A11 `?mode=frame`와 탐험 '구조 연구실'이 `frame-lab/frame-viewer.js`·`4d-frame-spec.json`을 **그대로 import**(좌표·부품·단계를 코드에 재기술하지 않음). 부품표·단계·보강 0/2/4/6 전환·관찰 입력·저장·내보내기 동작.
- [ ] A12 프레임 화면 어디에도 모의 밀림 값·흔들림 애니메이션이 없고, `limits[0]` 문구가 표에 붙어 있다. 예상 저장 전 측정 칸 잠금.
- [ ] A13 1920×1080·1280×720·태블릿 가로(1024×768)에서 HUD·패널·입력표 글자 잘림 없음. reduced-motion 준수.
- [ ] A14 나가기 시 RAF·리스너·GPU 자원 해제(돌아가기 2회 반복 후 콘솔 오류 0, 메모리 증가 없음을 수동 확인하고 보고).
- [ ] A15 `docs/TEACHER_GUIDE.md`에 '연구소 탐험'·'구조 연구실' 절 추가(준비물은 `frame-lab/teacher-guide.md`를 가리킴), `docs/DOD_REPORT.md`에 추가 검증 결과를 **실측 수치로** 덧붙임.

---

## 10. 단계(순서 고정)
| 단계 | 산출물 | 완료 기준 |
|---|---|---|
| F1 프레임 독립 폴더 | `frame-lab/index.html·frame-viewer.js·css·teacher-guide.md`, `npm run gate:frame` | §6.6 PASS + 독립 검토 저장(A10). **탐험 코드보다 먼저** |
| F2 프레임 앱 연동 | `src/modes/frame.ts`, S00 링크, 단위·E2E 9 | A11·A12 |
| E1 탐험 데이터·리듀서·DOM 루프 | `data/expedition.json`, validate 확장, `state.ts`, `missionList.ts`, `panels.ts`(3D 없이 완주 가능) | 단위 1~4, E2E 1·4·5·6·7, kid-reader 검토 |
| E2 3D 세계·조작 | `world.ts`, `layout.ts`, `controls.ts`, HUD, WebGL 대체 | E2E 2·3·5·8, A5·A6·A14 |
| E3 전시실·구조 연구실 스테이션·마무리 | 전시 카드, frameCard, 연구소 발표, 내보내기 | A3·A7, 단위 6 |
| E4 마감 | 레이아웃·reduced-motion·문서·DoD 보고 | A1·A2·A13·A15 |

각 단계는 커밋 단위. 데이터 변경 커밋은 `[content]` 접두사.

---

## 11. 미결 사항(기본값으로 진행)
| # | 항목 | 기본값 | 바꾸면 |
|---|---|---|---|
| X01 | 탐험을 언제 쓰나 | 본 수업 밖 선택 활동(팀 기기·심화 차시). 120/80분 시간표 불변 | 시간표에 넣으려면 `scenario.profiles` 수정 → 별도 계획 |
| X02 | 탐험 안 가상 실습 | 넣지 않음. 실습 증거는 `lab.fallbackEvidence` 카드 | 넣으면 `labHost` 재사용 설계 필요 |
| X03 | 재선택 | 없음(결정은 되돌릴 수 없음) | 본 수업처럼 1회 허용 시 리듀서·카드 수정 |
| X04 | 소리 | 없음 | 넣으면 사용자 제스처 뒤 시작 + 음소거 버튼 필수 |
| X05 | 카메라 회전 | 고정 각도 | 자유 회전 시 터치 오른쪽 드래그 추가 |
| X06 | 4D 뷰어 기술 | CSS 3D(시작 틀) | Three.js로 바꾸면 독립 폴더에 three 번들 복사 필요(게이트는 both 허용) |
| X07 | 4D 과학 성취기준 코드 | 실과 6실05-01만 확정, 과학 코드는 교사 확정 | `unit.standards`만 수정 |
| X08 | 연결발 각도 | 6발(60°)·3발(120°)을 휘어 90°/45°에 맞춤. 학교 세트로 교사 확인 | 4발·5발 세트면 명세 `connectors` 교체 → validate 재실행 |
| X09 | 추 질량 | 총질량 50g 이하를 교사가 저울로 확인(동전 종류별 무게 차이 때문에 개수로 정하지 않음). 0개 조건에서 밀림이 너무 작거나 크면 50g 이내에서 조정(모든 조건 동일 유지) | 명세 `extras`·`controlled`·`safety.rules` 수정 → validate 재실행 |
| X10 | 독립 `frame-lab` 교실 사용 | 안 함(게이트·개발 전용) | 교실용이면 명세를 `<script type="application/json">`으로 인라인하는 빌드 단계 추가 |
| X11 | 팀 기기 동기화 | 없음(기기마다 독립 저장, 교사가 CSV 수합) | 서버 필요 → 범위 밖 |
| X12 | Playwright 경로 | `node_modules/playwright-core/index.mjs`(설치 확인됨) | 없으면 `npx playwright install chromium` 후 재실행 |
