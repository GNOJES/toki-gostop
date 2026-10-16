# 구현과 검증 인계

토끼고스톱의 로컬 구현을 8단계 계획에 따라 순차 진행했다. 원본 맞고 Git 이력을 유지하며 작업 브랜치는 `codex/gostop-three-player`다. 완료·미완료는 아래에 별도로 기록한다.

## 로컬 결과

혼자+AI 둘, 친구 세 명, 3인 규칙·순점수·독박, 모바일 화면·기존 연출, 즉시 거래를 포함한 기록, 재접속·TTL·전원 다음 판, 독립 설정·캐시·GA 코드를 구현했다. 순차 출시 게이트는 타입 성공, 단위 143/143, 실제 Firebase 13/13, E2E 81/81, 운영 빌드 성공, PWA 3/3이다. 독립 리뷰에서 확인한 방 시작/나가기 경합, 끊긴 사용자 이름, 대기 중 생성 취소를 재현한 뒤 한 번의 보완 단계에서 수정하고 전체 게이트를 다시 통과했다.

## 운영 연결

새 공개 저장소 [GNOJES/toki-gostop](https://github.com/GNOJES/toki-gostop)을 생성했다. 기존 Git 자격 증명의 GNOJES 인증과 공개 범위를 확인했으며 origin의 fetch/push를 모두 새 저장소로 변경했다. 작업 브랜치 [codex/gostop-three-player](https://github.com/GNOJES/toki-gostop/tree/codex/gostop-three-player)를 업로드하고 원격 SHA가 검증 커밋과 일치함을 확인했다. 전용 Firebase `toki-gostop`에 Rules와 익명 인증을 게시하고 Vercel `toki-gostop` 운영 환경을 연결했다(2026-10-16). 운영 주소는 https://toki-gostop.vercel.app, GA는 `G-EFG7BB6NEN`이다. 배포 `dpl_3QEJVda32czkLWcUaeQ4mFT7Kgc8`은 검증 커밋 `c99b078b1fd43f792aac2927260e6bb6e40ef020`으로 READY이며 빌드에서도 단위 143개가 통과했다. 실제 운영 세 브라우저로 익명 인증·방 생성·3명 자동 시작·새로고침 자리 복구·완료 판 결과·전원 다음 판·나가기 방 종료를 확인했다. 혼자+AI 둘의 시작과 운영 GA 전송 요청 6건도 확인했다. 실제 휴대폰 세 대와 GA 관리 화면 수신 확인은 남아 있다.

## 실행 중 판단과 영향

아래는 계획을 이행하면서 내린 판단의 전체 기록이다. 변경 이유와 틀렸을 경우의 영향은 각 행에 남긴다.

- Ruling: Reuse the user's copied toki-gostop checkout on a feature branch, as the approved plan prioritizes this workspace; no extra worktree or dependency installation — node_modules already present and no competing work — no isolation of ignored env files, so production config is validated against original project IDs.

- Ruling: Plan permits intermediate type failures while shared contracts migrate; run targeted tests during migration and full tests/typecheck before UI integration completion — avoids temporary compatibility code for 2-player semantics — no intermediate build is releasable.

- Task 3: Ruling: Move minimal two-opponent AI adaptation from Task 6 to Task 3 — existing full-round engine simulation directly calls AI and fails at seat 2 — heuristic tuning/UI remain Task 6; no hidden-hand access introduced.

- Task 3: Ruling: PI_TRANSFERRED now groups actual cards per source seat, as designed; migrate old assertions from number of events to transferred cards/value — preserves original transfer verification under two-source events.

- Task 4: Ruling: Real IndexedDB cross-tab test needs the Task 6 development debug bridge; unit ledger/fallback tested now, execute the browser case before Task 6 completion as the plan permits. readHistory never publishes a storage event, avoiding cross-tab refresh feedback loops.

- Task 5: Ruling: Use dedicated gostop emulator ports (Auth 9199, RTDB 9100, UI 4400), rather than original matgo 9099/9000, for explicit separation from original matgo development; initial CLI port-taken message was actually sandbox EPERM on bind, not evidence of another process — tests and client move together; setup docs must state new ports.

- Task 6: Ruling: Preserve and extract the existing card choreography as useGamePresenter; keep room assembly in GostopApp and expose a smaller local-authority useGameSession/useCpuTurn API rather than replacing the whole UI loop — protects established choice/flight/back behavior while separating state and presenter responsibilities — screen assembler remains larger than originally targeted.

- Task 6: Ruling: Keep readable INSTANT transfer records (game, mode, names, me, signed endpoints/value) in the browser history alongside dedupe IDs — aborted friend rounds otherwise retained IDs but lost the actual payment details — storage grows with immediate transactions; UI displays latest 100 without truncating the journal. New failing persistence regression observed undefined, then green; solo reset removes its details but preserves dedupe IDs.

## 독립 리뷰 보완 결과 (2026-10-16)

- waiting 화면에서 나가기를 눌렀지만 host가 active를 먼저 커밋한 경우: 최신 meta를 기준으로 원자적으로 방을 종료한다. 재시도 단위 테스트 RED→GREEN 및 실제 Firebase SDK/Rules 확인.
- 재접속 대기 이름: 실제 끊긴 자리들의 이름을 표시한다. 세 UID 각각과 복수 단절 UI 테스트 RED→GREEN.
- 최초 상태 수신 전 생성 취소: meta 조회 후 방을 정리하고 entering을 해제한다. 명시적 취소와 자동 재접속의 낡은 연결 정리를 구별해 새로고침으로 방을 닫지 않는다. 지연시킨 익명 인증 요청 취소→DB closed→재생성 실제 UI 테스트 RED→GREEN. 원래의 10초 생성 제한은 테스트용 에뮬레이터 데이터로만 시간을 넘겨 검증했다.
- 최종 게이트: 타입 성공 / 단위 143 / Firebase 13 / Chromium·WebKit 81 / 운영 빌드 성공 / PWA 3. 중단·미실행·재시도로 통과시킨 테스트 없음. 미해결 Critical/Important 및 보류한 Minor 없음.
- Task 8의 Firebase·GA 설정과 Vercel 운영 배포 및 세 브라우저 검증을 완료했다. 실제 휴대폰 검증과 GA 관리 화면 수신 확인은 남아 있으며 자동 브라우저 검증과 구분한다.

추가 판단: 기존 구현에서 물려받은 생성 취소도 방을 다시 만들 수 없게 하는 사용자 문제여서 이번에 보완했다. 최초 snapshot 전 나가기에 meta 읽기가 한 번 추가된다.
