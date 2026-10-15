export type SeatId = 0 | 1 | 2;
export type PlayerId = SeatId;
export type SeatTuple<T> = [T, T, T];
export type Points = bigint;
export type EndReason = 'STOP' | 'NAGARI' | 'CHONGTONG' | 'THREE_PPUK';
export interface PointTransfer {
  id: string;
  from: SeatId;
  to: SeatId;
  amount: Points;
  kind: 'INSTANT' | 'FINAL';
  reason: 'OPENING_PPUK' | 'OPENING_TTADAK' | EndReason;
}
export interface RoundSettlement {
  baseScore: number;
  commonMultiplier: Points;
  liabilities: SeatTuple<Points>;
  payerFor: SeatTuple<SeatId | null>;
  transfers: PointTransfer[];
  roundDelta: SeatTuple<Points>;
}
export type Category = 'GWANG' | 'YEOL' | 'TTI' | 'PI' | 'BONUS';
export type RibbonType = 'HONGDAN' | 'CHEONGDAN' | 'CHODAN' | 'NONE';
export interface Card {
  id: string;
  month: number;
  name: string;
  category: Category;
  isGwang: boolean;
  isYeol: boolean;
  isTti: boolean;
  isPi: boolean;
  piValue: number;
  isBonus: boolean;
  isGodori: boolean;
  ribbonType: RibbonType;
  specialType: 'RAIN' | 'KUKJIN' | 'DOUBLE_PI' | null;
}
export interface PlayerState {
  hand: Card[];
  captured: Card[];
  goCount: number;
  goAtScore: number;
  shakes: number[];
  bombs: number;
  bombPasses: number;
  turnsRemaining: number;
  ppukCount: number;
  openingPpukStreak: number;
  emptyStreak: number;
  kukjinAsPi: boolean;
}
export interface TurnState {
  played: Card | null;
  playMatches: Card[];
  chosen: Card | null;
  revealed: Card | null;
  bonuses: Card[];
  captured: Card[];
  transfer: number;
  last: boolean;
  bomb: boolean;
  stage: 'hand' | 'deck';
  options: string[];
}
export interface ScoreBreakdown {
  gwangScore: number;
  yeolScore: number;
  godoriScore: number;
  ribbonScore: number;
  hongdanScore: number;
  cheongdanScore: number;
  chodanScore: number;
  piScore: number;
  piCount: number;
  yeolCount: number;
  baseScore: number;
}
export type ScoreResult = ScoreBreakdown;
export interface GameResult {
  winner: SeatId | null;
  reason: EndReason;
  settlement: RoundSettlement;
}
export interface GameState {
  gameId: string;
  transactions: PointTransfer[];
  players: SeatTuple<PlayerState>;
  floor: Card[];
  deck: Card[];
  currentPlayer: PlayerId;
  dealer: PlayerId;
  dealerDraw: SeatTuple<number>;
  dealerDrawHistory?: SeatTuple<number>[];
  phase: 'PLAY' | 'SELECT_FLOOR' | 'SELECT_KUKJIN' | 'GO_STOP' | 'FINISHED';
  /** Manual conversion asks for Go before the player has spent this turn. */
  continueTurnAfterGo?: boolean;
  turn: TurnState | null;
  ppukOwners: Record<number, PlayerId>;
  bonusAttachments: Record<string, number>;
  lastGo: PlayerId | null;
  nagariStreak: number;
  stateVersion: number;
  turnNumber: number;
  result: GameResult | null;
}
export type GameAction =
  | { type: 'PLAY_CARD'; player: PlayerId; cardId: string; shake?: boolean }
  | { type: 'SELECT_FLOOR'; player: PlayerId; cardId: string }
  | { type: 'BOMB'; player: PlayerId; month: number }
  | { type: 'PASS'; player: PlayerId }
  | { type: 'GO' | 'STOP'; player: PlayerId }
  | { type: 'SET_KUKJIN'; player: PlayerId; asPi?: boolean };
export interface GameEvent {
  from?: SeatId;
  to?: SeatId;
  requestedPi?: number;
  actualPi?: number;
  type: string;
  player: PlayerId;
  cards?: Card[];
  label?: string;
  points?: number;
  stage?: 'hand' | 'deck';
}
export interface ActionResult {
  nextState: GameState;
  events: GameEvent[];
}
export interface PlayerView extends Omit<PlayerState, 'hand'> {
  handCount: number;
}
export interface GameView {
  gameId: string;
  transactions: PointTransfer[];
  players: SeatTuple<PlayerView>;
  hand: Card[];
  floor: Card[];
  deckCount: number;
  bonusAttachments: Record<string, number>;
  currentPlayer: PlayerId;
  dealer: PlayerId;
  dealerDraw: SeatTuple<number>;
  dealerDrawHistory?: SeatTuple<number>[];
  phase: GameState['phase'];
  options: string[];
  turnCards: Card[];
  stateVersion: number;
  turnNumber: number;
  result: GameResult | null;
  nagariStreak: number;
  lastGo: PlayerId | null;
  scores: SeatTuple<ScoreBreakdown>;
}
export { RULES } from './rules';
