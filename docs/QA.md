# 토끼고스톱 검증 기록

검증 환경: 2026-10-16, Next.js 16.3.8, Chromium·WebKit 자동 브라우저, Java 21 Firebase Auth/RTDB 에뮬레이터. 실제 Android/iPhone 세 대를 조작한 결과와 구분한다.

## 확인하는 사용자 흐름

혼자 치기에서 브라우저 엔진→개인 projection 기반 AI 둘→세 사람 정산→원자적 IndexedDB 기록을 확인한다. 친구방은 세 독립 UID의 UI→본인 action 큐→Firebase Rules→방장 엔진→state/receipt/점수 transaction→세 화면 ready→다음 행동까지 확인한다.

| 경계 | 검증 근거 |
| --- | --- |
| 게임 규칙 | seed 0~999 완주, AI 300판, 카드 50장·정규 턴 보존, 박·독박·나가리·즉시 거래 단위 테스트 |
| DB 권한·전송 | 실제 Firebase SDK·Rules 테스트. 좌석 동시 선점·3명 제한·만료 참가·방장 쓰기·중복 순번·대기·복구 |
| 실제 세 화면 | 2명 대기/3명 자동 시작, 같은 바닥·버전·각 me, 완료 판·전원 다음 판, 국진 중 단절과 복구 |
| 단절·종료 | 방장·각 게스트·두 게스트 동시 단절, 같은 UID 새로고침 복구, 테스트 clock으로 2분 안내, TTL fixture로 24시간 만료 |
| 정산·저장 | 자리2 독박 대납·0피 면제·80비트 음수 표시, 자뻑 양쪽 2피, 즉시 점수 후 중단, 101판 뒤 dedupe, 두 탭 실제 IDB |
| 모바일 UI | 390×844·360×640·320×568, 기존 4개 크기, 12개월 배치·화면 높이 변경·확대·Back·필수 선택·카드 비행·좌표 보존 |
| 운영 PWA | CI용 명시적 demo 설정 빌드. 첫 온라인→오프라인 재시작→AI 둘과 완주, 개발 hook 없음, 친구방 오프라인 안내, 새 워커 에셋 갱신·진행 판 보존·맞고 캐시 보존 |
| 분석 | production origin의 실제 UI 시작/완료 및 query 제거를 요청 가로채기로 검증. GA 외부 서버에는 보내지 않음. 세 참가자별 dedupe·최소 multi payload·offline/Preview/debug 배제는 단위 검증 |

숫자와 최종 실행 결과는 아래 출시 게이트에 기록한다. 종료 점수는 BigInt를 십진 문자열로 저장하며, 중단 판은 완료 목록에 넣지 않고 즉시 거래의 금액·방향을 별도로 보존한다.

## 재현

```sh
npm run typecheck
npm test
npm run test:firebase
npm run test:e2e
npm run build
npm run test:pwa
```

Java 21을 PATH/JAVA_HOME으로 선택한다. `demo-toki-gostop`의 Auth9199/RTDB9100만 사용한다. 로컬 환경의 원본 맞고 설정을 사용하지 않는다. 운영 빌드는 실제 전용 설정 또는 `.github/workflows/ci.yml`의 명시적인 CI fixture가 필요하다. CI fixture origin은 `https://gostop-ci.invalid`이고 GA 테스트에서 네트워크를 로컬로 가로챈다. 이는 실제 배포 URL이 아니다.

여러 테스트가 실행되는 동안 소스를 수정하면 개발 서버 HMR이 진행 중 연출을 중단할 수 있으므로 릴리스 게이트는 고정된 소스에서 실행한다. Playwright 재시도로 실패를 숨기지 않는다. 로그·trace·스크린샷은 `/tmp` 또는 git 제외된 test-results에 저장한다.

## 출시 게이트

독립 리뷰 보완 후 소스를 고정한 순차 출시 게이트가 모두 성공했다(2026-10-16).

- `npm run typecheck`: 성공.
- `npm test`: 25 파일, 143 테스트 통과.
- `npm run test:firebase`: 실제 SDK/Rules 13 테스트 통과.
- `npm run test:e2e`: Chromium/WebKit 81 테스트 통과, 3.3분. 재시도 설정 없음.
- `npm run build`: Next.js production/standalone·오프라인 shell 14 에셋 생성 성공.
- `npm run test:pwa`: 오프라인 완주·워커 갱신·GA 3 테스트 통과, 49.6초.

독립 리뷰의 나가기/시작 경합을 보완했고, 중단된 방 생성 정리와 끊긴 사용자 이름도 재현 테스트 후 수정했다. 결과는 [구현 인계](IMPLEMENTATION.md)에 기록했다.

## 저장소 연결 및 남은 운영·실기기 항목

- 생성한 공개 저장소: [GNOJES/toki-gostop](https://github.com/GNOJES/toki-gostop). origin fetch/push 모두 새 저장소로 변경했다. 작업 브랜치 [codex/gostop-three-player](https://github.com/GNOJES/toki-gostop/tree/codex/gostop-three-player) 업로드를 확인했다. 원본 맞고 원격으로 push하지 않는다.
- Firebase `toki-gostop` 전용 RTDB·Rules·익명 인증 게시 완료. 최초 운영 확인에서 `CONFIGURATION_NOT_FOUND`를 재현했고, 공식 CLI `deploy --only auth`로 인증 설정을 게시한 뒤 친구방 검증을 통과했다.
- Vercel `toki-gostop` 운영 배포 READY: https://toki-gostop.vercel.app. 소스 `c99b078b1fd43f792aac2927260e6bb6e40ef020`, 배포 `dpl_3QEJVda32czkLWcUaeQ4mFT7Kgc8`. 운영 빌드에서 단위 143개 통과.
- 실제 운영 Chromium 세 독립 브라우저에서 익명 인증·방 생성·3명 자동 시작·상태 동기화·같은 자리 새로고침 복구·완료 판 3명 결과·전원 다음 판·명시적 나가기의 방 종료 통과. 별도로 혼자+AI 둘 시작 통과. uncaught browser exception 없음.
- GA `G-EFG7BB6NEN`으로 운영 collect 요청 6건 관찰. GA 관리 화면 실시간 수신은 별도 확인이 필요하다.
- 남은 실기기 항목: Android/iPhone 실제 세 기기에서 카드 터치·작은 화면·카카오 인앱·백그라운드 복귀·제스처 Back·키보드 Back·PWA 설치 확인.

실서비스 확인은 2026-10-16에 수행했다. 자동 브라우저 검증을 실제 휴대폰 검증과 동일하게 간주하지 않는다. 원본 맞고 Firebase·Vercel은 변경하지 않았다.
