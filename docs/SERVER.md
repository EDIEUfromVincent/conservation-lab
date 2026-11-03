# 로컬 서버 운영 (Grok)

교사 1명이 프로젝터로 쓰는 오프라인 단일 HTML 앱의 **로컬 개발 서버**와, 빌드 산출물이 생긴 뒤의 **정적 미리보기**만 담당한다. 백엔드는 없다. 공유 범위는 이 컴퓨터의 localhost다. 외부 배포, 터널, `0.0.0.0` 바인딩은 하지 않는다.

역할 경계:

- Grok: 서버 기동, HTTP 확인, 이 문서
- Claude: `docs/IMPLEMENTATION_PLAN.md` (계획 완료, `docs/PLAN_READY` 있음)
- Codex: `package.json`, lockfile, 의존성 설치, 소스, `data/`

Grok은 코드, `package.json`, lockfile, `data/`, 번호 설계 문서(`docs/01`~`docs/11`), `CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md`를 수정하지 않는다.

## 현재 상태

최종 확인: 2026-11-03 13:23:55 KST. 개발 서버와 미리보기 프로세스는 그대로 두었고 새로 띄우지 않았다.

| 항목 | 상태 |
|---|---|
| Node.js | v26.8.1 |
| npm | 11.19.0 |
| `package.json` | 있음. `scripts.dev`는 `vite`, `scripts.preview`는 `vite preview` |
| 개발 서버 | 동작 중. 기존 감시 셸만 사용했고 두 번째로 띄우지 않음 |
| 수신 주소 | `127.0.0.1:5173` (이 앱). `*:5173`은 다른 앱이며 종료하지 않음 |
| `dist/index.html` | 184901바이트. 수정 시각 2026-11-03 13:23:24 KST. SHA-256 `022a96ef272d5deb3d44c455e5d4770fdc1660de883b9fff49c722d4e1aa8d27` |
| 정적 미리보기 | 기존 프로세스 유지. `127.0.0.1:4173`만 수신. 응답 본문이 위 파일과 일치 |

## 개발 서버 URL

이 앱은 아래 주소로 연다. `http://127.0.0.1:5173/`

| 용도 | URL | 확인 |
|---|---|---|
| 개발 화면 | http://127.0.0.1:5173/ | 13:23:55에 200, HTML 336바이트. Vite 개발용 껍데기이며 `dist`와 같지 않다 |

개발 서버의 쿼리 문자열은 브라우저가 나누며, HTTP 200은 그 껍데기를 보냈다는 뜻이다. `?mode=team`의 200을 팀 모드 기능 완료로 기록하지 않는다. 팀 모드는 미구현이다.

`localhost`의 IPv4도 같은 응답이었다. `[::1]:5173`은 연결이 거부된다. 같은 포트의 다른 앱이 IPv4 전체 주소에 있으므로, 수업 화면 주소는 `127.0.0.1`로 고정한다.

## 포트

| PID | 바인딩 | 작업 폴더 | 처리 |
|---|---|---|---|
| 52739 | `127.0.0.1:5173` | `/Users/vincent/Documents/conservation-lab` | 이 앱의 Vite. 유지 |
| 60116 | `*:5173` | `/Users/vincent/Documents/ChatGPT/에듀테크/birthday-game-harness` | 다른 앱. 종료하지 않음 |

2026-11-03 12:55에 `http://192.168.23.6:5173/`은 HTTP 200이지만 제목이 이 앱이 아니다(다른 앱의 페이지). 이 앱 프로세스는 `127.0.0.1`만 듣고 있다.

## 프로세스

개발 서버는 12:14에 만든 감시 셸이 설치 종료를 기다린 뒤 12:54:10에 한 번만 기동했다.

| 역할 | 값 |
|---|---|
| Orca 터미널 | `conservation-lab-dev` |
| 핸들 | `term_c156aa7e-c65b-4a82-afec-d785aee913be` |
| 셸 PID | 58994 |
| 명령 | `npm run dev -- --host 127.0.0.1` |
| npm PID | 52661 |
| Vite PID | 52739 (`node .../vite --host 127.0.0.1`) |
| 로그 | `~/.grok/long-running-background-tasks/conservation-lab-dev-server.log` |
| 상태 파일 | `~/.grok/long-running-background-tasks/conservation-lab-dev-status.txt` |

Vite 로그:

```text
VITE v7.3.7  ready in 406 ms
➜  Local:   http://127.0.0.1:5173/
```

## 확인 결과

시각: 2026-11-03 13:23:55 KST. 서버는 재시작하지 않았다.

`curl -sS -D - http://127.0.0.1:5173/`

```text
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 336
Etag: W/"150-CIwmEaKWFqqjVAJ1QgtsvoKQU3o"
```

본문에는 `<title>보존과학자의 하루</title>`와 `/@vite/client`, `/src/main.ts`가 있다. 이것은 개발용 껍데기다.

LISTEN 확인:

```text
node 52739 TCP 127.0.0.1:5173 (LISTEN)  cwd=conservation-lab
node 60116 TCP *:5173 (LISTEN)          cwd=birthday-game-harness
node 69801 TCP 127.0.0.1:4173 (LISTEN)  cwd=conservation-lab
```

이 앱의 수신 주소는 `127.0.0.1`뿐이다. PID 60116의 `*:5173` 응답은 이 확인에 넣지 않는다.

## 정적 미리보기

미리보기는 12:59에 개발 서버와 별도의 셸에서 한 번 기동한 프로세스 그대로다. 13:23 확인 때 재시작하지 않았다. 개발 서버 PID 52739도 그대로다.

주소는 http://127.0.0.1:4173/ 이다.

| 역할 | 값 |
|---|---|
| Orca 터미널 | `conservation-lab-preview` |
| 핸들 | `term_b49f9dbb-1717-4576-85ad-ff7e68f976f5` |
| 셸 PID | 69759 |
| 명령 | `npm run preview -- --host 127.0.0.1 --port 4173` |
| npm PID | 69768 |
| Vite PID | 69801 |
| 로그 | `~/.grok/long-running-background-tasks/conservation-lab-preview-server.log` |

확인 시각: 2026-11-03 13:23:55 KST

디스크 파일은 184901바이트, 수정 시각 13:23:24 KST다. SHA-256은 `022a96ef272d5deb3d44c455e5d4770fdc1660de883b9fff49c722d4e1aa8d27`이다.

`http://127.0.0.1:4173/` 응답:

```text
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 184901
Etag: W/"2d245-IGXUfmy1EnyyHn9OnQJXYnZt4Ds"
```

응답 본문의 SHA-256이 디스크 파일과 같다. 제목 `보존과학자의 하루`와 CSP 메타가 있고, `</html>`로 끝난다. `/@vite/client`와 `/src/main.ts`는 없다.

같은 시각에 아래 주소도 200이고 본문 184901바이트가 디스크 파일과 같다. 이것은 정적 파일이 쿼리와 관계없이 전달되었다는 HTTP 확인이다. 화면 기능의 완료 판정이 아니다.

| URL | HTTP |
|---|---|
| `?mode=teacher` | 200, 본문 일치 |
| `?mode=manual&expert=metal` | 200, 본문 일치 |
| `?mode=print` | 200, 본문 일치 |
| `?mode=team&team=1` | 200, 본문 일치. 팀 모드는 미구현이므로 이 200을 기능 완료로 보지 않는다 |

LISTEN은 `node 69801 TCP 127.0.0.1:4173`뿐이다. `[::1]:4173`과 `192.168.23.6:4173`은 연결이 거부된다. 같은 시각에 개발 서버 `http://127.0.0.1:5173/`도 200이었다.

Vite 로그:

```text
vite preview --host 127.0.0.1 --port 4173
➜  Local:   http://127.0.0.1:4173/
```

## Codex에 남기는 조건

이미 충족된 것: `scripts.dev`, `scripts.preview`, `node_modules/.bin/vite`, CLI `--host 127.0.0.1`.

유지할 것:

- `vite.config`에서 `server.host`를 `0.0.0.0`이나 `true`로 바꾸지 않는다. 바꾸면 이 셸이 서버를 종료한다.
- `server.port`나 `strictPort`로 포트를 고정하지 않는다. 지금 이 앱은 `127.0.0.1:5173`이고, 다른 앱은 `*:5173`이다.
- 개발 서버를 따로 실행하지 않는다. 재시작이 필요하면 이 문서의 셸 PID 58994만 사용한다.

## 확장 검증 — 탐험 / 실물 4D

확인 시각: 2026-11-03 14:16:56 KST. 개발 서버와 미리보기는 재시작하지 않았다. 코드도 수정하지 않았다. 수신 범위는 이 기기 localhost다.

서버 건강:

| 역할 | PID | 바인딩 | HTTP |
|---|---|---|---|
| 개발 서버 | 52739, 셸 58994 | `127.0.0.1:5173` | 200, 336바이트. Vite 개발용 껍데기라 `dist`와 해시가 다르다 |
| 정적 미리보기 | 69801, 셸 69759 | `127.0.0.1:4173` | 200, 778771바이트 |
| 다른 앱 | 60116 | `*:5173` | 종료하거나 재사용하지 않음 |
| 개발 감시 | 60318 | 기존 프로세스 | 유지 |
| 미리보기 감시 | 72366 | 기존 프로세스 | 유지 |

`dist/index.html`은 778771바이트, 수정 시각 2026-11-03 14:15:53 KST다. SHA-256은 `3eef274aef76b787bfba94f4bb889e5bde5c0acdfab0a91392c2165cbe0d1a50`이다. 파일 안에 `?mode=expedition`, `?mode=frame`, `4d-frame` 문자열이 있다.

미리보기 응답 본문의 SHA-256은 세 주소 모두 디스크 파일과 같다.

| URL | HTTP | 본문 |
|---|---|---|
| http://127.0.0.1:4173/ | 200, `text/html` | 778771바이트, SHA-256 일치 |
| http://127.0.0.1:4173/?mode=expedition | 200, `text/html` | 같은 SHA-256 |
| http://127.0.0.1:4173/?mode=frame | 200, `text/html` | 같은 SHA-256 |

쿼리마다 같은 단일 HTML이 전달된다. 이 200은 파일 전달 확인이며, 화면 조작이 끝났다는 뜻은 아니다. `[::1]:4173`, `[::1]:5173`, `192.168.23.61:4173`은 연결이 거부된다.
