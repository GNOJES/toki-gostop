'use client';
import { useCallback, type RefObject, type Dispatch, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import { cardFlight, type FlightGeometry } from './card-motion';
import { feedback, type Preferences } from './preferences';
import type { Card as HwatuCard, GameView, GameEvent, SeatId } from '../game-engine/types';
import type { MultiplayerTransport } from '../multiplayer/types';
type Set<T> = Dispatch<SetStateAction<T>>;
export interface Motion {
  key: number;
  cards: HwatuCard[];
  kind: string;
  other: boolean;
  geometry: FlightGeometry;
  duration: number;
  strike?: { angle: number; dx: number; dy: number; swing: number };
}
type Waiting = Partial<
  Record<'hand' | 'deck', { cards: HwatuCard[]; geometry: FlightGeometry; mine: boolean }>
>;
interface Bindings {
  generation: RefObject<number>;
  queue: RefObject<Promise<void>>;
  viewRef: RefObject<GameView | null>;
  busyRef: RefObject<boolean>;
  skipRef: RefObject<boolean>;
  prefsRef: RefObject<Preferences>;
  meRef: RefObject<SeatId>;
  modeRef: RefObject<'single' | 'multi'>;
  roundRef: RefObject<number>;
  multiplayer: RefObject<MultiplayerTransport | null>;
  waitingFlight: RefObject<Waiting>;
  publish: (v: GameView) => void;
  setBusy: Set<boolean>;
  setMotion: Set<Motion | null>;
  setStruck: Set<Record<string, { card: HwatuCard; angle: number; dx: number; dy: number }>>;
  setLanding: Set<string | null>;
  setHighlight: Set<string[]>;
  setStatus: Set<string>;
  setSpecialEffect: Set<{ label: string; detail: string } | null>;
  setImpact: Set<{ key: number; x: number; y: number } | null>;
  setLog: Set<GameEvent[]>;
  setError: Set<string>;
}
export function reducePresentedEvent(view: GameView, event: GameEvent, me: SeatId): GameView {
  const next = structuredClone(view);
  const ids = new Set(event.cards?.map((c) => c.id));
  if (['CARDS_CAPTURED', 'BONUS_CAPTURED', 'PI_TRANSFERRED'].includes(event.type)) {
    next.floor = next.floor.filter((c) => !ids.has(c.id));
    if (event.type === 'PI_TRANSFERRED' && event.from !== undefined)
      next.players[event.from].captured = next.players[event.from].captured.filter(
        (c) => !ids.has(c.id),
      );
    for (const c of event.cards ?? [])
      if (!next.players[event.to ?? event.player].captured.some((x) => x.id === c.id))
        next.players[event.to ?? event.player].captured.push(c);
  }
  return next;
}
const eventLabel: Record<string, string> = {
  CARD_PLAYED: '패를 내려놓아요',
  FLOOR_MATCHED: '같은 무늬를 만났어요',
  DECK_CARD_REVEALED: '뒤집은 패를 확인해요',
  CARDS_CAPTURED: '패를 걷어와요',
  PI_TRANSFERRED: '상대 피를 가져와요',
  SCORE_CHANGED: '점수를 확인해요',
  TURN_ENDED: '다음 차례',
  FLOOR_MATCH_REQUIRED: '먹을 바닥패를 골라주세요',
};
const effectDetails: Record<string, string> = {
  BOMB: '세 장을 한 번에!',
  SWEEP: '바닥패를 모두 획득!',
  JJOK: '뒤집은 패까지 한 쌍!',
  TTADAK: '같은 월 네 장 획득!',
  PPUK_OCCURRED: '세 장이 바닥에 남아요',
  SHAKE: '승리하면 점수 두 배!',
};
export function useGamePresenter({
  generation,
  queue,
  viewRef,
  busyRef,
  skipRef,
  prefsRef,
  meRef,
  modeRef,
  roundRef,
  multiplayer,
  waitingFlight,
  publish,
  setBusy,
  setMotion,
  setStruck,
  setLanding,
  setHighlight,
  setStatus,
  setSpecialEffect,
  setImpact,
  setLog,
  setError,
}: Bindings) {
  return useCallback(
    (next: GameView, events: GameEvent[], newRound = false) => {
      const epoch = generation.current;
      if (!events.length) {
        if (!busyRef.current || newRound) publish(next);
        return;
      }
      busyRef.current = true;
      setBusy(true);
      queue.current = queue.current
        .then(async () => {
          if (epoch !== generation.current) return;
          let shown = structuredClone(viewRef.current ?? next);
          let motionKey = Date.now();
          const factor =
            skipRef.current && process.env.NODE_ENV === 'development'
              ? 0
              : window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 0.12
                : prefsRef.current.speed === 'physical'
                  ? 1
                  : prefsRef.current.speed === 'normal'
                    ? 0.65
                    : 0.35;
          const pause = async (ms: number) => {
            if (factor) await new Promise<void>((resolve) => setTimeout(resolve, ms * factor));
            return epoch === generation.current;
          };
          for (const e of events) {
            if (epoch !== generation.current) return;
            setLog((old) => [...old.slice(-100), e]);
            setStatus(e.label ?? eventLabel[e.type] ?? '');
            setHighlight(e.cards?.map((c) => c.id) ?? []);
            if (effectDetails[e.type])
              setSpecialEffect({ label: e.label ?? e.type, detail: effectDetails[e.type] });
            const mine = e.player === meRef.current;
            const ids = new Set(e.cards?.map((c) => c.id));
            const fly = async (
              cards: HwatuCard[],
              source: FlightGeometry,
              targetId?: string,
              deck = false,
            ) => {
              if (!cards.length) return true;
              const c = cards[0];
              // Reserve a real empty slot before measuring its final layout.
              if (!targetId && !shown.floor.some((f) => f.id === c.id)) {
                shown.floor.push(c);
                flushSync(() => {
                  setLanding(c.id);
                  publish({ ...shown });
                });
                targetId = c.id;
              }
              const geometry = cardFlight(cards, deck ? 'flip' : 'play', mine, targetId, {
                actor: e.player,
                from: e.from,
                to: e.to,
                me: meRef.current,
              });
              // Keep the original source even when the hand/deck changed during a choice.
              const centerX = source.fromX + source.width / 2;
              const centerY = source.fromY + source.height / 2;
              geometry.fromX = centerX - geometry.width / 2;
              geometry.fromY = centerY - geometry.height / 2;
              const strikes = [
                { angle: -14, dx: -6, dy: 4, swing: -16 },
                { angle: 12, dx: 7, dy: -3, swing: 18 },
                { angle: -9, dx: 4, dy: 6, swing: -10 },
                { angle: 17, dx: -5, dy: 1, swing: 14 },
              ];
              const strike = strikes[Math.floor(Math.random() * strikes.length)];
              setMotion({
                key: motionKey++,
                cards,
                kind: targetId === c.id ? 'place' : 'play',
                other: !mine,
                geometry,
                duration: 440 * factor,
                strike,
              });
              if (!(await pause(320))) return false;
              if (targetId !== c.id)
                setImpact({
                  key: motionKey,
                  x: geometry.toX + geometry.width / 2,
                  y: geometry.toY + geometry.height / 2,
                });
              feedback(prefsRef.current);
              if (!(await pause(120))) return false;
              if (targetId !== c.id && targetId)
                setStruck((old) => ({ ...old, [targetId!]: { card: c, ...strike } }));
              publish({ ...shown });
              setLanding(null);
              setMotion(null);
              return pause(140);
            };
            if (e.type === 'CARD_PLAYED' || e.type === 'BOMB') {
              const cards = e.cards ?? [];
              const source = cardFlight(
                cards,
                cards[0]?.isBonus ? 'bonus' : 'play',
                mine,
                undefined,
                { actor: e.player, me: meRef.current },
              );
              const choice = events.some(
                (event) => event.type === 'FLOOR_MATCH_REQUIRED' && event.stage === 'hand',
              );
              const match = events.find(
                (event) => event.type === 'FLOOR_MATCHED' && event.stage === 'hand',
              );
              if (mine) shown.hand = shown.hand.filter((c) => !ids.has(c.id));
              else
                shown.players[e.player].handCount = Math.max(
                  0,
                  shown.players[e.player].handCount - cards.length,
                );
              publish({ ...shown });
              if (cards[0]?.isBonus) {
                setStatus('보너스 쌍피');
                setMotion({
                  key: motionKey++,
                  cards,
                  kind: 'bonus',
                  other: !mine,
                  geometry: source,
                  duration: 360 * factor,
                });
                if (!(await pause(360))) return;
                if (!(await pause(650))) return;
              } else if (choice) {
                waitingFlight.current.hand = { cards, geometry: source, mine };
                setMotion({
                  key: motionKey++,
                  cards,
                  kind: 'waiting',
                  other: !mine,
                  geometry: source,
                  duration: 0,
                });
              } else if (
                !(await fly(
                  cards,
                  source,
                  match?.cards?.[1]?.id ??
                    (e.type === 'BOMB'
                      ? shown.floor.find((c) => c.month === cards[0]?.month)?.id
                      : undefined),
                ))
              )
                return;
            } else if (e.type === 'DECK_CARD_REVEALED') {
              const cards = e.cards ?? [];
              const source = cardFlight(cards, 'flip', mine, undefined, {
                actor: e.player,
                me: meRef.current,
              });
              shown.deckCount = Math.max(0, shown.deckCount - 1);
              publish({ ...shown });
              setMotion({
                key: motionKey++,
                cards,
                kind: 'flip',
                other: !mine,
                geometry: source,
                duration: 420 * factor,
              });
              if (!(await pause(420))) return;
              if (!(await pause(180))) return;
              if (cards[0]?.isBonus) {
                setMotion(null);
                continue;
              }
              const choice = events.some(
                (event) => event.type === 'FLOOR_MATCH_REQUIRED' && event.stage === 'deck',
              );
              const match = events.find(
                (event) =>
                  event.type === 'FLOOR_MATCHED' &&
                  event.stage === 'deck' &&
                  event.cards?.[0]?.id === cards[0]?.id,
              );
              if (choice) {
                waitingFlight.current.deck = { cards, geometry: source, mine };
                setMotion({
                  key: motionKey++,
                  cards,
                  kind: 'waiting',
                  other: !mine,
                  geometry: source,
                  duration: 0,
                });
              } else if (
                !(await fly(
                  cards,
                  source,
                  match?.cards?.[1]?.id ??
                    shown.floor.find((c) => c.month === cards[0]?.month && !c.isBonus)?.id,
                  true,
                ))
              )
                return;
            } else if (
              e.type === 'CARDS_CAPTURED' ||
              e.type === 'PI_TRANSFERRED' ||
              e.type === 'BONUS_CAPTURED'
            ) {
              const kind =
                e.type === 'PI_TRANSFERRED'
                  ? 'transfer'
                  : e.type === 'BONUS_CAPTURED'
                    ? 'bonus-capture'
                    : 'capture';
              setMotion({
                key: motionKey++,
                cards: e.cards ?? [],
                kind,
                other: !mine,
                geometry: cardFlight(e.cards ?? [], kind, mine, undefined, {
                  actor: e.player,
                  from: e.from,
                  to: e.to,
                  me: meRef.current,
                }),
                duration: 450 * factor,
              });
              feedback(prefsRef.current);
              if (!(await pause(450))) return;
              setStruck((old) =>
                Object.fromEntries(
                  Object.entries(old).filter(
                    ([target, hit]) => !ids.has(target) && !ids.has(hit.card.id),
                  ),
                ),
              );
              shown = reducePresentedEvent(shown, e, meRef.current);
              publish({ ...shown });
              setMotion(null);
            } else if (e.type === 'FLOOR_MATCHED') {
              const stage = e.stage ?? 'hand';
              const waiting = waitingFlight.current[stage];
              if (waiting && waiting.cards[0]?.id === e.cards?.[0]?.id) {
                delete waitingFlight.current[stage];
                if (
                  !(await fly(waiting.cards, waiting.geometry, e.cards?.[1]?.id, stage === 'deck'))
                )
                  return;
              }
            } else if (e.type === 'SCORE_CHANGED') {
              shown.scores[e.player] = next.scores[e.player];
              publish({ ...shown });
              if (!(await pause(350))) return;
            } else if (e.label) {
              feedback(prefsRef.current, 'special');
              if (!(await pause(850))) return;
            }
          }
          if (epoch !== generation.current) return;
          publish(next);
          if (next.phase !== 'SELECT_FLOOR') {
            setMotion(null);
            setStruck({});
            setImpact(null);
            waitingFlight.current = {};
          }
          setLanding(null);
          setHighlight([]);
          setStatus('');
          setSpecialEffect(null);
          setImpact(null);
          busyRef.current = false;
          setBusy(false);
          if (modeRef.current === 'multi')
            void multiplayer.current
              ?.ready(roundRef.current, next.stateVersion)
              .catch(() => setError('연결을 복구하고 있어요.'));
        })
        .catch(() => {
          if (epoch === generation.current) {
            publish(next);
            setBusy(false);
            busyRef.current = false;
            setMotion(null);
            setStruck({});
            setImpact(null);
            setLanding(null);
            waitingFlight.current = {};
            setStatus('');
            setHighlight([]);
            setSpecialEffect(null);
            setError('패 이동을 복구했어요. 계속 칠 수 있어요.');
            if (modeRef.current === 'multi')
              void multiplayer.current
                ?.ready(roundRef.current, next.stateVersion)
                .catch(() => setError('연결을 복구하고 있어요.'));
          }
        });
    },
    [publish],
  );
}
