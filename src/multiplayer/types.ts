import type {
  GameAction,
  GameEvent,
  GameState,
  GameView,
  SeatId,
  SeatTuple,
  PointTransfer,
  Points,
} from '../game-engine/types';
export interface Stats {
  wins: SeatTuple<number>;
  points: SeatTuple<Points>;
}
export interface RoomMeta {
  hostUid: string;
  seats: { '0': string; '1'?: string; '2'?: string };
  rosterVersion: number;
  status: 'waiting' | 'active' | 'closed';
  roomId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}
export interface RoomMessage {
  code: string;
  roomId: string;
  me: SeatId;
  nickname: string;
  names: SeatTuple<string>;
  connected: SeatTuple<boolean>;
  round: number;
  stats: Stats;
  nextReady: SeatTuple<boolean>;
  actionSequence: number;
  canAct: boolean;
  game: GameView | null;
  events: GameEvent[];
  transactions: PointTransfer[];
  revision: number;
  closed: boolean;
  expiresAt: number;
  disconnectedSince: number | null;
}
export interface Envelope {
  round: number;
  sequence: number;
  stateVersion: number;
  action: GameAction | { type: 'NEXT_ROUND' };
}
export interface Request extends Envelope {
  uid: string;
  createdAt: number;
}
export interface HostState {
  revision: number;
  round: number;
  game: GameState | null;
  events: GameEvent[];
  stats: Stats;
  processed: SeatTuple<number>;
  nextReady: SeatTuple<boolean>;
  receipts: SeatTuple<{ seq: number; error?: string }>;
  appliedTransferIds: string[];
  settledGameId: string | null;
}
export interface PlayerRecord {
  name: string;
  connections?: Record<string, boolean>;
  ready?: { round: number; version: number };
}
export interface RoomData {
  meta: RoomMeta;
  players?: Record<string, PlayerRecord>;
  state: { version: number; data: string };
  actions?: Record<string, Record<string, Request>>;
}
export interface MultiplayerTransport {
  readonly code: string;
  readonly uid: string;
  readonly connected: boolean;
  action(envelope: Envelope): Promise<void>;
  ready(round: number, version: number): Promise<void>;
  nextRound(round: number, version: number, sequence: number): Promise<void>;
  leave(): Promise<void>;
  dispose(): void;
}
