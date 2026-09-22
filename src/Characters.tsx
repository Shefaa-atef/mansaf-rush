import { PolishedStudioCharacter } from './PolishedStudioCharacter';
import { PolishedBlenderCharacter } from './PolishedBlenderCharacter';
import { BlenderCharacter } from './BlenderCharacter';
import { StudioCharacter } from './StudioCharacter';
import { memo, useEffect, type RefObject } from 'react';
import type { Game } from './main';
import { markPartReady } from './sceneReadiness';
import { playEat, unlockAudio } from './sfx';

type V3 = [number, number, number];
function enableBotSound(){unlockAudio();}
function botChew(){playEat('bot');}

/**
 * What a seat shows until its model has loaded: nothing. The model loaders render this while they
 * wait, and stop rendering it the moment the model is in, so its unmounting is the signal that the
 * seat is ready (main.tsx holds the round back until every seat is). The simple stand-in figures
 * that used to fill the seats for the first moments are gone: only the real characters are ever drawn.
 */
function EmptySeat({ id }: { id: number }) {
  useEffect(() => () => markPartReady(id), [id]);
  return null;
}

// position and angle are placed by each character's own model; they stay in the props only because callers pass them.
export const Character = memo(function Character(props: { id: number; position: V3; angle: number; game: RefObject<Game> }) {
  const empty = <EmptySeat id={props.id} />;
  const mobile = window.innerWidth <= 700;
  const defaults: V3[] = [[0, 0, 0], [-2.02, 0, -0.3], [0, 0, -2.05], [2.02, 0, -0.3]];
  const base = defaults[props.id];
  const offset: V3 = mobile ? [props.position[0] - base[0], props.position[1], props.position[2] - base[2]] : [0, 0, 0];
  const child = new URLSearchParams(window.location.search).get('characters') !== 'original'
    ? (props.id === 1 ? <PolishedStudioCharacter id={props.id} game={props.game} fallback={empty} onChew={botChew} onUnlock={enableBotSound}/> : <PolishedBlenderCharacter id={props.id} game={props.game} fallback={empty} onChew={botChew} onUnlock={enableBotSound}/>)
    : (props.id === 1 ? <StudioCharacter id={props.id} game={props.game} fallback={empty} onChew={botChew} onUnlock={enableBotSound}/> : <BlenderCharacter id={props.id} game={props.game} fallback={empty} onChew={botChew} onUnlock={enableBotSound}/>);
  return <group position={offset}>{child}</group>;
});
