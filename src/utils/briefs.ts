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
      'Set the LFO target to the filter (Cutoff), Rate around 2–6 Hz, Depth 50% or more. Keep Cutoff fairly low (about 400–900 Hz) and add some Resonance so the wobble “talks.” Bass is usually played Mono.',
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
      'Amp Attack very short (under 20 ms), Sustain high. Add VCO 2 detuned about 10 cents, or a little vibrato: LFO to Pitch, Depth 10–20%, Rate about 5 Hz. For a sliding solo feel, set Voices to Mono and add some Glide.',
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
      'Short notes mean Amp Sustain at 0. The “pop” comes from the Filter Envelope (the EG Amount knob in the Filter section, plus the Filter EG tab in the Envelope section).',
      'Amp Decay about 0.15–0.3 s, Sustain 0. Cutoff low (about 500 Hz), Filter EG Amount 50% or more (Filter section), with a short Filter EG Decay and Sustain 0 (Envelope section, Filter EG tab).',
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
      'Noise up, VCOs down. Cutoff low, Filter EG Amount high (Filter section), Filter EG Attack 0.2–0.5 s for a sweep up (Envelope section, Filter EG tab). A little Resonance adds a sci-fi whistle.',
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
      'Amp Attack near 0, Decay about 0.1 s, Sustain 0 or low, short Release. For a “bloop,” add some Filter EG Amount (Filter section), or a fast LFO on Pitch (Rate 10 Hz or more).',
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

/** How many briefs a student turns in to finish Sound Design. */
export const BRIEFS_TO_FINISH = 4;

const heardOsc = (p: SynthParams) =>
  Math.max(p.vco1Waveform === 'noise' ? 0 : p.vco1Level, p.vco2Waveform === 'noise' ? 0 : p.vco2Level);
const noiseHeard = (p: SynthParams) =>
  Math.min(1, p.noiseLevel + (p.vco1Waveform === 'noise' ? p.vco1Level : 0) + (p.vco2Waveform === 'noise' ? p.vco2Level : 0));
const hz = (n: number) => `${n.toLocaleString()} Hz`;

/**
 * Plain-language tips for a saved sound that does not fit its brief: each names what
 * is off and which control to try. Empty when the sound is a sensible answer.
 * (These are sanity checks, not a grade; the teacher still listens.)
 */
export function briefTips(id: string, p: SynthParams): string[] {
  const t: string[] = [];
  if (heardOsc(p) < 0.05 && noiseHeard(p) < 0.05) {
    return ['This patch makes no sound: every oscillator and the noise are turned down. Bring up VCO 1 Level (or Noise) first.'];
  }
  switch (id) {
    case 'br-wobble':
      if (p.lfoDestination !== 'cutoff' || p.lfoDepth < 0.3)
        t.push('A wobble is the tone opening and closing. Send the LFO to Cutoff and raise LFO Depth to 40% or more.');
      else if (p.lfoRate > 8 || p.lfoRate < 1) t.push(`Your LFO Rate (${p.lfoRate} Hz) is ${p.lfoRate > 8 ? 'too fast' : 'too slow'} for a rhythmic wobble. Try 2 to 6 Hz.`);
      if (p.filterCutoff > 3000) t.push(`Your Cutoff (${hz(Math.round(p.filterCutoff))}) is too high to hear the wobble. Pull it down to about 400 to 900 Hz.`);
      if (p.vco1Octave > 0) t.push('A bass sits low. Drop VCO 1’s Octave to 0 or lower.');
      break;
    case 'br-pad':
      if (p.ampAttack < 0.3) t.push(`A pad fades in slowly, but your Amp Attack is only ${p.ampAttack} s. Try 0.5 s or more.`);
      if (p.ampRelease < 1) t.push('A pad hangs in the air after the chord. Lengthen Amp Release to 1.5 s or more.');
      if (p.ampSustain < 0.4) t.push('Your Amp Sustain is too low: a pad holds its volume while the keys are down. Raise it.');
      if (p.filterCutoff > 6000) t.push('Your Cutoff is too high for a warm, soft pad. Bring it down to about 1,000 to 2,500 Hz.');
      break;
    case 'br-lead':
      if (p.ampAttack > 0.1) t.push('A lead has to speak right away, but your Amp Attack is too slow. Try under 20 ms.');
      if (p.filterCutoff < 1200) t.push(`Your Cutoff (${hz(Math.round(p.filterCutoff))}) is too low for a bright, buzzy lead. Open it up.`);
      if (['sine', 'triangle'].includes(p.vco1Waveform) && p.vco2Level < 0.2) t.push('Your waveform is too smooth for “buzzy.” Try Sawtooth or Square.');
      if (p.ampSustain < 0.4) t.push('Your Amp Sustain is too low: held notes die away. Raise it.');
      break;
    case 'br-pluck':
      if (p.ampSustain > 0.15) t.push('A pluck dies away on its own. Set Amp Sustain to 0 (or close).');
      if (p.ampDecay > 0.5) t.push(`Your Amp Decay (${p.ampDecay} s) is too long for a quick pop. Try 0.15 to 0.3 s.`);
      if (p.ampAttack > 0.05) t.push('Your Amp Attack is too slow: a pluck starts instantly.');
      break;
    case 'br-ocean':
      if (heardOsc(p) > 0.15) t.push('Waves have no musical pitch, but your oscillators are still audible. Turn the VCO levels down and use Noise.');
      if (noiseHeard(p) < 0.3) t.push('Waves are made of noise. Turn the Noise level up.');
      if (p.lfoDestination !== 'cutoff' || p.lfoDepth < 0.3) t.push('Waves rise and fall. Send a slow LFO to Cutoff with a good amount of Depth.');
      else if (p.lfoRate > 1) t.push(`Your LFO Rate (${p.lfoRate} Hz) is too fast for rolling waves. Try 0.1 to 0.4 Hz.`);
      break;
    case 'br-door':
      if (noiseHeard(p) < 0.3) t.push('A whoosh is noise. Turn Noise up (and the VCOs down).');
      if (p.filterEnvAmount < 30 && !(p.lfoDestination === 'cutoff' && p.lfoDepth > 0.3))
        t.push('The sweep comes from the filter moving. Raise the EG Amount knob in the Filter section and set a lower Cutoff to sweep up from.');
      break;
    case 'br-robot':
      if (noiseHeard(p) > 0.4) t.push('Robot beeps are clean and pitched, but there is a lot of noise. Turn Noise down.');
      if (p.ampSustain > 0.4 && p.ampDecay > 0.4) t.push('Beeps are short. Shorten Amp Decay and lower Amp Sustain so each note ends quickly.');
      if (p.ampAttack > 0.05) t.push('Your Amp Attack is too slow for a beep. Try near 0.');
      break;
    case 'br-thunder':
      if (p.filterCutoff > 600) t.push(`Distant thunder is dark. Your Cutoff (${hz(Math.round(p.filterCutoff))}) is too high: try 80 to 250 Hz.`);
      if (heardOsc(p) > 0.15) t.push('Thunder has no clear pitch, but your oscillators are still audible. Turn the VCOs down and use Noise.');
      if (noiseHeard(p) < 0.3) t.push('Thunder is a rumble of noise. Turn the Noise level up.');
      if (p.ampAttack < 0.2) t.push('Thunder builds. Slow the Amp Attack to 0.3 s or more and lengthen the Release.');
      break;
  }
  return t.slice(0, 3);
}
