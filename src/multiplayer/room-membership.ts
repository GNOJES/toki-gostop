import type { RoomMeta } from './types';
import type { SeatId } from '../game-engine/types';
export function seatForUid(meta: RoomMeta, uid: string): SeatId | null {
  for (const id of [0, 1, 2] as const) if (meta.seats[id] === uid) return id;
  return null;
}
export function claimSeat(meta: RoomMeta, uid: string): RoomMeta {
  if (meta.status === 'closed' || meta.expiresAt <= Date.now()) throw Error('종료된 방이에요.');
  if (seatForUid(meta, uid) !== null) return meta;
  if (meta.status !== 'waiting') throw Error('이미 게임을 시작한 방이에요.');
  const seat = ([1, 2] as const).find((id) => !meta.seats[id]);
  if (seat === undefined) throw Error('방이 가득 찼어요. 세 사람이 이미 참여했어요.');
  return { ...meta, seats: { ...meta.seats, [seat]: uid }, rosterVersion: meta.rosterVersion + 1 };
}
export function releaseWaitingSeat(meta: RoomMeta, uid: string): RoomMeta {
  const seat = seatForUid(meta, uid);
  if (meta.status !== 'waiting' || seat === 0 || seat === null)
    throw Error('자리를 비울 수 없어요.');
  const seats = { ...meta.seats };
  delete seats[seat];
  return { ...meta, seats, rosterVersion: meta.rosterVersion + 1 };
}
