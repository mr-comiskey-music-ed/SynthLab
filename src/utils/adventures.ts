import { SynthParams, PhraseId } from '../types';

/**
 * Choose-your-own-adventure sound builds. Each one starts from a plain patch
 * and walks through the sections that matter for that kind of sound. Every
 * step has a target range (specific enough to land the sound) and a "taste"
 * note (room to make it your own). A step is done when the settings are in range.
 */

export interface AdventureStep {
  title: string;
  /** What to do. */
  text: string;
  /** Where your own taste comes in. */
  taste?: string;
  check: (p: SynthParams) => boolean;
}

export interface Adventure {
  id: string;
  name: string;
  blurb: string;
  phrase: PhraseId;
  steps: AdventureStep[];
}

const between = (n: number, lo: number, hi: number) => n >= lo && n <= hi;
const buzzy = (p: SynthParams) => p.vco1Waveform === 'sawtooth' || p.vco1Waveform === 'square';
const detune = (p: SynthParams) => Math.abs(p.vco2Fine);

export const ADVENTURES: Adventure[] = [
  {
    id: 'bass',
    name: 'Bass',
    blurb: 'The low end that holds a track together.',
    phrase: 'bassRiff',
    steps: [
      {
        title: 'Pick the raw sound',
        text: 'Set VCO 1 to Saw or Square.',
        taste: 'Saw is gritty, like funk and synthwave bass. Square is hollow and chunky, like retro game bass.',
        check: buzzy,
      },
      {
        title: 'Drop it low',
        text: 'Set VCO 1 Octave to −1 or −2.',
        taste: '−1 is a classic bass. −2 is a sub-rumble you feel more than hear.',
        check: (p) => p.vco1Octave <= -1,
      },
      {
        title: 'Add weight',
        text: 'Bring VCO 2 up to 40% or more.',
        taste: 'Same octave and a few cents of detune for a fat, wide bass. Or one octave lower than VCO 1 for extra sub.',
        check: (p) => p.vco2Level >= 0.4,
      },
      {
        title: 'Tame the top',
        text: 'Set Cutoff between 150 and 2,000 Hz.',
        taste: 'Darker is felt more than heard (good under busy music). Brighter cuts through on small speakers.',
        check: (p) => between(p.filterCutoff, 150, 2000),
      },
      {
        title: 'Punch',
        text: 'Give each note a punch: Filter EG Amount 30% or more (Filter section), with Filter EG Decay under 0.4 s (Envelope section, Filter EG tab).',
        taste: 'More Amount and some Resonance gets you into acid territory. Less is a round, warm thump.',
        check: (p) => p.filterEnvAmount >= 30 && p.modDecay <= 0.4,
      },
      {
        title: 'Tighten up',
        text: 'Keep Amp Release under 0.3 s so notes don’t smear into each other.',
        taste: 'Try Voices: Mono with a little Glide if you want notes to slide.',
        check: (p) => p.ampRelease <= 0.3,
      },
    ],
  },
  {
    id: 'pad',
    name: 'Pad',
    blurb: 'A soft bed of sound that holds chords under everything else.',
    phrase: 'padChords',
    steps: [
      {
        title: 'Two sources',
        text: 'Bring VCO 2 up to 50% or more.',
        taste: 'Saw on both is lush and full. Triangle is softer and more like a choir.',
        check: (p) => p.vco2Level >= 0.5,
      },
      {
        title: 'Detune for movement',
        text: 'Detune VCO 2 between 5 and 25 cents.',
        taste: 'A little is gentle shimmer. More is a wide, seasick 80s sound.',
        check: (p) => between(detune(p), 5, 25),
      },
      {
        title: 'Slow it down',
        text: 'Amp Attack 0.4 s or more, Sustain 60% or more, Release 1.2 s or more.',
        taste: 'Longer Attack means it fades in like a sunrise; longer Release means chords blur into each other.',
        check: (p) => p.ampAttack >= 0.4 && p.ampSustain >= 0.6 && p.ampRelease >= 1.2,
      },
      {
        title: 'Soften',
        text: 'Set Cutoff between 500 and 3,000 Hz.',
        taste: 'Lower is warm and distant, higher is airy and present.',
        check: (p) => between(p.filterCutoff, 500, 3000),
      },
      {
        title: 'Make it breathe',
        text: 'Add slow movement: an LFO with Rate under 1.5 Hz and Depth 10% or more, on Cutoff or Pulse Width.',
        taste: 'Cutoff makes it swell brighter and darker; Pulse Width (with Square waves) makes it shimmer.',
        check: (p) => p.lfoRate < 1.5 && p.lfoDepth >= 0.1 && (p.lfoDestination === 'cutoff' || p.lfoDestination === 'pwm'),
      },
    ],
  },
  {
    id: 'lead',
    name: 'Lead',
    blurb: 'The melody voice that sings on top.',
    phrase: 'leadLine',
    steps: [
      {
        title: 'Bright source',
        text: 'Set VCO 1 to Saw or Square.',
        taste: 'Saw is a classic screaming lead. Square is rounder, like a clarinet or chiptune.',
        check: buzzy,
      },
      {
        title: 'One voice, sliding',
        text: 'Set Voices to Mono and Glide between 20 and 300 ms.',
        taste: 'Short glide is a quick scoop into each note. Long glide is a slow, dramatic slide.',
        check: (p) => p.voiceMode === 'mono' && between(p.glide, 0.02, 0.3),
      },
      {
        title: 'Bite',
        text: 'Cutoff between 1,500 and 8,000 Hz, with Resonance 2 or more.',
        taste: 'More resonance gives a nasal, vocal edge; less is smoother.',
        check: (p) => between(p.filterCutoff, 1500, 8000) && p.filterResonance >= 2,
      },
      {
        title: 'Start right away',
        text: 'Amp Attack under 30 ms and Sustain 60% or more.',
        taste: 'Release decides whether notes stop sharp or ring a little.',
        check: (p) => p.ampAttack < 0.03 && p.ampSustain >= 0.6,
      },
      {
        title: 'Expression',
        text: 'Add vibrato: LFO to Pitch, Rate 4–7 Hz, Depth 5–30%.',
        taste: 'Subtle is a singer; deep is an old, warbly tape.',
        check: (p) => p.lfoDestination === 'pitch' && between(p.lfoRate, 4, 7) && between(p.lfoDepth, 0.05, 0.3),
      },
    ],
  },
  {
    id: 'brass',
    name: 'Brass',
    blurb: 'Bold synth horns for stabs and fanfares.',
    phrase: 'padChords',
    steps: [
      {
        title: 'Two buzzy oscillators',
        text: 'VCO 1 on Saw, VCO 2 up to 50% or more, detuned 5–15 cents.',
        taste: 'A Saw on VCO 2 is a horn section; a Square adds a reedier, woodwind edge.',
        check: (p) => p.vco1Waveform === 'sawtooth' && p.vco2Level >= 0.5 && between(detune(p), 5, 15),
      },
      {
        title: 'Start dark',
        text: 'Set Cutoff between 300 and 1,200 Hz.',
        taste: 'The darker you start, the bigger the “bwaa” when it opens.',
        check: (p) => between(p.filterCutoff, 300, 1200),
      },
      {
        title: 'The swell',
        text: 'Filter EG Amount 40% or more (Filter section), Filter EG Attack between 50 and 400 ms, Filter EG Sustain 30% or more (Envelope section, Filter EG tab).',
        taste: 'A faster Filter EG Attack is a stab; a slower one is a swelling fanfare.',
        check: (p) => p.filterEnvAmount >= 40 && between(p.modAttack, 0.05, 0.4) && p.modSustain >= 0.3,
      },
      {
        title: 'Blow',
        text: 'Amp Attack between 20 and 200 ms, Sustain 70% or more, Release between 0.2 and 0.8 s.',
        taste: 'This is the player’s breath: quick for punchy hits, slower for soft horns.',
        check: (p) => between(p.ampAttack, 0.02, 0.2) && p.ampSustain >= 0.7 && between(p.ampRelease, 0.2, 0.8),
      },
    ],
  },
  {
    id: 'strings',
    name: 'Strings',
    blurb: 'A string section: smooth, bowed and shimmering.',
    phrase: 'padChords',
    steps: [
      {
        title: 'A section, not a soloist',
        text: 'VCO 2 up to 50% or more, detuned 8–20 cents.',
        taste: 'Saw on both is violins; Square on both is softer, like a vintage string machine.',
        check: (p) => p.vco2Level >= 0.5 && between(detune(p), 8, 20),
      },
      {
        title: 'Bow speed',
        text: 'Amp Attack between 0.15 and 0.8 s, Sustain 70% or more, Release 0.5 s or more.',
        taste: 'Fast bowing for rhythm parts, slow bowing for a sad, swelling sound.',
        check: (p) => between(p.ampAttack, 0.15, 0.8) && p.ampSustain >= 0.7 && p.ampRelease >= 0.5,
      },
      {
        title: 'Silky',
        text: 'Cutoff between 1,500 and 6,000 Hz and Resonance under 2.',
        taste: 'Higher is bright, close-up strings; lower is a distant orchestra.',
        check: (p) => between(p.filterCutoff, 1500, 6000) && p.filterResonance < 2,
      },
      {
        title: 'Ensemble shimmer',
        text: 'Add gentle movement: LFO to Pitch (Rate 4–6 Hz, Depth 5–20%), or LFO to Pulse Width (Depth 10%+) with Square waves.',
        taste: 'Pitch vibrato sounds like real players; Pulse Width sounds like classic 80s synth strings.',
        check: (p) =>
          (p.lfoDestination === 'pitch' && between(p.lfoRate, 4, 6) && between(p.lfoDepth, 0.05, 0.2)) ||
          (p.lfoDestination === 'pwm' && p.lfoDepth >= 0.1 && (p.vco1Waveform === 'square' || p.vco2Waveform === 'square')),
      },
    ],
  },
  {
    id: 'keys',
    name: 'Keys',
    blurb: 'A keyboard sound for chords, like an electric piano or organ.',
    phrase: 'padChords',
    steps: [
      {
        title: 'Choose the tone',
        text: 'Set VCO 1 to Triangle, Sine or Square.',
        taste: 'Triangle or Sine is a mellow electric piano. Square leans toward an organ.',
        check: (p) => ['triangle', 'sine', 'square'].includes(p.vco1Waveform),
      },
      {
        title: 'Struck, not bowed',
        text: 'Amp Attack under 10 ms, Decay between 0.6 and 2 s, Sustain between 0% and 60%.',
        taste: 'Low Sustain fades like a piano. High Sustain holds like an organ.',
        check: (p) => p.ampAttack < 0.01 && between(p.ampDecay, 0.6, 2) && p.ampSustain <= 0.6,
      },
      {
        title: 'The strike',
        text: 'Filter EG Amount 20% or more (Filter section) with Filter EG Decay between 0.2 and 1 s (Envelope section, Filter EG tab), Cutoff between 600 and 3,000 Hz.',
        taste: 'More Amount gives a harder, brighter hit, like playing loud.',
        check: (p) => p.filterEnvAmount >= 20 && between(p.modDecay, 0.2, 1) && between(p.filterCutoff, 600, 3000),
      },
      {
        title: 'Let it ring',
        text: 'Amp Release between 0.3 and 1.5 s.',
        taste: 'A touch of VCO 2 an octave up (Sine or Triangle) adds bell-like shine.',
        check: (p) => between(p.ampRelease, 0.3, 1.5),
      },
    ],
  },
  {
    id: 'pluck',
    name: 'Pluck',
    blurb: 'Short, bouncy notes for arpeggios and riffs.',
    phrase: 'pluckArp',
    steps: [
      {
        title: 'Pick a source',
        text: 'Set VCO 1 to Saw or Square.',
        taste: 'Square with a thin Pulse Width (25–35%) is a kalimba or marimba; Saw is a bright synth pluck.',
        check: buzzy,
      },
      {
        title: 'Short notes',
        text: 'Amp Sustain at 0 and Decay between 0.1 and 0.5 s.',
        taste: 'Shorter is a tight tick; longer lets each note ring like a harp.',
        check: (p) => p.ampSustain <= 0.05 && between(p.ampDecay, 0.1, 0.5),
      },
      {
        title: 'The pop',
        text: 'Cutoff under 1,000 Hz, Filter EG Amount 40% or more (Filter section), Filter EG Decay under 0.3 s and Sustain 0 (Envelope section, Filter EG tab).',
        taste: 'The Filter EG Decay is the “pop”: shorter is snappier.',
        check: (p) => p.filterCutoff < 1000 && p.filterEnvAmount >= 40 && p.modDecay < 0.3 && p.modSustain <= 0.05,
      },
      {
        title: 'Character',
        text: 'Set Resonance to 2 or more.',
        taste: 'Around 3–8 makes it “drippy” and liquid. Higher gets zappy.',
        check: (p) => p.filterResonance >= 2,
      },
    ],
  },
  {
    id: 'drum',
    name: 'Percussion',
    blurb: 'A drum: snare, hi-hat, tom or something new.',
    phrase: 'drumBeat',
    steps: [
      {
        title: 'Mostly noise',
        text: 'Turn Noise up to 50% or more.',
        taste: 'Keep some VCO 1 in for a body tone (snare, tom), or turn it off for a hi-hat or shaker.',
        check: (p) => p.noiseLevel >= 0.5,
      },
      {
        title: 'Hit and gone',
        text: 'Amp Attack under 5 ms, Sustain 0, Decay between 0.03 and 0.5 s.',
        taste: 'Short is a tight hit; longer is an open, washy hit.',
        check: (p) => p.ampAttack <= 0.006 && p.ampSustain <= 0.05 && between(p.ampDecay, 0.03, 0.5),
      },
      {
        title: 'Choose the drum',
        text: 'Set Cutoff below 2,000 Hz (tom or snare thump) or above 5,000 Hz (hi-hat sizzle).',
        taste: 'In between is a fine place too, once you’ve heard both ends. Come back and move it.',
        check: (p) => p.filterCutoff < 2000 || p.filterCutoff > 5000,
      },
      {
        title: 'Snap',
        text: 'Filter EG Amount 30% or more (Filter section) with a very short Filter EG Decay (under 0.15 s) (Envelope section, Filter EG tab).',
        taste: 'This is the stick hitting the drum. Resonance can make it ring like a tuned tom.',
        check: (p) => p.filterEnvAmount >= 30 && p.modDecay < 0.15,
      },
    ],
  },
];

export const adventureInfo = (id: string) => ADVENTURES.find((a) => a.id === id);
