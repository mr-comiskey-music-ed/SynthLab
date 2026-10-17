import { SoundBrief, SynthParams } from '../types';
import { DEFAULT_SYNTH_PARAMS } from './presets';
import { LEARN_BASE } from './learnSteps';

/**
 * Sound Design Briefs: open-ended requests (a producer's or game designer's ask).
 * There is no single right answer, so the teacher grades these by ear. Students
 * save a patch for each brief; it travels in their submission code.
 */
export const SOUND_BRIEFS: SoundBrief[] = [
  // ---------- Music ----------
  {
    id: 'br-wobble',
    kind: 'Music',
    title: 'Wobbly Bass',
    ask: 'Our track needs a fat bass that wobbles in rhythm, like a dubstep or funky “wah” bass. Deep, not thin.',
    listenFor: 'Low notes with a clear, steady wobble in the tone (not the pitch).',
    hints: [
      'Start with a buzzy wave on VCO 1 and keep the notes low. The wobble comes from the LFO.',
      'Set the LFO target to the filter (Cutoff), Rate around 2–6 Hz, Depth 50% or more. Keep Cutoff fairly low (about 400–900 Hz) and add some Resonance so the wobble “talks.”',
    ],
    phrase: 'bassRiff',
  },
  {
    id: 'br-pad',
    kind: 'Music',
    title: 'Dreamy Pad',
    ask: 'For the intro I need a soft, dreamy pad: slow to fade in, warm, and hanging in the air after each chord.',
    listenFor: 'A smooth fade-in with no sharp start, a warm (not harsh) tone, and a gentle ring-out.',
    hints: [
      'This is mostly about the Amp Envelope, plus two oscillators for thickness.',
      'Attack 0.5–1.5 s, Sustain high, Release 1.5 s or more. Turn up VCO 2 and detune it 8–15 cents. Pull Cutoff down to about 1,000–2,500 Hz to soften it.',
    ],
    phrase: 'padChords',
  },
  {
    id: 'br-lead',
    kind: 'Music',
    title: 'Buzzy Lead',
    ask: 'I want a bright, buzzy lead that cuts through the mix and sings the melody, like an 80s synth solo.',
    listenFor: 'A bright tone, notes that start right away, and some life (thickness or vibrato).',
    hints: [
      'Buzzy means lots of harmonics: start with Sawtooth or Square, and keep the filter fairly open.',
      'Amp Attack very short (under 20 ms), Sustain high. Add VCO 2 detuned about 10 cents, or a little vibrato: LFO to Pitch, Depth 10–20%, Rate about 5 Hz.',
    ],
    phrase: 'leadLine',
  },
  {
    id: 'br-pluck',
    kind: 'Music',
    title: 'Plucky Arp',
    ask: 'Give me a short, bouncy pluck for a fast arpeggio. Each note should pop and get out of the way.',
    listenFor: 'Every note is short and percussive, and the tone snaps from bright to dark.',
    hints: [
      'Short notes mean Amp Sustain at 0. The “pop” comes from the Filter Envelope.',
      'Amp Decay about 0.15–0.3 s, Sustain 0. Cutoff low (about 500 Hz), Filter Envelope Amount 50% or more, with a short Filter Envelope Decay and Sustain 0.',
    ],
    phrase: 'pluckArp',
  },
  // ---------- Sound FX ----------
  {
    id: 'br-ocean',
    kind: 'Sound FX',
    title: 'Ocean Waves',
    ask: 'For a beach level in our game, make the sound of waves rolling in and out.',
    listenFor: 'No musical pitch, and a slow, smooth rise and fall like waves.',
    hints: [
      'Waves are noise, not notes. Then make the filter move slowly.',
      'Turn both VCOs down and Noise up. LFO to Cutoff with a slow Rate (0.1–0.4 Hz) and lots of Depth, Cutoff around 600–1,200 Hz. Slow Attack, long Release.',
    ],
    phrase: 'swell',
  },
  {
    id: 'br-door',
    kind: 'Sound FX',
    title: 'Spaceship Door',
    ask: 'A sci-fi door slides open with a quick “whoosh.”',
    listenFor: 'A noisy swoosh that sweeps from dark to bright (or bright to dark) in about a second.',
    hints: [
      'A whoosh is noise shaped by a filter that moves.',
      'Noise up, VCOs down. Cutoff low, Filter Envelope Amount high, Filter Envelope Attack 0.2–0.5 s for a sweep up. A little Resonance adds a sci-fi whistle.',
    ],
    phrase: 'longHit',
  },
  {
    id: 'br-robot',
    kind: 'Sound FX',
    title: 'Robot Beeps',
    ask: 'A friendly robot “talks” in beeps and bloops in our animation.',
    listenFor: 'Short, clean, pitched beeps with a computer-like tone.',
    hints: [
      'Simple waves and very short notes. Try Square or Sine.',
      'Amp Attack near 0, Decay about 0.1 s, Sustain 0 or low, short Release. For a “bloop,” add Filter Envelope, or a fast LFO on Pitch (Rate 10 Hz or more).',
    ],
    phrase: 'shortHits',
  },
  {
    id: 'br-thunder',
    kind: 'Sound FX',
    title: 'Distant Thunder',
    ask: 'A storm is far away. Make a low rumble that builds and fades.',
    listenFor: 'A deep, dark rumble with no clear pitch that slowly swells and dies away.',
    hints: [
      'Thunder is dark noise: keep only the lowest frequencies.',
      'Noise up, VCOs down. Cutoff very low (80–250 Hz), Attack 0.3–1 s, Release 2 s or more. Some Resonance or a slow LFO on Cutoff makes it rumble.',
    ],
    phrase: 'swell',
  },
];

const BY_ID = new Map(SOUND_BRIEFS.map((b) => [b.id, b]));
export const briefInfo = (id: string) => BY_ID.get(id);
export const isBrief = (id: string) => BY_ID.has(id);

const diffCount = (p: SynthParams, base: SynthParams) =>
  (Object.keys(base) as (keyof SynthParams)[]).filter((k) => k !== 'masterVolume' && p[k] !== base[k]).length;

/** How many settings the student changed from a starting patch (Init, or the Learn tab's plain patch). */
export function changedSettingsCount(p: SynthParams): number {
  return Math.min(diffCount(p, DEFAULT_SYNTH_PARAMS), diffCount(p, LEARN_BASE));
}

/** A brief can be saved once the patch is really the student's own (a few settings changed). */
export const MIN_CHANGES_TO_SAVE = 3;

export const BRIEF_NOTE_MAX = 120;
