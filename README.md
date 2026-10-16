# 토끼고스톱

**패는 없어도, 마주 앉은 것처럼.** 혼자와 AI 둘, 또는 가족·친구 세 사람이 스마트폰으로 즐기는 고스톱이다. 기본 48장과 보너스 쌍피 2장을 사용하며 게임머니·베팅 없이 순점수를 기록한다.

토끼맞고를 복제한 독립 프로젝트다. 기존 Git 이력과 카드·토끼·소리·연출은 이어가고, 저장소·Firebase·Vercel·GA·브라우저 기록·PWA 캐시는 분리한다. 새 원격은 [GNOJES/toki-gostop](https://github.com/GNOJES/toki-gostop) 공개 저장소이며 실제 운영 연결 상태는 [QA](docs/QA.md)에 기록한다.

## 개발

Node.js 24 이상, npm, Firebase 에뮬레이터용 Java 21 이상이 필요하다.

```sh
npm ci
npm run dev             # 혼자 치기. 실제 Firebase는 별도 고스톱 설정 필요
```

복제된 `.env.local`의 맞고 프로젝트 설정은 사용을 거절한다. 이 파일은 Git에 포함하지 않는다. `.env.example`에 정의한 전용 Firebase 설정, 승인 프로젝트 ID, 운영 origin, 별도 GA ID를 등록한다. 서비스 계정 키는 넣지 않는다.

운영 DB를 사용하지 않는 친구방 개발은 두 터미널에서 실행한다.

```sh
npm run emulators       # demo-toki-gostop: Auth 9199 / Database 9100 / UI 4400
npm run dev:firebase
```

서로 다른 익명 UID가 필요하므로 세 개의 독립 브라우저 프로필을 사용한다. 같은 프로필의 탭들은 한 UID를 공유한다. 방 만들기 후 URL/QR/4자리 코드로 참가하며 세 번째 사람이 연결되면 첫 판을 시작한다. 다음 판은 전원 ‘한 판 더’ 동의가 필요하다.

## 검증과 빌드

```sh
npm run typecheck
npm test
npm run test:firebase
npm run test:e2e
npm run build
npm run test:pwa
```

브라우저 설치는 `npx playwright install chromium webkit`이다. Firebase 테스트는 전용 demo 프로젝트만 사용한다. E2E의 Next 출력은 `.next-firebase`, 운영 standalone은 `.next-prod`다. `npm start`로 운영 빌드를 실행한다. 테스트 결과와 trace는 Git에서 제외한다.

운영 빌드는 전용 Firebase·origin·GA 설정이 없거나 원본 맞고 설정이면 실패한다. CI만 명시적인 demo fixture를 허용한다. `.github/workflows/ci.yml`은 타입→단위→Firebase→E2E→운영 빌드→PWA를 순서대로 실행한다. 저장소의 `release-checks` 필수 통과와 브랜치 보호 설정은 별도로 확인해야 한다.

## 배포

새 Firebase 프로젝트에 익명 인증과 잠금 RTDB를 구성하고 검증된 `database.rules.json`을 먼저 게시한다. 새 GitHub 저장소를 전용 Vercel 프로젝트에 연결한다. 빌드 명령은 `npm run build:vercel`, 기본 출력 경로를 사용한다. `.env.example`의 공개 Firebase 설정과 `FIREBASE_EXPECTED_PROJECT_ID`, `NEXT_PUBLIC_APP_ORIGIN`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`를 등록하고 운영 빌드를 배포한다. `NEXT_PUBLIC_` 값 변경 후에는 재빌드해야 한다. 운영에서는 에뮬레이터를 사용하지 않는다.

[Firebase 운영 안내](docs/FIREBASE.md)에 모델·Rules·복구·배포 순서가 있다. 프런트 배포 성공만으로 세 기기·GA·운영 DB 검증 완료를 의미하지 않는다.

## 연결과 기록

누구든 연결이 끊기면 모두 멈추고 같은 브라우저·익명 UID 복귀를 기다린다. 2분 후 남은 사람은 종료하거나 계속 기다릴 수 있다. 선택 제한시간·자동 패배·AI 대체·자동 방장 교체는 없다. 시작 후 누구든 나가면 방은 종료하며 마지막 상태는 24시간 TTL까지 보존한다. 중단 판의 승패를 만들지 않고 확정된 즉시 점수는 유지한다.

홈의 최근 기록은 이 브라우저의 완료 100판과 solo 누적 승패·순점수를 보관한다. 초기화 확인 후 solo 통계와 solo 목록을 지워도 같은 거래를 다시 더하지 않는다. 맞고 기록 이전·기기 간 동기화는 하지 않는다. 저장소를 지우면 기록과 익명 계정도 사라질 수 있다.

신뢰하는 가족·친구용 방장 판정 구조다. UI는 상대 손패 장수만 표시하지만 참가자는 Firebase 전체 상태에서 타인 손패와 미래 덱을 볼 수 있다. 별도 상시 서버나 Cloud Functions는 없고 미사용 Socket.IO 서버는 제거했다.

PWA는 첫 온라인 로드 후 오프라인 solo를 지원한다. 새 서비스워커는 진행 중 판을 유지하며 카드 에셋을 갱신한다. 원본 맞고 캐시는 삭제하지 않는다. 친구방은 인터넷이 필요하다.

## 분석과 문서

GA는 전용 운영 origin에서만 설정된 별도 스트림을 사용한다. 로컬·Preview·debug·오프라인에서는 전송하지 않는다. `game_start`, `game_end`, `room_create`, `room_join`에 `game_mode`만 추가 전송한다. 세 사람이 완료한 한 판은 각 참가자의 시작·종료 이벤트가 각각 한 건씩이다. 중도 이탈은 종료 이벤트를 만들지 않는다. 중복 ID는 탭 내부에만 보관하고 닉네임·방 코드·UID·손패·query/hash는 전송하지 않는다. 별도 스트림의 향상된 자동 측정 설정과 실시간 수신은 운영 연결 후 확인한다.

- [규칙](docs/RULES.md): 확정한 3인 룰과 정산
- [구조](docs/ARCHITECTURE.md): 엔진·연출·통신·저널
- [QA](docs/QA.md): 자동 검증과 실기기 확인 항목
- [에셋](docs/ASSETS.md): 카드 원본·CC BY-SA 출처와 생성 이미지
- [설계](docs/superpowers/specs/2026-10-14-three-player-gostop-design.md), [구현 계획](docs/superpowers/plans/2026-10-15-three-player-gostop.md)

개발 서버의 `/?debug=1` → 혼자 치기 → 개발에서 fixture·직접 7장/바닥 6장 분배·연출 건너뛰기를 사용할 수 있다. 운영 빌드에는 개발 UI와 hook을 노출하지 않는다.
