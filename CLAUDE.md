# 보존과학자의 하루 — 초5 영재 2시간 교사용 웹앱

## 이 저장소는 무엇인가
- 교사 1명이 프로젝터로 조작하는 **오프라인 단일 HTML 웹앱**이다.
- 학생 16명(직소 구조: 전문가 4분야 × 본 팀 4개)이 실제 역사 사례 5개를 **선택-결과 그래프**로 해결한다.
- 사례마다 **가상 실습**(증거 수집)을 거쳐 선택하고, 마지막에 다섯 사건을 겹쳐 **보존과학자의 알고리즘**을 스스로 도출한다.
- 설계 문서는 `docs/`에 번호 순서대로 있다. 구현 전에 `docs/01`~`docs/06`을 반드시 읽는다.
- **재설계(`docs/12-redesign.md`)가 `docs/01`~`docs/11`보다 우선한다.** 하루 서사, 원칙 숨기기(귀납), 선택 그래프 프로그램 편집기(소프트웨어 개발형), 탐험·4D 프레임 분리가 여기 정해져 있다. 작업 순서는 `docs/12` §11의 Phase R0~R6을 따른다.
- **콘텐츠의 단일 출처(source of truth)는 `data/*.json`**이다. 학생 화면 문구를 코드에 하드코딩하지 않는다.

## 절대 규칙
1. **오프라인**: 런타임 외부 네트워크 요청 0건. 모든 라이브러리·글꼴·이미지는 번들에 내장한다. 예외는 ② 보존과학자 영상 4편(유튜브, 교사가 눌러 새 탭으로 열기)뿐이다. 앱 안에 임베드하지 않는다.
2. **결과물**: `npm run build` → `dist/index.html` 단일 파일(vite-plugin-singlefile).
3. **모드**(URL 쿼리):
   - `?mode=teacher` (기본) — 프로젝터용: 시작 → ① 아침 영상 → ② 유튜브 영상 4편 → ③ 전문가 4분야 → ④ 역할 변신(?mode=roles) → ⑤ 3D 미션으로 이어진다(2026-11-04 수업 흐름 단순화: 연구 일지 벽·알고리즘·프로그램 만들기·AI 점검 화면은 삭제, 커밋 2bfc353까지 남아 있음)
   - `?mode=manual&expert=metal|glass|paint|adhesive` — 학생 기기용 전문가 매뉴얼 + 미니 퀴즈
   - `?mode=print` — 매뉴얼·학습지 인쇄용(학생 기기가 없을 때)
   - `?mode=roles` — 역할 변신 갈래길: 기록·분석·재료·되돌리기 웹툰 4컷 → 퀴즈 → 변신. 데이터는 `data/roles.json`
   - RPG(모든 3D 화면 공통): 스승님·길가 동물 대화(클로즈업), 능력치·경험치·레벨, 도구 장착(가방 I). 데이터는 `data/rpg.json`. 확률은 도구 찾기에만 쓰고 역사 결과에는 쓰지 않는다
   - `?mode=games` — 훈련장 미니게임 6개 × 3단계(운반·녹 찾기·사진 기록·습도·떼기·돌탑 기록). 3단계는 장착한 도구나 능력치가 있어야 깰 수 있다(`need`). 데이터는 `data/games.json`. 등급(별 5개)은 `data/ranks.json`
   - `?mode=mission` — 3D 미션(사건 목록 → `&case=case1~5`). 사건 → 장소(조이스틱으로 걷기) → 단서 → 매뉴얼·연구 일지 카드로 풀기 → 결정. 데이터는 `data/missions.json`
   - `?mode=team&team=1..4` — (P2, 선택) 팀 기기용 실습 샌드박스. 교사 화면과 동기화하지 않는다.
4. **AI 호출 금지**: API 키를 넣지 않는다. 'AI 조수 점검' 화면은 교사가 수업 전에 실제 생성형 AI에서 캡처해 넣은 텍스트(`data/scenario.json` → `aiCheck.capturedAnswers`, 또는 교사 패널에서 붙여넣기)만 보여준다.
5. **개인정보 저장 금지**: 학생 이름을 입력받지 않는다. 팀 번호(1~4)와 전문 분야만 기록한다.
6. **이미지**: 직접 그린 일러스트(SVG/Canvas/생성 질감) 또는 공공누리 제1유형 + 출처 표기만 쓴다. 실존 인물 사진 금지. 박물관 소장품 사진 무단 사용 금지.
7. **색만으로 구분하지 않는다**: 결과는 ✓(원)·△(세모)·✕(가위표) 모양과 글자를 함께 쓴다.
8. **브라우저 기본 대화상자 금지**: `alert/confirm/prompt`는 클리커 진행을 막는다. 앱 내 모달을 쓴다.
9. **localStorage**는 항상 try/catch로 감싸고, 실패해도 수업은 계속된다.
10. **용어**: '문화재' 대신 '국가유산/문화유산'. 학생 화면 문구는 `docs/09` 규칙(초5 어휘, 해요체)을 따른다.
11. **실습 모델 값은 설명용 근사값**이다. 학생 화면에서 '실제 측정값'처럼 보이게 하지 않는다(교사 패널에 명시).

## 기술 스택
- Vite + TypeScript, **프레임워크 없음**(바닐라 DOM + 작은 상태 저장소). React가 꼭 필요하면 Plan 모드에서 근거를 쓰고 승인받는다.
- 테스트: Vitest(엔진·실습 모델 단위), Playwright(E2E), Ajv(스키마 검증).
- 번들에 내장할 라이브러리: `d3-delaunay`(보로노이 조각), `qrcode-generator`, `seedrandom`. 차트는 직접 SVG로 그린다.
- 글꼴: 시스템 한글 글꼴 우선(`"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`). Pretendard를 내장하면 OFL 라이선스 파일을 함께 넣고 서브셋한다.

## 명령(Phase 1에서 만든다)
```
npm run dev        # 개발 서버
npm run build      # dist/index.html 단일 파일
npm run validate   # data/*.json 스키마 + 그래프 규칙 검증 (tools/validate-scenario.mjs 기반)
npm test           # Vitest
npm run e2e        # Playwright (VITE_EXTRAS=1이면 탐험·4D E2E 포함)
npm run build:extras       # 탐험·4D 프레임 심화 모드까지 번들
npm run package:classroom  # classroom/ = index.html + video/
npm run deploy:railway     # classroom 빌드를 Railway(conservation-lab)에 올린다 → https://conservation-lab-production.up.railway.app (영상 원본 output/seedance-remake/가 이 컴퓨터에 있어야 함)
```

## 작업 방식
- 진행 순서는 `docs/11-skills-and-workflow.md`의 Phase 0~7을 따른다. Phase마다 완료 기준(DoD)을 확인하고 다음으로 넘어간다.
- 기능 하나를 시작하기 전에 Plan 모드로 상태 모델과 화면 흐름을 먼저 합의한다.
- `data/*.json`을 고치면 `npm run validate`가 통과해야 한다.
- 학생 화면 문구를 추가·수정하면 `kid-reader` 서브에이전트로 검토한다.
- 역사 사실(날짜·숫자·인과)을 추가·수정하면 `fact-checker` 서브에이전트로 출처와 대조한다.
- 모르는 것은 추측하지 말고 `README.md`의 '미결 사항' 표에 적고 교사에게 묻는다.

## 전체 완료 기준(Definition of Done)
- 120분·80분 두 프로필 모두 **키보드(또는 클리커)만으로** 처음부터 끝까지 진행된다.
- 다섯 사건의 **모든 선택 경로**가 E2E로 통과하고, 막다른 길이 없다(✕ 결과 뒤에도 다음 단계로 진행).
- 1920×1080과 1280×720에서 글자가 잘리지 않는다.
- 새로고침 후 이어하기, CSV/JSON 내보내기가 동작한다.
- Playwright에서 외부 네트워크 요청이 0건이다.
- `dist/index.html` 크기 ≤ 5 MB.
