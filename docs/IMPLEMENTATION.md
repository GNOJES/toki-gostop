# 구현과 검증 인계

토끼고스톱의 로컬 구현을 8단계 계획에 따라 순차 진행했다. 원본 맞고 Git 이력을 유지하며 작업 브랜치는 `codex/gostop-three-player`다. 완료·미완료는 아래에 별도로 기록한다.

## 로컬 결과

혼자+AI 둘, 친구 세 명, 3인 규칙·순점수·독박, 모바일 화면·기존 연출, 즉시 거래를 포함한 기록, 재접속·TTL·전원 다음 판, 독립 설정·캐시·GA 코드를 구현했다. 순차 출시 게이트는 타입 성공, 단위 141/141, 실제 Firebase 11/11, E2E 80/80, 운영 빌드 성공, PWA 3/3이다. 독립 리뷰 결과는 아래에 이어 기록한다.

## 운영 연결

새 공개 저장소 대상은 GNOJES/toki-gostop이다. 기존 Git 자격 증명의 GNOJES 인증을 확인했고 지정 저장소 조회는 404였다. Vercel GNOJES 계정 접근을 확인했다. Firebase CLI는 미로그인이며 현재 Chrome에는 업무 Google 계정만 있어 개인 리소스를 만들지 않았다. 고스톱 전용 Firebase·GA 준비 전에는 운영 배포를 완료한 것으로 표시하지 않는다. 실제 휴대폰 세 대의 검증도 남아 있다.

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
