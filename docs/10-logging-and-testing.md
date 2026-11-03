# 10. 기록과 테스트

## 1. 이벤트 로그 → CSV
파일 이름: `conservation-lab_<YYYYMMDD-HHMM>_<profile>.csv` (UTF-8 BOM 포함, 엑셀에서 한글 깨짐 방지)

| 열 | 예시 | 설명 |
|---|---|---|
| `t` | 2026-11-10T10:42:13+09:00 | 이벤트 시각 |
| `elapsed_s` | 2533 | 수업 시작 후 초 |
| `phase` | CASE | 수업 단계 |
| `case_id` | case1 | |
| `node_id` | c1d2 | 결정·결과 노드 |
| `event` | vote | phase_enter / prediction / lab_metric / vote / decision / outcome / delayed_shown / retry / history_shown / algorithm_note / ai_check / export / skipped |
| `team` | 3 | 1~4, 반 전체면 비움 |
| `value` | B | 예측·선택·측정값 |
| `reasons` | lab;P2 | 근거 태그(세미콜론) |
| `result` | solved | solved / worse / irreversible |
| `health_after` | 10 | 그 팀의 해당 사건 건강도 |
| `step` | rootCause | 결정의 단계 태그 |
| `planned_s` / `actual_s` | 90 / 124 | 단계 계획·실제 시간(phase_enter 때) |
| `note` | | 교사 메모 |

학생 이름은 어디에도 없다. JSON 내보내기는 `AppState` 전체 + 로그(복원용).

## 2. 수업 후 분석 가이드(교사용)
| 질문 | 볼 데이터 | 학습 문제 |
|---|---|---|
| 예측이 실습으로 바뀌었나? | prediction vs lab_metric(팀별 적중) | H2 |
| 근거를 달고 선택했나? | vote의 reasons 비율, 사건이 지날수록 늘었나 | H2 |
| 같은 원칙을 뒤 사건에서 다시 지켰나? | step별 팀 결과의 변화(사건 순서대로) | H4 |
| AI 답을 점검했나? | ai_check 체크 결과 | H3 |
| 시간표는 맞았나? | planned_s vs actual_s | 운영 |
→ W1(전)·W3(후) 학습지 비교와 함께 루브릭(docs/02 §6) 판정에 쓴다.

## 3. 자동 테스트
### 3.1 콘텐츠 검증 (`npm run validate`)
- Ajv: `data/scenario.json` ↔ `data/scenario.schema.json`.
- 그래프 규칙 V01~V19(docs/05 §7): `tools/validate-scenario.mjs`를 TypeScript로 옮겨 확장.
- `data/manuals.json`: 분야 4개, 퀴즈 3문항, `answer`가 options 범위 안.
- `data/labs.config.json`: 실습 ID 5개, 숫자 범위.

### 3.2 단위 테스트 (Vitest)
| 대상 | 확인 |
|---|---|
| caseRunner | flow 순서, optional 건너뛰기, 역사 합류, retry 1회 제한, ✕ 뒤 진행 |
| scoring | 팀별 감점(반 경로와 달라도), 지연 감점, 0 하한, 원칙 카드·근거 배지 |
| algorithmMatrix | 단계별 칸 채우기, 건너뛴 결정 표시, 팀별 보기 |
| lab1 | `copper > bare ≈ insulated`, 시드 재현 |
| lab2 | 같은 시드 → 같은 조각, 조각 겹침 없음, 스냅 |
| lab3 | 금속+금 → 흠집 ≥1, 나무 → 0, 에폭시는 모든 조합에서 다른 접착제보다 느림, 60회 안에 흠집 0으로 떨어지는 에폭시 조합은 나무+데움뿐(약 29일) |
| lab4 | `S4 > S2 > S3 > S1`, 덜 마르면 측정 안 됨 |
| lab5 | 콘크리트 제거 손상 3, 점토 0, 증거 없는 층 실선 금지 |
| persistence | localStorage 실패 시에도 진행 |

### 3.3 E2E (Playwright, `webapp-testing` 스킬)
1. **전체 진행(120분)**: 키보드만으로 S00→S25. 모든 결정에서 팀 투표를 (A,A,A,A)로.
2. 같은 흐름을 (B,B,B,B), (C,C,C,C), 혼합(A,B,C,B), 동점(A,A,B,B → 교사 결정)으로 반복 → **모든 선택지 경로 통과**.
3. **80분 프로필**: optional 건너뛰기, 빠른 실습, 쉬는 시간 화면.
4. **이어하기**: 사건 3 중간에서 새로고침 → 같은 화면·같은 점수.
5. **오프라인**: 모든 외부 요청을 가로채 실패시키고 진행 → 외부 요청 0건 확인.
6. **화면 크기**: 1920×1080, 1366×768, 1280×720 스크린샷 → 글자 잘림 없음(요소 경계 검사).
7. **manual 모드**: 네 분야 각각 열기, 퀴즈 모두 맞히기 → 인증 화면.
8. **print 모드**: A4 PDF로 출력해 쪽 넘침 확인.
9. **내보내기**: CSV 열 이름·행 수, JSON으로 상태 복원.

## 4. 수업 전 점검표
| 시점 | 할 일 |
|---|---|
| D-7 | 프로젝터 해상도에서 전체 리허설(혼자 120분 흐름 넘겨 보기), 영상 링크 확인 |
| D-5 | (선택) 실물 실습 1(못 3일)·4(채색 시료 2일) 시작 → 사진을 `assets/pilot/`에 |
| D-3 | 생성형 AI에 `aiCheck.promptToAsk` 질문, 답변·날짜·모델명 입력 |
| D-2 | 숭례문 단청 최신 보도 확인 → `case4` 마지막 줄 수정 → `npm run validate` → 재빌드 |
| D-1 | 학생 기기에서 QR·manual 모드 열기 시험(또는 print 모드 인쇄 16부), 학습지 W1~W4 인쇄, A/B/C 카드·배지 준비 |
| 당일 | 교실 노트북에서 `dist/index.html` 열기, 저장된 테스트 세션 삭제, 프로필 선택 |

## 5. 수업 후 개선(LDT 기준 ⑦)
- CSV를 보고 v2 목록을 `docs/RETRO.md`로 남긴다: 시간이 넘친 단계, 예측 적중률이 너무 높았던 실습(너무 쉬움), 근거 태그가 적었던 결정, 학생이 헷갈린 문구.
- 콘텐츠만 바꾸는 개선은 `data/*.json` 수정 → validate → build로 끝나야 한다(엔진 수정 없이).
