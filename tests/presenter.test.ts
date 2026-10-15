import {expect,it} from 'vitest';
import {reducePresentedEvent} from '../src/lib/game-presenter';
import {projectState} from '../src/game-engine/engine';
import {makeGostopFixture} from './helpers/gostop-fixture';
it('removes transferred cards only from the actual source and adds them to seat one once',()=>{
 const s=makeGostopFixture({hands:[[],[],[]],floor:[],draw:[],captured:[['m1-2'],[],['m11-1']]});const before=projectState(s,1),card=s.players[2].captured[0];
 const e={type:'PI_TRANSFERRED',player:1 as const,from:2 as const,to:1 as const,cards:[card],requestedPi:1,actualPi:2};
 const next=reducePresentedEvent(before,e,1);expect(next.players[0].captured.map(c=>c.id)).toEqual(['m1-2']);expect(next.players[2].captured).toEqual([]);expect(next.players[1].captured).toEqual([card]);expect(reducePresentedEvent(next,e,1)).toEqual(next);expect(before.players[2].captured).toEqual([card]);
});
