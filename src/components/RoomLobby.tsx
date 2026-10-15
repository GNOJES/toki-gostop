import type { ReactNode } from 'react';
import type { RoomMessage } from '../multiplayer/types';
import { RabbitMark } from './RabbitMark';
export function RoomLobby({
  room,
  connected,
  onLeave,
  children,
}: {
  room: RoomMessage | null;
  connected: boolean;
  onLeave: () => void;
  children: ReactNode;
}) {
  return (
    <section className="connection-screen lobby">
      <header>
        <button className="icon-button" aria-label="나가기" onClick={onLeave}>
          ←
        </button>
        <span className="brand">
          토끼<span>고스톱</span>
          <RabbitMark />
        </span>
      </header>
      <span className="eyebrow">화투판을 펼쳤어요</span>
      <h1>{room ? '친구를 기다려요.' : '화투판에 연결 중…'}</h1>
      <p className="muted">링크를 보내거나, 아래 코드를 알려주세요.</p>
      {children}
      <ol className="lobby-seats">
        {([0, 1, 2] as const).map((id) => (
          <li key={id}>
            {room?.connected[id] ? `${room.names[id]} · 연결됨` : `${id + 1}번 자리 · 기다리는 중`}
          </li>
        ))}
      </ol>
      <p className="fine-print">
        방은 생성 후 24시간 유지됩니다. 세 명 모두 연결되면 자동으로 시작해요.
      </p>
      <p className="waiting-note">
        <span className="status-dot" />
        {connected ? '친구 두 명과 함께 칠 준비를 하고 있어요.' : '연결을 복구하고 있어요.'}
      </p>
    </section>
  );
}
