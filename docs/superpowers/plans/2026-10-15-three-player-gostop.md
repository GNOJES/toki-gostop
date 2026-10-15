# 토끼고스톱 3인 게임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 맞고 개발 이력을 보존한 공개 저장소 `GNOJES/toki-gostop`에서 혼자+AI 2명 및 친구 3명용 토끼고스톱을 독립 운영한다.

**Architecture:** 순수 TypeScript 엔진에서 3인 상태 전이와 개인 족보·상대별 정산을 분리한다. 친구방은 방장 브라우저가 판정하고 별도 Firebase에 저장하며 UI는 개인 뷰와 이벤트를 재생한다. 즉시 거래와 종료 거래에 안정적인 ID를 부여하고 호스트 통계·브라우저 기록 각각에서 중복 반영을 막는다.

**Tech Stack:** 저장소의 Next.js App Router·React·TypeScript·Firebase Auth/RTDB·Vitest·Playwright를 유지한다. 분석 시 설치 버전은 Next 16.3.8, React 19.3.0, Firebase 12.19.0, TypeScript 5.9.3이다. 새 프레임워크·판정 서버·DB 제품은 추가하지 않는다.

**Spec:** `docs/superpowers/specs/2026-10-14-three-player-gostop-design.md` — 사용자 확정 결정 41개를 포함한 설계 검토본. 이 계획과 함께 읽는다.

## Global Constraints

- 제품명은 **토끼고스톱**, 저장소는 **GNOJES/toki-gostop 공개**, 기존 맞고 커밋 이력 보존.
- 혼자 치기는 사람 1명 + AI 2명, 친구방은 사람 3명. 친구 2명 + AI 1명은 제외.
- 신뢰하는 가족·친구용 방장 판정 구조. DB 참가자가 전체 손패·덱을 조회할 수 있다는 기존 한계를 유지.
- 기본 48장 + 보너스 쌍피 2장 = 50장, 손 7·바닥 일반패 6·정규 턴 각 7회, 3점부터 고/스톱.
- 첫 선 무작위 월 추첨, 이후 승자 선, 나가리 기존 선 유지.
- 순점수 가산·차감, 음수 허용, 세 사람 변화 합계 0. 정산·누적은 BigInt 계산, JSON/저장은 10진 문자열.
- 피박은 1~5피만 ×2, 0피 면제. 광박·멍따·고·독박은 설계 D08~D09 그대로.
- 남의 뻑은 두 상대 각 1피, 자뻑은 각 2피. 홑피 우선, 부족하면 쌍피 지급, 피 없는 상대 건너뜀, 부족분 대납 없음.
- 첫뻑/2연뻑/3연뻑은 각 상대 3/6/9점 추가 누적, 첫따닥 각 3점. 배수 없이 즉시 정산·보존.
- 총통 각 5점·3뻑 각 3점, 허당 제외. 특수 승리에는 나가리 배수만 적용, 독박 제외.
- 연속 나가리 ×2·×4·×8 누적, 승패 다음 판 ×1, 재분배는 기존 배수 유지. 임의 배수 상한 없음.
- 첫 판은 세 명 연결 시 자동 시작, 이후 전원 ‘한 판 더’. 단절 전원 대기·2분 후 종료 선택, 턴 제한시간 없음.
- 방 수명은 생성 후 24시간 고정. 시작 후 명시적 나가기·만료는 방 종료, 미완료 판 기권 정산 없음.
- 기존 디자인·카드·연출·모바일 세로·PWA 오프라인 혼자 치기 유지. 최근 완료 100판과 혼자 누적 기록, 원본 기록 이전 없음.
- Firebase·RTDB·Vercel·접속 주소·GA를 원본과 분리. 닉네임·UID·방 코드·손패는 GA로 전송하지 않음.
- 제품 코드 작성 전 해당 파일에 적용되는 AGENTS.md와 설치된 `node_modules/next/dist/docs/` 안내를 읽는다. 의존성 대규모 업그레이드는 범위 밖.

## Review Focus

1. 방 코드 재사용·중복 수신·기록 목록 100개 초과 후에도 이미 반영한 즉시 거래/완료 판을 다시 가산하지 않는다 — Task 4, 5, 7.
2. 마지막 자리에 두 게스트 동시 참가, 동일 UID 복수 탭, 시작 직전 이탈에도 중복 좌석·중복 판·닫힌 방 부활이 없어야 한다 — Task 5, 7.
3. 연속 나가리와 음수 누적 점수가 안전 정수 범위를 넘어도 UI·JSON·기록에서 정확히 왕복해야 한다 — Task 2, 4, 7.
4. 본인 자리가 1·2번인 화면에서도 이름·차례·피 이동 출발지·독박 부담을 정확히 보여야 한다 — Task 3, 6, 7.
5. 연결 복구·느린 연출·뒤로가기·새 판이 겹쳐도 오래된 이벤트/AI가 새 상태에 행동하지 않아야 한다 — Task 5, 6, 7.

---

## 실행 순서와 검증 원칙

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 순서로 진행한다. 하나의 출시 가능한 3인 게임을 만드는 계획이며 단계를 별도 제품으로 배포하지 않는다. Task 2~5의 타입 이행 중에는 아직 변환하지 않은 UI·기존 2인 fixture가 전체 타입 검사를 실패시킬 수 있다. 각 단계의 대상 테스트는 통과시키고 Task 6부터 전체 타입·테스트를 통과시킨다. 최종 검사에서 기존 테스트를 단순 제외하거나 assertion을 약화하여 통과시키지 않는다.

구현 시작 때 현재 체크아웃과 첨부 worktree를 확인하고 적합한 현재 폴더를 우선 사용한다. 필요할 때만 worktree 스킬에 따라 격리한다. 브랜치를 만들면 `codex/gostop-three-player`를 사용한다. `.git` 삭제·초기화와 원본 저장소 push는 금지한다. Task 8에서 새 원격을 확인하기 전에는 push하지 않는다.

현재 미추적 설계/계획 문서는 첫 구현 커밋에 함께 포함하여 새 저장소 이력에 남긴다. 각 task의 마지막 커밋은 그 task에 해당하는 파일만 명시적으로 stage한다.

## 파일 책임 지도

| 경계 | 주요 파일과 역할 |
| --- | --- |
| 제품 격리 | `src/lib/product.ts` 신규: 이름·저장 namespace·demo ID. 기존 설정·SW·빌드 스크립트의 원본 연결 제거 |
| 엔진 계약 | `src/game-engine/types.ts`, `rules.ts` 신규, `seats.ts` 신규, `points.ts` 신규 |
| 정산 | `score.ts`: 개인 족보, `settlement.ts` 신규: 개별 부담·독박 이전·거래 |
| 상태 전이 | `engine.ts`, `fixtures.ts`: 세 자리 분배·정규 턴·보너스·종료 |
| 기록 | `play-history.ts`, `history-store.ts`: 완료 기록과 별도 거래 저널, 1회 반영 |
| 멀티 | `multiplayer/types.ts`, `room-membership.ts` 신규, `host.ts`, `requests.ts`, `firebase-transport.ts`, `database.rules.json` |
| UI 실행 | `use-game-session.ts` 신규: 상태 수명·AI, `game-presenter.ts` 신규: 이벤트 재생, `use-game-history.ts` 신규: 저널 구독 |
| 화면 | `GostopApp.tsx`, `GameTable.tsx`, `PlayerPanel.tsx`, `RoomLobby.tsx`, `RoundResult.tsx` 신규. 기존 카드·획득패·설정·기록·결정창 재사용 |
| 출시 | CI·Firebase 테스트·모바일 E2E·PWA·GA·환경 검증·운영 문서 |

### Task 1: 원본 운영 연결과 제품 namespace 격리

**Files:**
- Create: `src/lib/product.ts`, `tests/product-isolation.test.ts`.
- Modify: `package.json`, `package-lock.json`, `.env.example`, `src/app/layout.tsx`, `public/manifest.webmanifest`, `src/lib/preferences.ts`, `src/lib/analytics.ts`, `src/multiplayer/firebase-transport.ts`, `public/sw.js`, `scripts/version-card-assets.mjs`, `scripts/dev-firebase.mjs`, `scripts/validate-env.mjs`, `.github/workflows/ci.yml`, `tests/env.test.ts`, `tests/analytics.test.ts`, `tests/sw-install.test.ts`.

**Interfaces:**
- Produces: `PRODUCT_NAME = '토끼고스톱'`, `STORAGE_PREFIX = 'toki-gostop'`, `DEMO_FIREBASE_PROJECT_ID = 'demo-toki-gostop'` in `product.ts`.
- Produces: `validateFirebaseEnv(env: NodeJS.ProcessEnv): void`의 기존 호출 계약 유지. `FIREBASE_EXPECTED_PROJECT_ID`와 실제 project ID의 일치 검증 추가. 원본 `toki-matgo`는 거절, 운영에서는 demo ID와 에뮬레이터 사용 거절.
- `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_APP_ORIGIN`은 실제 리소스 연결 전 운영 기본값을 두지 않는다. 테스트는 새 demo 값으로 실행한다.

- [ ] **Step 1:** `product-isolation.test.ts`와 기존 환경 테스트에 `rejectsOriginalProject`, `rejectsMismatchedExpectedId`, `requiresProductionOriginAndGa`, `keepsOldCacheUntouched`를 추가한다. 원본 설정 묶음은 내부 값이 일치해도 거절, 승인된 새 설정은 통과, 새 SW가 `toki-` 원본 캐시를 삭제하지 않는 것을 assertion으로 고정한다. GA는 운영 주소/ID가 없으면 외부 요청을 만들지 않는다.
- [ ] **Step 2:** `npm test -- tests/product-isolation.test.ts tests/env.test.ts tests/analytics.test.ts tests/sw-install.test.ts` 실행. 기존 원본 ID·캐시 접두사·GA 기본값 때문에 실패함을 확인한다.
- [ ] **Step 3:** 제품 상수·키를 바꾸고 SW 생성기와 SW 소유 접두사를 함께 변경한다. `toki-gostop.preferences.v1`, `toki-gostop.firebase.owned.v1`, `toki-gostop.analytics.once.v1`, 캐시 접두사 `toki-gostop-`를 사용한다. 기존 `.env.local`·`.vercel` 내용을 출력하거나 덮어쓰지 않는다. 새 demo 설정으로 개발·테스트 경로를 고정하고 운영 빌드는 새 환경 연결 전 명확하게 실패하도록 한다. CI의 demo production 빌드는 `CI=true`와 `APP_BUILD_CONTEXT=ci`가 모두 있고 `VERCEL_ENV`가 없을 때만 허용한다. Vercel 운영/Preview에서 이 우회를 거절하는 테스트도 둔다. metadata의 앱 주소·OG·manifest 이름을 새 제품 기준으로 변경한다. 원본 카드 출처는 보존한다.
- [ ] **Step 4:** Step 2의 테스트와 `npm test -- tests/offline-shell-build.test.ts`를 실행하여 전부 통과시킨다. 전용 CI Node는 문서 권장과 맞춰 24로 통일하고 Java 21을 유지한다. 패키지 이름 변경은 lockfile 루트 정보도 맞추며 불필요한 버전 갱신은 하지 않는다.
- [ ] **Step 5:** 설계·계획·Task 1 파일을 커밋한다. 제안 메시지: `chore: isolate toki gostop product configuration`.

### Task 2: 세 자리 타입과 정확한 점수·거래 계산

**Files:**
- Create: `src/game-engine/rules.ts`, `src/game-engine/seats.ts`, `src/game-engine/points.ts`, `src/game-engine/settlement.ts`, `tests/settlement.test.ts`, `tests/points.test.ts`, `tests/seats.test.ts`, `tests/helpers/gostop-fixture.ts`.
- Modify: `src/game-engine/types.ts`, `src/game-engine/score.ts`.

**Interfaces:**
- Produces in `types.ts`: `SeatId = 0 | 1 | 2`, `SeatTuple<T> = [T, T, T]`, `Points = bigint`, `EndReason = 'STOP' | 'NAGARI' | 'CHONGTONG' | 'THREE_PPUK'`. 기존 `PlayerId`는 이행 중 `SeatId`의 alias로 유지한다.
- `ScoreBreakdown`: 기존 족보 점수·장수·`baseScore`만 number로 유지, 상대 배수/`finalScore`는 분리한다. `PlayerState`의 기존 손패·선언·정규 턴 필드는 유지하고 단일 `sidePoints`로 정산하지 않는다.
- `PointTransfer = { id: string; from: SeatId; to: SeatId; amount: Points; kind: 'INSTANT' | 'FINAL'; reason: 'OPENING_PPUK' | 'OPENING_TTADAK' | EndReason }`.
- `RoundSettlement = { baseScore: number; commonMultiplier: Points; liabilities: SeatTuple<Points>; payerFor: SeatTuple<SeatId | null>; transfers: PointTransfer[]; roundDelta: SeatTuple<Points> }`. liabilities는 독박 이전의 좌석별 부담, payerFor는 실제 지급자, transfers는 종료 거래만, roundDelta는 즉시 거래 포함 판 전체 변화다.
- `GameState`는 세 자리 상태, `gameId: string`, `transactions: PointTransfer[]`, `nagariStreak: number`를 포함한다. `GameResult = { winner: SeatId | null; reason: EndReason; settlement: RoundSettlement }`. state/result/view의 BigInt를 JSON 경계에서 명시적으로 변환한다.
- Produces: `calculateScore(player: PlayerState): ScoreBreakdown`, `settleRound(state: GameState, winner: SeatId | null, reason: EndReason): RoundSettlement`, `instantTransfers(gameId: string, stateVersion: number, to: SeatId, reason: 'OPENING_PPUK' | 'OPENING_TTADAK', perOpponent: Points): PointTransfer[]`, `transferDelta(transfers: readonly PointTransfer[]): SeatTuple<Points>`.
- Produces: `encodePoints(value: Points): string`, `decodePoints(value: unknown): Points`. canonical decimal은 `0` 또는 부호 선택의 0 아닌 정수이며 `-0`, 소수·지수·공백·NaN은 거절한다.
- Produces: `otherSeats(me: SeatId): [SeatId, SeatId]`, `nextSeat(current: SeatId, turns: SeatTuple<number>): SeatId | null`, `relativeSeats(me: SeatId): { left: SeatId; right: SeatId }`. left는 `(me+1)%3`, right는 `(me+2)%3`; 게임 순서는 0→1→2다.
- `RULES`는 `playerCount:3`, `handSize:7`, `floorSize:6`, `stopScore:3`, `bonusCount:2`, `bonusPiValue:2`, `version:'gostop-v1'`의 단일 프로필.

- [ ] **Step 1:** tests/helpers에 50장 중복 없이 세 자리 fixture를 만드는 `makeGostopFixture(input: { hands: SeatTuple<string[]>; floor: string[]; draw: string[]; captured?: SeatTuple<string[]>; currentPlayer?: SeatId }): GameState`를 작성한다. 명시하지 않은 카드는 플레이하지 않는 좌석의 획득패에 배치하며 기존 빈 플레이어 필드 기본값을 사용한다. 각 테스트는 기본 족보 결과도 함께 assert하여 남은 카드가 점수에 미치는 영향을 숨기지 않는다.
- [ ] **Step 2:** `settlement.test.ts`에 기준점 6·B만 피박→`[18n,-12n,-6n]`, B 독박→`[18n,-18n,0n]`, A가 최신 고 후 A 승리→이전 없음, 0피 면제·1/5/6피 경계, 비광 3광, 멍따와 쌍피 전환 국진, 3고 기본5→14를 추가한다. 총통/3뻑은 나가리만 반영, 나가리는 종료 거래 없음, 즉시 3/6/9 누적은 상대별18·발생자36, 합계0을 검증한다.
- [ ] **Step 3:** `points.test.ts`에서 `2n ** 80n`의 양수·음수 왕복과 잘못된 입력 거절, `seats.test.ts`에서 모든 본인 자리 매핑·턴 소진 건너뛰기·전원 소진 null을 검증한다. `npm test -- tests/settlement.test.ts tests/points.test.ts tests/seats.test.ts` 실행 후 새 계약 부재로 실패하는지 확인한다.
- [ ] **Step 4:** 위 인터페이스를 구현한다. 일반 승리 공통 배수는 `2n ** BigInt(max(goCount-2,0)+shakes.length+bombs+(yeolCount>=7?1:0)+nagariStreak)`이며 기본점수에 `min(goCount,2)`를 먼저 더한다. 특수 승리의 기준점은 5/3이며 배수는 `2n ** BigInt(nagariStreak)`뿐이다. 독박은 일반 STOP에서만 원래 liabilities 합을 최근 고 선언자로 이전한다. 즉시 거래 ID는 `${gameId}:instant:${stateVersion}:${reason}:${from}`, 종료 거래 ID는 `${gameId}:final:${from}`로 고정한다. 종료 전체 변화는 기존 INSTANT 거래와 새 FINAL 거래에서 계산한다.
- [ ] **Step 5:** Step 3 테스트 통과를 확인한다. `settleRound`가 입력을 변경하지 않고 재호출해도 같은 거래 ID를 반환하는지 검증한다. 커밋: `feat: add three player scoring and point ledger`.

### Task 3: 3인 분배·턴·특수 상황 엔진

**Files:**
- Modify: `src/game-engine/engine.ts`, `src/game-engine/fixtures.ts`, `tests/engine.test.ts`, `tests/fixtures.test.ts`, `tests/kukjin.test.ts`.
- Create: `tests/three-player-engine.test.ts`, `tests/pi-transfer.test.ts`.

**Interfaces:**
- Consumes: Task 2의 타입·규칙·정산·좌석 함수.
- Produces: `createGame(options?: { gameId?: string; seed?: number; rng?: () => number; dealer?: SeatId; nagariStreak?: number; deck?: Card[] }): GameState`, `emptyPlayer(): PlayerState`, `applyAction(state: GameState, action: GameAction): { nextState: GameState; events: GameEvent[] }`, `projectState(state: GameState, me: SeatId): GameView`, `assertInvariant(state: GameState): void`.
- `GameView`는 세 자리 공개 player/score, 본인 hand, deckCount, 공개 선택 정보, gameId·transactions·result를 포함한다. 다른 손패·덱 순서는 포함하지 않는다.
- 피 이동 이벤트는 `{ type:'PI_TRANSFERRED'; player:SeatId; from:SeatId; to:SeatId; cards:Card[]; requestedPi:number; actualPi:number }`. player는 획득자를 의미한다. 다른 이벤트 이름·phase는 가능한 한 유지한다.
- `dealerDraw`는 세 자리 최종 월과 재추첨 기록을 공개하며, `nagariStreak`는 재분배 중 보존한다. 재현 테스트는 gameId를 명시한다.

- [ ] **Step 1:** `three-player-engine.test.ts`에 각 선 0/1/2에서 손 7/7/7·일반 바닥6·50장 보존, 보너스 이전 덱23, 바닥 보너스 반복 보충, 낮은 월 추첨·동률 재추첨, 첫 선 분배 독립, 동시 총통·초기 바닥4 재분배의 선/배수/초기 보너스 초기화를 추가한다. deck fixture로 잘못된 초기 분배를 직접 주면 명확한 오류를 반환하고 rng 기반 생성은 재분배한다.
- [ ] **Step 2:** `pi-transfer.test.ts`에 두 상대 각1·자뻑 각2·제3자 뻑·피 없는 상대·홑피 우선·쌍피만 보유·요청2에 홑피1+쌍피1→실제3·전환 국진 이동을 추가한다. 각 이벤트의 from/to/실제 카드와 총50장을 assert한다.
- [ ] **Step 3:** 마지막 자기 턴 뻑 예외·쪽/따닥/쓸 피 이동 없음, 폭탄 패스 포함 7회, 국진 유지/전환·고 이후 자기 턴 계속, 마지막 자동 STOP, 5턴 빈손획득 없음에도 허당 미발생, 3연뻑 즉시 거래 후 특수 종료 거래, FINISHED 행동 거절·불법 행동 원본 보존을 추가한다. 단위 테스트를 실행하여 현재 2인 가정 때문에 실패함을 확인한다.
- [ ] **Step 4:** 세 자리 순환·분배·점수 조건을 구현하고 `HEODANG` 종료를 제거한다. 첫뻑/따닥 시 거래를 state에 즉시 추가하고 종료 시 Task 2의 FINAL 거래만 추가한다. 국진 자동 선택과 수동 선택, 마지막 턴·뻑 보너스 부착은 확정 설계대로 구현한다. GameState 전체의 카드·턴·거래 ID 유일성·거래 합계0을 invariant로 검증한다. 같은 월 바닥 두 장 중 동등한 홑피 자동 선택 같은 기존 기능은 유지한다.
- [ ] **Step 5:** 기존 2인 엔진·fixture·국진 테스트를 3인 입력과 사용자 변경값으로 이행한다. `npm test -- tests/engine.test.ts tests/three-player-engine.test.ts tests/pi-transfer.test.ts tests/fixtures.test.ts tests/kukjin.test.ts tests/settlement.test.ts` 모두 통과. 각 phase에서 버전이 성공 행동에만 증가하고 보너스/폭탄 중간 카드도 보존되는지 확인한다. 커밋: `feat: implement three player gostop engine`.

### Task 4: 즉시 거래와 완료 기록의 원자적 브라우저 저장

**Files:**
- Modify: `src/lib/play-history.ts`, `src/lib/history-store.ts`, `tests/play-history.test.ts`.
- Create: `src/lib/use-game-history.ts`, `tests/history-journal.test.ts`, `e2e/history-journal.spec.ts`.

**Interfaces:**
- Consumes: `PointTransfer`, `GameResult`, Points codec.
- Produces: `PlayRecord = { id:string; at:number; mode:'single'|'multi'; names:SeatTuple<string>; me:SeatId; winner:SeatId|null; reason:EndReason; ruleVersion:string; delta:SeatTuple<string> }`.
- `PlayHistory.solo`는 wins/losses/draws number와 points 10진 문자열. `recent:PlayRecord[]` 최대100. 맞고 DB를 읽거나 이전하지 않는다.
- Produces: `persistGameProgress(input: { gameId:string; mode:'single'|'multi'; names:SeatTuple<string>; me:SeatId; transactions:PointTransfer[]; result:GameResult|null; at?:number }): Promise<PlayHistory>`, `readHistory(): Promise<PlayHistory>`, `resetSoloHistory(): Promise<PlayHistory>`, `useGameHistory(): { history:PlayHistory; save:typeof persistGameProgress; resetSolo:typeof resetSoloHistory }`.
- 새 DB `toki-gostop-history-v1`: history·appliedTransfers·completedGames object stores. 처리 완료 식별자는 최근100판 목록과 별개로 보존한다. 한 IDB readwrite transaction에서 거래 중복 확인·총점·판 완료·최근 목록을 함께 갱신한다. 저장 제한 시 현재 탭 메모리로 전환하고 게임은 계속한다.

- [ ] **Step 1:** 즉시 거래만 수신→통계 갱신·완료 목록 없음, 중단 후에도 유지, 완료 시 같은 즉시 거래+FINAL 수신→FINAL만 추가, 중복 수신→무변경, 101판 이후 첫 판 재수신→무변경, 음수·80비트 왕복, 멀티가 솔로 통계를 바꾸지 않음을 테스트한다. 솔로 초기화는 솔로 통계와 최근 솔로 목록을 지우고 멀티 항목은 보존한다. 이미 처리한 솔로 거래·완료 ID는 최소 tombstone으로 보존하여 초기화 직후 같은 완료 상태를 재수신해도 기록이 부활하지 않음을 검증한다.
- [ ] **Step 2:** `npm test -- tests/play-history.test.ts tests/history-journal.test.ts` 실행, 현재 완료 판 전용·비음수 모델로 실패 확인.
- [ ] **Step 3:** 순수 기록 갱신과 IDB 저널을 구현한다. `persistGameProgress`는 React state updater 바깥에서 호출한다. IndexedDB 변경 후 새 namespace localStorage 신호로 다른 탭을 갱신하며 기존 맞고 캐시는 읽지 않는다. 중복 처리용 저장소를 recent 목록 정리와 함께 삭제하지 않는다. 브라우저 메모리 fallback도 같은 ID의 1회 반영을 유지한다.
- [ ] **Step 4:** 두 페이지가 같은 거래를 동시에 저장해도 한 번만 가산되는 브라우저 테스트를 작성한다. 진짜 IndexedDB에서 검증하며 localStorage mock으로 대체하지 않는다. 솔로 초기화 확인창 E2E는 Task 6에서 연결한다.
- [ ] **Step 5:** 단위 테스트 통과. 브라우저 테스트는 Task 6 화면 연결 후 실행할 대상으로 명시하고 해당 task에서 반드시 통과시킨다. 커밋: `feat: persist immediate points and three player history`.

### Task 5: 3인 Firebase 좌석·권한·판정 동기화

**Files:**
- Create: `src/multiplayer/room-membership.ts`, `src/multiplayer/state-codec.ts`, `tests/room-membership.test.ts`, `tests/state-codec.test.ts`.
- Modify: `src/multiplayer/types.ts`, `src/multiplayer/host.ts`, `src/multiplayer/requests.ts`, `src/multiplayer/firebase-transport.ts`, `src/multiplayer/firebase-client.ts`, `database.rules.json`, `tests/firebase-host.test.ts`, `tests/requests.test.ts`, `tests/transport-timeout.test.ts`, `firebase-tests/rules.test.ts`, `firebase-tests/transport.test.ts`, `docs/FIREBASE.md`.

**Interfaces:**
- Consumes: Task 2/3 state·action·event·PointTransfer. client-supplied seat는 UID 조회 결과로 덮어쓴다.
- `RoomMeta = { hostUid:string; seats:{ '0':string; '1'?:string; '2'?:string }; rosterVersion:number; status:'waiting'|'active'|'closed'; roomId:string; createdAt:number; expiresAt:number; updatedAt:number }`. host는0, guest는1/2. 이름·presence는 기존 players/{uid}에 둔다. UID 중복 금지, host와 roomId·createdAt·expiresAt 불변.
- Produces in membership: `claimSeat(meta:RoomMeta, uid:string): RoomMeta`, `releaseWaitingSeat(meta:RoomMeta, uid:string): RoomMeta`, `seatForUid(meta:RoomMeta, uid:string): SeatId | null`. 기존 멤버 재입장은 같은 자리, 새 입장은 waiting에서 빈 자리, 활성·닫힌 방 새 입장은 거절한다.
- `HostState`는 기존 revision/round/game/events에 세 자리 wins/points·processed·receipts·nextReady, `appliedTransferIds:string[]`, `settledGameId:string|null`를 사용한다. points는 in-memory BigInt. room.state의 data JSON에서는 모두 문자열로 변환한다. 다음 판 생성 시 이전 판 거래 중복 ID 집합은 교체하고 누적 stats는 유지한다.
- Produces: `encodeState(state:HostState): {version:number;data:string}`, `decodeState(room:RoomData): HostState`, `startGame(state:HostState, room:RoomData, rng:()=>number): HostState`, 기존 `processRequest(state,room,request,rng):HostState`, `roomMessage(room,code,uid,events):RoomMessage`, `readyToAct(room,state):boolean`.
- `RoomMessage`: 기존 필드 중 names/connected/nextReady/stats를 3자리로, `roomId`, `transactions`, `disconnectedSince:number|null` 추가. `game`는 개인 GameView. 첫 gameId는 `${roomId}:1`, 다음은 `${roomId}:${round}`.
- `FirebaseTransport.open(callbacks:Callbacks, code:string|undefined, name:string, resume?:boolean, client?:typeof firebaseClient): Promise<MultiplayerTransport>`의 기존 외부 형태 유지. action·ready·nextRound·leave·dispose 계약 유지. callback은 `state(message:RoomMessage):void`, `connection(connected:boolean):void`, `error(message:string):void`.

- [ ] **Step 1:** membership/host/codec 단위 테스트에 3자리 선점·동일 UID 재입장·2번 행동·위장 seat 덮어쓰기·stale/duplicate/누락 sequence, 세 명 모두 현재 판/버전 ready, 즉시 거래 시 stats 갱신·종료 중복 없음, 전원 nextReady·연속 나가리·80비트 state 왕복을 추가한다. 단위 테스트 실행 후 실패 확인.
- [ ] **Step 2:** membership과 state-codec를 구현한다. 모든 BigInt field를 명시적 DTO로 변환하고 parse 시 스키마/정수/자리/버전을 검증한다. 문자열 data의 빈 배열 보존 방식을 유지한다. parse 실패를 빈 게임으로 간주하여 새 판을 만들지 않는다. host는 매 성공 행동마다 새 거래만 stats에 반영하며 종료 승수는 settledGameId로 한 번만 반영한다.
- [ ] **Step 3:** Auth/RTDB 에뮬레이터에서 실제 SDK 테스트를 먼저 추가한다. 두 게스트 동시 참가→서로 다른 두 자리, 세 번째 게스트 거절, 같은 UID 복수 탭→한 자리, 대기 guest 이탈→빈 자리, active 이탈→종료, host 이탈→종료, 닫힌 방 재활성화 거절, expiresAt 변경 거절을 assert한다. `npm run test:firebase`로 기존 guestUid 모델 때문에 실패하는지 확인한다.
- [ ] **Step 4:** 좌석 선점·대기 자리 반환은 공개 최소 meta 전체의 단일 트랜잭션으로 처리하여 rosterVersion을 올리고 중복 UID를 막는다. `waiting→active`는 host가 세 UID·이름·접속을 확인한 뒤 같은 meta 트랜잭션으로 좌석을 고정한다. active 좌석은 변경 불가다. 이후 state 생성은 기존 game 존재 검사로 1회만 수행한다. 중간 단절이면 state/행동 진행을 대기하고, closed/expired면 쓰기를 거절한다. roster 전환과 게임 생성이 두 단계이므로 active+game=null 상태에서 host 복귀 시 같은 초기 gameId로 생성 재개하는 테스트를 둔다. 생성 rng는 트랜잭션 재시도 중 고정한 seed를 사용한다.
- [ ] **Step 5:** Rules의 권한 경계를 구현한다. 비참가자는 meta만 읽고 rooms 전체/방 state는 읽지 못한다. meta join은 자기 빈 좌석 추가와 rosterVersion 증가만, 대기 leave는 자기 guest 좌석 제거만 허용한다. 기존 다른 좌석·host·시간·상태 덮어쓰기를 거절한다. 참가자는 자기 presence/ready/actions만 쓰고 host만 state를 쓴다. 상위 `.write`로 하위 제한을 우회하지 않도록 meta의 전후 diff와 허용 필드를 검증한다. 새 생성/종료 후 삭제 권한과 활성 멤버 권한을 구분한다. active state 쓰기는 같은 고정 roster, 유효 TTL, closed 아님을 Rules에서도 확인한다.
- [ ] **Step 6:** 첫 판 자동 시작·세 명 연출 완료·presence·동일 UID 복구·2분 대기 안내·고정 TTL·전원 다음 판을 transport에 연결한다. 나가기/만료 시 먼저 최신 확정 거래를 저널에 반영하고 closed 상태와 마지막 state를 참가자에게 전달한다. state를 즉시 삭제하여 이미 커밋한 거래 수신을 놓치게 하지 않으며 종료 snapshot은 기존 참가자의 복구 수신이 가능하도록 보존한다. 방 코드 재사용 시 roomId 불일치로 옛 방 복구를 새 방 참가로 처리하지 않는다. host만 판정하며 guest 두 명의 수신은 항상 같은 revision을 가리킨다. 단순 presence 갱신은 events를 재생하지 않는다. 액션/가입 트랜잭션의 권한 실패를 성공으로 처리하지 않는다.
- [ ] **Step 7:** 에뮬레이터 테스트에 guest의 meta 부모 쓰기 우회·다른 UID 좌석/행동 변경·부정 status 변화·자리2·만료·전체 목록 거절을 검증한다. join/leave/start 경쟁, host 새로고침, 한 명 늦은 ready, 마지막 턴 복구, 중복 완료·nextRound를 실제 SDK로 확인한다. `npm test -- tests/firebase-host.test.ts tests/room-membership.test.ts tests/state-codec.test.ts tests/requests.test.ts tests/transport-timeout.test.ts`와 `npm run test:firebase` 모두 통과. 커밋: `feat: synchronize three player firebase rooms`.

### Task 6: 두 AI와 모바일 3인 화면·기록 연결

**Files:**
- Create: `src/lib/use-game-session.ts`, `src/lib/game-presenter.ts`, `src/components/GostopApp.tsx`, `src/components/GameTable.tsx`, `src/components/PlayerPanel.tsx`, `src/components/RoomLobby.tsx`, `src/components/RoundResult.tsx`, `tests/presenter.test.ts`, `tests/three-player-ai.test.ts`, `e2e/three-player-solo.spec.ts`.
- Modify: `src/game-engine/ai.ts`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/Captured.tsx`, `src/components/PlayHistory.tsx`, `src/components/GoStopDecision.tsx`, `src/components/Settings.tsx`, `src/lib/use-game-history.ts`, `e2e/debug-helper.ts`, `e2e/game.spec.ts`, `e2e/history-concurrency.spec.ts`, 기존 2인 전용 fixture/selector를 사용하는 e2e 파일.
- Remove: `src/components/MatgoApp.tsx`는 기능 이행 확인 후 제거. 재사용 Card/Modal/RabbitMark/BombPassCard와 에셋 유지. 미사용 legacy 경로 제거: `server/index.ts`, `server/rooms.ts`, `tests/rooms.test.ts`; 연관 수정: `package.json`, `package-lock.json`.

**Interfaces:**
- Consumes: 엔진/transport/저널과 Task 2의 relativeSeats.
- Produces: 기존 `chooseAction(view:GameView, player:SeatId, difficulty:Difficulty, rng?:()=>number):GameAction`, `Difficulty='easy'|'normal'|'hard'` 유지. 개인 뷰로만 두 상대의 기본점수·피박·광박 위험을 평가한다.
- `GameSession = { mode:'single'|'multi'; me:SeatId; names:SeatTuple<string>; view:GameView|null; room:RoomMessage|null; busy:boolean; error:string|null; startSolo(difficulty:Difficulty):void; joinRoom(name:string,code:string|null):Promise<void>; act(action:GameAction):Promise<void>; nextRound():Promise<void>; leave():Promise<void> }`. `useGameSession():GameSession`가 게임 권위 ref·transport 수명·AI·history 저장을 소유한다.
- `game-presenter.ts`: `reducePresentedEvent(view:GameView,event:GameEvent,me:SeatId):GameView`와 `playEvents(input:{ before:GameView; after:GameView; events:GameEvent[]; me:SeatId; speed:number; signal:AbortSignal; render:(view:GameView)=>void }):Promise<void>`를 export한다. 종료 후 after projection으로 맞춘다. DOM 카드 좌표 측정은 GameTable의 기존 card-motion을 통해 주입/연결하고 게임 판단을 하지 않는다.
- `GameTable({session}:{session:GameSession})`, `PlayerPanel({seat,name,player,score,current,connected})`는 GameView의 해당 필드 타입을 사용한다. `RoomLobby({session})`, `RoundResult({result,me,names,stats,nextReady,onNext,onLeave})`는 GameResult·SeatTuple·Stats 타입을 사용한다. 결과 통계 number 변환 없이 Points를 포맷한다.

- [ ] **Step 1:** `three-player-ai.test.ts`에서 0/1/2 모두 합법 행동, 두 상대 위협 평가, 뷰에 타인 hand·deck 부재, 국진/선택 phase·폭탄 패스, seeded 300판이 각각 200개 이하 행동으로 종료하며 매 행동 invariant 통과를 검증한다. `presenter.test.ts`는 자리2가 서로 다른 상대에게서 가져오는 피, 점수 거래·중복 이벤트를 올바르게 표시하고 취소된 연출이 최종 projection을 덮지 않는 것을 검증한다. 실행 후 실패 확인.
- [ ] **Step 2:** AI와 presenter를 구현한다. 하나의 authoritative ref에서 현재 AI 한 명씩만 실행하고 마지막 연출 완료 후 다음 AI를 예약한다. 나가기·새 판·컴포넌트 해제마다 AbortController/generation을 바꾸며 이전 AI timer·연출·history 구독을 해제한다. 멀티 UI는 자체 엔진 판정을 하지 않는다.
- [ ] **Step 3:** 기존 MatgoApp의 홈·별명·공유·확대·설정·뒤로가기·개발 fixture 기능을 새 작은 컴포넌트로 옮긴다. 나 하단·상대 두 명 상단·중앙 공유 바닥으로 배치하며 4+3 손패를 시작점으로 작은 화면에 맞춘다. 모든 상대 참조를 좌석 매핑으로 바꾸고 피 이동은 event.from 좌표에서 event.to로 이동한다. 고/스톱은 본인 차례에만 결정 가능하고 다른 사람 이름을 정확히 표시한다. 첫 선 안내·시작 보너스·국진 선택 설명도 3인 값으로 변경한다.
- [ ] **Step 4:** useGameSession에서 새 state를 받는 즉시 `persistGameProgress`를 호출한다. busy/연출과 저널 저장 성공을 혼동하지 않는다. 결과는 본인 승패와 별도로 실제 지급자·박·나가리 배수·즉시점수·세 자리 순변화를 표시한다. 동일한 최종 상태 반복 수신에는 record와 GA가 중복되지 않는다. 기록 초기화 확인창과 다른 탭 신호를 연결한다.
- [ ] **Step 5:** solo E2E에서 두 AI와 완주→다음 판→새로고침 후 기록, 국진 수동 전환 후 고·자기 턴 유지, 마지막 자동 STOP, 창 확대·Android Back 대체 탐색·연출 중 나가기/새 판을 검증한다. `390×844`, `360×640`, `320×568`에서 필수 카드·선택 버튼이 잘리지 않는지 실제 bounding box와 화면 캡처로 확인한다. 테스트 hook은 development debug에서만 노출하고 production에서는 제거한다.
- [ ] **Step 6:** 기존 2인 e2e 기대값을 새 규칙으로 바꾸되 navigation·motion·floor stability·equivalent-pi·PWA 회귀는 보존한다. 새 앱에서 사용하지 않는 legacy `server/index.ts`, `server/rooms.ts`, `tests/rooms.test.ts`와 `dev:server`/`start:server`, Socket.IO 의존성을 참조 확인 후 제거한다. 해당 테스트의 유효한 보안·중복 처리·복구 사례는 Firebase host/Rules 테스트로 옮기고 전용 Socket.IO 동작만 폐기한다. 엔진 변경 때문에 쓰지 않는 2인 서버를 새 3인 서버로 재구현하지 않는다. 원본 구현은 보존한 Git 이력에서 확인할 수 있다. 이 제거는 새로운 앱의 미사용 경로 정리이며 현재 운영 Firebase 회귀를 제외하는 사유로 쓰지 않는다.
- [ ] **Step 7:** `npm run typecheck`, `npm test`, `npm run test:e2e` 모두 통과. Task 4의 실제 IDB 다중 탭 테스트를 포함한다. 여러 TSX 수정 후 React 품질 스킬로 hooks·접근성·타입을 확인한다. 커밋: `feat: add three player table and solo gameplay`.

### Task 7: 멀티 전체 흐름·PWA·분석·출시 검사

**Files:**
- Create: `e2e/three-player-multiplayer.spec.ts`, `e2e/three-player-results.spec.ts`.
- Modify: `e2e/multiplayer-interruption.spec.ts`, `e2e/animation-recovery.spec.ts`, `e2e-production/pwa.spec.ts`, `e2e-production/update.spec.ts`, `e2e-production/analytics.spec.ts`, `tests/analytics.test.ts`, `tests/env.test.ts`, `src/lib/register-pwa.ts`, `src/lib/analytics.ts`, `scripts/build-offline-shell.mjs`, `scripts/prepare-standalone.mjs`, `playwright.config.ts`, `playwright.production.config.ts`, `.github/workflows/ci.yml`, `README.md`, `docs/RULES.md`, `docs/ARCHITECTURE.md`, `docs/FIREBASE.md`, `docs/QA.md`, `docs/ASSETS.md`, `.env.example`, `src/app/layout.tsx`의 공유 이미지 경로와 관련 social 에셋.

**Interfaces:**
- Consumes: 앞 단계의 공개 UI·debug fixture·세션·에뮬레이터. production game API/debug hook은 추가하지 않는다.
- GA 기존 `trackAnalyticsOnce(event,identity,mode)` 계약 유지. event는 game_start/game_end/room_create/room_join, mode는 single/multi, 전송 payload에 개인·방 식별값 없음. dedupe ID는 탭 내부에서만 사용한다.
- 새 공유 이미지 경로는 제품명 토끼고스톱에 맞춘다. 이미지를 새로 만들 때 imagegen 스킬 사용, 카드·원본 출처 표시는 보존.

- [ ] **Step 1:** 3개 독립 BrowserContext로 서로 다른 UID를 만든다. 2명일 때 waiting, 세 번째 연결 시 1회 자동 시작, 모든 me 자리·같은 revision·동일 공개 바닥, 잘못된 차례 거절, 패 선택·국진·고/스톱·독박·결과·전원 다음 판·나가기를 실제 UI와 에뮬레이터에서 검증한다. 네 번째 context는 참가 거절을 확인한다.
- [ ] **Step 2:** host 단절·guest 각각 단절·동시 두 명 단절·같은 UID 복귀, 현재 버전 ready가 한 명 부족한 상태, 마지막 턴 복구, 2분 안내 후 종료, 24시간 만료를 테스트한다. 시간 테스트는 테스트 전용 clock/에뮬레이터 fixture로 시간을 제어하고 2분/24시간 실시간 sleep을 하지 않는다. 세 기기의 상태·확정 점수는 일치하고 미완료 판 승패는 생성되지 않아야 한다.
- [ ] **Step 3:** `three-player-results.spec.ts`에 본인 자리2·독박 면제 패자·피박0면제·자뻑2피·즉시점수 후 중단·100판 초과 dedupe·80비트 음수 누적 표시를 추가한다. 화면 텍스트와 실제 저널 값·합계0을 함께 assert한다. 게임마다 본인과 상대 이름이 정확히 대응해야 한다.
- [ ] **Step 4:** 실패한 흐름을 해당 모듈에서 수정하고 기존 회귀 테스트를 유지한다. UI snapshot만으로 통신·저장 검증을 대체하지 않는다. Retry 증가나 임의 timeout 증가로 실패를 숨기지 않는다.
- [ ] **Step 5:** production 최초 온라인 로드→오프라인 새로고침→AI 2명과 완주, 새 SW 업데이트 후 진행 중 판/카드 유지, 원본 캐시 보존, 멀티는 오프라인 안내를 검증한다. GA는 production 호스트만 허용하고 Preview/debug/offline 비전송, 세 사람 각 1회 이벤트·query/hash 제거·금지 payload 없음, 같은 판 재수신 중복 없음을 확인한다.
- [ ] **Step 6:** RULES를 사용자 확정 정책으로 다시 작성한다. 총통5·3뻑3·허당없음·0피면제·자뻑2·연속나가리누적·기본족보·고 가산식·마지막턴 예외·국진·특수승리 배수·분배/피 이동을 명시한다. README/구조/Firebase/QA에서 2인/guestUid/기존 운영 ID/기존 GA 설명을 새 동작으로 바꾸고 카드 라이선스는 유지한다. CI를 타입→단위→Firebase→E2E→운영빌드→PWA 순으로 맞춘다. CI 운영 빌드 fixture는 명시적인 로컬 테스트용 프로젝트·호스트·GA ID를 사용하며 실 서비스로 요청하지 않는다.
- [ ] **Step 7:** `npm run typecheck`, `npm test`, `npm run test:firebase`, `npm run test:e2e`, `npm run build`, `npm run test:pwa`를 순서대로 실행하여 모두 통과시킨다. build는 실제 운영 설정 또는 명시적인 CI fixture를 사용한다. 배포 전 조건을 검사하는 검증 스킬과 전체 변경 리뷰를 수행하고 결과를 기록한다. 커밋: `test: verify three player gameplay and release flows`.

### Task 8: 새 저장소·Firebase·Vercel·GA 연결과 실서비스 확인

**Files:**
- Modify: 새 환경값의 이름만 `.env.example`, 새 공개 운영 주소·리소스 식별자는 `README.md`, `docs/FIREBASE.md`, `docs/QA.md`에 기록. 실제 키/로컬 환경은 Git에 추가하지 않는다.

**Interfaces:**
- Consumes: Task 7까지 검증된 앱·Rules·릴리스 커밋. 외부 변경은 사용자의 독립 운영 요구와 선택한 공개 저장소 범위 안에서 진행한다.
- Produces: `GNOJES/toki-gostop` 원격, 전용 Firebase/RTDB, 전용 Vercel 운영 URL, 별도 GA 스트림. 이름 충돌이면 실제 계정의 가용 ID를 확인하고 제품 이름은 유지한다.

- [ ] **Step 1:** 관련 GitHub/Firebase/Vercel/GA의 사용 가능한 연결·CLI 인증·권한을 읽기 전용으로 확인한다. Vercel 조작은 해당 플랫폼 스킬을 적용한다. 기존 `GNOJES/toki-gostop`가 있으면 새 빈 저장소라고 가정하지 말고 소유자·기본 브랜치·내용·관련성을 확인한다. 다른 프로젝트를 덮어쓰지 않는다.
- [ ] **Step 2:** 공개 저장소를 만들거나 확인된 대상에 연결하고 기존 Git 이력을 보존한다. `git remote -v`로 fetch/push 모두 `GNOJES/toki-gostop`임을 확인한 뒤 작업 브랜치만 push한다. 원본 matgo 원격으로 push하는 경로는 제거한다. PR을 만들면 Codex attach_artifact로 연결한다.
- [ ] **Step 3:** 전용 Firebase 프로젝트·RTDB·익명 인증을 구성한다. 잠금 Rules에서 시작해 Task 5의 검증된 Rules를 게시한다. 새 승인 project ID와 config를 환경에 등록하고 `FIREBASE_EXPECTED_PROJECT_ID`를 실제 값으로 맞춘다. 서비스 계정 키를 브라우저 설정에 넣지 않는다. 로컬 에뮬레이터는 demo-toki-gostop을 유지한다.
- [ ] **Step 4:** 새 Vercel 프로젝트를 새 저장소에 연결하고 Firebase·운영 origin·별도 GA ID를 등록한다. GA 스트림은 고스톱 전용으로 만들고 기존 맞고 스트림을 재사용하지 않는다. `NEXT_PUBLIC_` 값은 빌드에 포함되므로 실제 환경으로 다시 빌드한다. GA 계정 접근이 없으면 새 ID 발급/전달만 사용자에게 요청하고 임의 ID로 완료 처리하지 않는다.
- [ ] **Step 5:** 검증된 commit을 배포하고 운영 URL의 홈·metadata·설치명·초대 링크·3인 완료 판·재접속·다음 판·GA 이벤트·원본과 분리된 DB 쓰기를 확인한다. 새 Rules 게시가 프런트 배포보다 앞서야 한다. Vercel 접근 보호가 있으면 해당 접근 스킬로 확인한다.
- [ ] **Step 6:** 실제 휴대폰 3대의 터치·화면·복귀 검증은 가능한 장치에서 수행하고, 사용자 기기 확인이 필요한 항목은 명확히 표시한다. 인증/실기기/GA 권한이 없는 항목은 나머지 검증과 분리해 미완료로 보고한다. 배포 성공만으로 전체 게임·통계 검증 완료를 주장하지 않는다.
- [ ] **Step 7:** 새 원격·배포 URL·검증 결과·남은 운영 항목을 최종 보고한다. 기본 브랜치 병합은 선택한 개발 종료 절차를 따른다. 별도 worktree를 만들었다면 필요한 변경을 보존한 뒤 앱의 archive_worktree로 정리한다.

## 설계 결정과 작업 대응

| 설계 결정 | 구현 및 검증 |
| --- | --- |
| D01·D17 저장소·운영·GA 독립 | Task 1, 7, 8 |
| D02·D03 모드·방장 판정 | Task 5, 6, 7 |
| D04 순점수·D08 박·D09 고/독박·D13 나가리 | Task 2, 3, 4, 5, 7 |
| D05·D06 덱·분배·보너스·D07 선 | Task 3, 5, 6 |
| D10 피 이동·D11 즉시/특수 점수·D12 예외·D18 기본 족보 | Task 2, 3, 6, 7 |
| D14 시작·다음 판·이탈·TTL·D15 단절/제한시간 | Task 5, 6, 7 |
| D16 화면·독립 브라우저 기록 | Task 4, 6, 7 |

## 계획 검토와 실행 인계

이 문서는 실행 전 계획이다. 체크박스는 아직 실행하지 않은 작업을 뜻하며, 테스트 명령은 이번 계획 작성에서 수행한 결과가 아니다. 외부 리소스의 실제 ID는 Task 8에서 확보하며, 없으면 해당 배포 검증을 완료 처리하지 않는다.

실행 방법을 선택한 뒤 시작한다. 직접 실행은 같은 담당자가 순서대로 구현하고 마지막에 독립 리뷰를 받는 방식이다. 서브에이전트 실행은 단계별 구현·리뷰를 분리한다. 상태·정산·통신 인터페이스가 서로 이어지는 이 계획에는 직접 순차 실행을 추천한다. 구현 도중 독립 병렬 작업을 사용할지는 선택한 실행 방식과 적용 스킬을 따른다.
