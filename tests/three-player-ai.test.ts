import {expect,it} from 'vitest';
import {createGame,applyAction,projectState,assertInvariant} from '../src/game-engine/engine';
import {chooseAction} from '../src/game-engine/ai';
import {seededRandom} from '../src/game-engine/cards';
it('finishes 300 three-player games using private projections and legal actions',()=>{
 for(let seed=1;seed<=300;seed++){let s=createGame({seed});for(let n=0;s.phase!=='FINISHED'&&n<200;n++){const me=s.currentPlayer,v=projectState(s,me);expect(v.players.every(p=>!('hand' in p))).toBe(true);s=applyAction(s,chooseAction(v,me,'normal',seededRandom(seed+n))).nextState;assertInvariant(s);}expect(s.phase).toBe('FINISHED');expect(s.result!.settlement.roundDelta.reduce((a,b)=>a+b,0n)).toBe(0n);}
});
