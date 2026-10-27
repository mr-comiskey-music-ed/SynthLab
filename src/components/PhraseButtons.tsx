import React, { useEffect, useRef, useState } from 'react';
import { SynthParams, PhraseId, PhraseNote } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import { PHRASES, playPhrase, loopPhrase, stopPhrase } from '../utils/playback';
import { Volume2, Repeat } from 'lucide-react';

/**
 * The words on the two buttons live here, so every challenge says the same thing.
 * "Play: Melody" / "Loop: Melody" (and "Stop loop" while it repeats).
 */
export const PLAY_LABEL = 'Play';
export const LOOP_LABEL = 'Loop';
export const STOP_LOOP_LABEL = 'Stop loop';

const ACCENTS = {
  emerald: { play: 'bg-emerald-600 hover:bg-emerald-500', loopOn: 'bg-emerald-300 text-black border-emerald-200', loopOff: 'bg-slate-800 hover:bg-slate-700 text-emerald-200 border-emerald-500/40' },
  violet: { play: 'bg-violet-500 hover:bg-violet-400', loopOn: 'bg-violet-300 text-black border-violet-200', loopOff: 'bg-slate-800 hover:bg-slate-700 text-violet-200 border-violet-500/40' },
  fuchsia: { play: 'bg-fuchsia-500 hover:bg-fuchsia-400', loopOn: 'bg-fuchsia-300 text-black border-fuchsia-200', loopOff: 'bg-slate-800 hover:bg-slate-700 text-fuchsia-200 border-fuchsia-500/40' },
} as const;

interface PhraseButtonsProps {
  engine: SubtractiveEngine;
  /** The student's current patch (it is what plays). */
  params: SynthParams;
  /** A named phrase, or custom notes (Synth Doctor tickets bring their own). */
  phrase: PhraseId | PhraseNote[];
  /** Name shown on the buttons when `phrase` is custom notes. */
  label?: string;
  accent: keyof typeof ACCENTS;
  /** Override the text on the Play button (e.g. "Play my remix"); the Loop button keeps the phrase name. */
  playText?: string;
  className?: string;
  playTitle?: string;
}

/**
 * Play button with a Loop toggle beside it. While the loop runs, the phrase repeats on the live
 * patch, so turning a knob changes what you hear on the next note.
 */
export const PhraseButtons: React.FC<PhraseButtonsProps> = ({ engine, params, phrase, label: customLabel, accent, playText, className = '', playTitle }) => {
  const [looping, setLooping] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const notes = typeof phrase === 'string' ? PHRASES[phrase].notes : phrase;
  const label = customLabel ?? (typeof phrase === 'string' ? PHRASES[phrase].label : 'Test phrase');
  // A new phrase (or a new set of notes) ends any loop that is running.
  const phraseKey = typeof phrase === 'string' ? phrase : notes;
  const a = ACCENTS[accent];

  const endLoop = () => {
    stopRef.current?.();
    stopRef.current = null;
  };

  // A different phrase (new brief, new dropdown choice) ends the loop; leaving the screen does too.
  useEffect(() => {
    return () => endLoop();
  }, [phraseKey]);
  useEffect(() => () => endLoop(), []);

  const play = () => {
    endLoop();
    engine.applyParams(params);
    playPhrase(engine, notes);
  };

  const toggleLoop = async () => {
    if (looping) {
      endLoop();
      stopPhrase();
      return;
    }
    await engine.startAudioContext();
    engine.applyParams(params);
    setLooping(true);
    stopRef.current = loopPhrase(engine, notes, {
      onStop: () => {
        stopRef.current = null;
        setLooping(false);
      },
    });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={play}
        title={playTitle}
        className={`px-3.5 py-2 rounded-lg ${a.play} text-black font-bold font-mono text-xs flex items-center gap-1.5 active:scale-95`}
      >
        <Volume2 className="w-4 h-4" />
        {playText ?? `${PLAY_LABEL}: ${label}`}
      </button>
      <button
        type="button"
        onClick={toggleLoop}
        aria-pressed={looping}
        title="Repeat this phrase so you can change knobs while it plays"
        className={`px-3 py-2 rounded-lg border font-bold font-mono text-xs flex items-center gap-1.5 active:scale-95 ${looping ? a.loopOn : a.loopOff}`}
      >
        <Repeat className={`w-4 h-4 ${looping ? 'animate-spin [animation-duration:3s]' : ''}`} />
        {looping ? STOP_LOOP_LABEL : `${LOOP_LABEL}: ${label}`}
      </button>
    </div>
  );
};
