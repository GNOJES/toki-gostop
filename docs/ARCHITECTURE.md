# 구조

## 엔진과 정산

`src/game-engine`은 React·DOM·통신에 의존하지 않는다. `createGame` → `applyAction` → immutable nextState와 events로 진행한다. SeatId는 0/1/2이며 플레이어와 점수는 길이 3 튜플이다. `projectState`는 자기 손패와 상대 장수만 공개하고 AI도 이 뷰만 받는다. PLAY / SELECT_FLOOR / SELECT_KUKJIN / GO_STOP / FINISHED 상태를 사용한다. 성공 행동마다 50장 고유 카드·정규 턴 보존을 검사한다.

`scoring.ts`는 기본 족보, `settlement.ts`는 승리 배수·각 패자 부담·독박 지급자를 계산한다. PointTransfer가 즉시/최종 거래의 유일한 원장이다. 게임 ID와 안정적인 거래 ID로 재수신을 중복 반영하지 않는다. Points는 bigint이며 Firebase/기록 JSON에서는 정규 십진 문자열이다.

## 화면과 AI

Next.js App Router + React, 한국어 모바일 세로 화면이다. `GostopApp`이 홈·방·설정·탐색을 조립하고 `GameTable`, `PlayerPanel`, `RoomLobby`, `RoundResult`를 사용한다. 상대 두 명은 상단, 공유 바닥·덱은 중앙, 나는 하단이며 손패는 4+3이다. 친구용 이름은 solo에 사용하지 않는다.

`useGameSession`은 solo 권위 ref와 행동을, `useCpuTurn`은 현재 AI 한 명의 예약을 담당한다. `useGamePresenter`는 기존 이벤트 연출을 직렬 재생하고 최종 projection으로 맞춘다. 새 판·이탈 때 generation을 바꿔 이전 연출과 AI를 무효화한다. 카드 좌표는 DOM 순서 대신 data-player-seat를 기준으로 찾고 피 이동은 from/to 자리로 이동한다. 확대·설정·필수 선택·고/스톱과 Back 처리를 유지한다. 개발 hook은 development와 debug=1에서만 존재한다.

## Firebase와 연결 복구

Firebase SDK는 친구방 진입 때 동적으로 가져온다. `firebase-client.ts`는 전용 설정·익명 인증, `firebase-transport.ts`는 자리 선점·presence·큐·ready·수명, `host.ts`는 엔진 판정·다음 판·통계를 담당한다. UI는 직접 Firebase 판정이나 lockstep 실행을 하지 않는다.

네 자리 방 코드와 URL/QR 초대를 사용한다. meta.seats의 세 자리를 원자적으로 선점한다. 같은 UID는 같은 자리다. 세 명 연결 시 host가 첫 판을 한 번 시작하며 현재 round/version의 ready가 모두 모여야 행동할 수 있다. 자신의 actions/uid/seq에 요청을 쓰고 host가 UID로 player를 확정한 뒤 순번·판·버전·턴·소유권을 검사한다. receipt와 통계는 상태 transaction에서 함께 확정된다.

state.data는 HostState 전체를 문자열 JSON으로 저장해 RTDB의 빈 배열 소실을 피한다. codec은 점수를 bigint로 복원한다. revision(요청 처리)과 game.stateVersion(게임 행동)은 구별한다. 재접속은 최신 snapshot으로 복원하며 지난 연출을 반복하지 않는다. 다음 판은 전원 동의 후 생성한다. 누구든 단절하면 모두 대기하며 방장 자동 교체는 없다. 종료 방의 마지막 상태는 TTL까지 남겨 확정 거래를 보존한다.

Rules는 비인증·비참가자의 전체 방 조회, 비방장의 최종 state 쓰기, 타인 행동 쓰기를 거절한다. 가입용 최소 meta는 코드가 있는 익명 사용자가 읽을 수 있다. **신뢰하는 세 참가자는 Firebase 전체 상태의 타인 손패·미래 덱을 개발자 도구로 볼 수 있다.** 이 공개 범위는 확정 설계다. 자세한 경로와 운영 절차는 [FIREBASE](FIREBASE.md)를 참고한다.

## 기록·오프라인·분석

`history-store.ts`는 하나의 IndexedDB transaction으로 history, appliedTransfers, completedGames를 갱신한다. 읽기에는 탭 알림을 발행하지 않는다. 초기화해도 중복 방지 ID는 유지한다. 최근 기록 100개 제한과 거래 중복 방지는 별개다. 사용 불가 환경은 메모리 fallback이다.

PWA 캐시·저장 키는 toki-gostop 전용이며 맞고 캐시를 삭제하지 않는다. 최초 온라인 로드 후 오프라인 solo를 지원한다. 워커 갱신 시 열린 판을 새로고침하지 않고 에셋 주소를 교체한다. GA는 설정한 production origin에서만 동작하며 query/hash·닉네임·방 코드·손패를 전송하지 않는다. game_start/game_end/room_create/room_join과 single/multi만 전송하고 중복 ID는 탭 내부에 보관한다.
