import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, runTransaction, update } from 'firebase/database';
import { decodeState, encodeState } from '../src/multiplayer/state-codec';
import type { HostState, RoomMeta, RoomData } from '../src/multiplayer/types';
export async function editRoom(code: string, change: (state: HostState) => void) {
  const env = await initializeTestEnvironment({
    projectId: 'demo-toki-gostop',
    database: { host: '127.0.0.1', port: 9100 },
  });
  try {
    await env.withSecurityRulesDisabled(async (c) => {
      const location = ref(
        c.database('https://demo-toki-gostop-default-rtdb.firebaseio.com'),
        'rooms/' + code + '/state',
      );
      const initial = await get(location);
      await runTransaction(
        location,
        (value) => {
          const state = decodeState({ state: value ?? initial.val() });
          const version = state.game!.stateVersion;
          change(state);
          state.game!.stateVersion = version + 1;
          state.revision++;
          state.events = [{ type: 'SCORE_CHANGED', player: state.game!.currentPlayer }];
          return encodeState(state);
        },
        { applyLocally: false },
      );
    });
  } finally {
    await env.cleanup();
  }
}
export async function editMeta(code: string, change: Partial<RoomMeta>) {
  const env = await initializeTestEnvironment({
    projectId: 'demo-toki-gostop',
    database: { host: '127.0.0.1', port: 9100 },
  });
  try {
    await env.withSecurityRulesDisabled((c) =>
      update(
        ref(
          c.database('https://demo-toki-gostop-default-rtdb.firebaseio.com'),
          'rooms/' + code + '/meta',
        ),
        change,
      ),
    );
  } finally {
    await env.cleanup();
  }
}
export async function findRoomByName(name: string): Promise<{ meta: RoomMeta } | undefined> {
  const env = await initializeTestEnvironment({
    projectId: 'demo-toki-gostop',
    database: { host: '127.0.0.1', port: 9100 },
  });
  let found: RoomData | undefined;
  try {
    await env.withSecurityRulesDisabled(async (c) => {
      const rooms =
        (
          await get(
            ref(c.database('https://demo-toki-gostop-default-rtdb.firebaseio.com'), 'rooms'),
          )
        ).val() ?? {};
      found = Object.values(rooms as Record<string, RoomData>).find((room) =>
        Object.values(room.players ?? {}).some((p) => p.name === name),
      );
    });
    return found;
  } finally {
    await env.cleanup();
  }
}
export async function finishCreationCooldown(uid: string) {
  const env = await initializeTestEnvironment({
    projectId: 'demo-toki-gostop',
    database: { host: '127.0.0.1', port: 9100 },
  });
  try {
    await env.withSecurityRulesDisabled((c) =>
      update(
        ref(
          c.database('https://demo-toki-gostop-default-rtdb.firebaseio.com'),
          `roomOwners/${uid}`,
        ),
        { createdAt: Date.now() - 11000 },
      ),
    );
  } finally {
    await env.cleanup();
  }
}
