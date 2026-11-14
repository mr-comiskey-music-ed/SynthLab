import * as Tone from 'tone';
import { SynthParams, ArpConfig } from '../types';

/** Most notes that can sound at once. Kept modest so Chromebooks stay smooth. */
export const MAX_VOICES = 8;

/** Mix level for each voice, so chords don't slam into the limiter. */
const VOICE_LEVEL = 0.45;

/** Pitch LFO depth in cents: depth² curve so small values are gentle vibrato and high values are a siren. */
/**
 * Level trim for resonance. Q is in dB and every 12 dB/oct stage adds its own peak, so a
 * resonant 4-pole filter can be 30+ dB hotter at the cutoff. Trim about a third of that.
 */
export const resonanceComp = (q: number, rolloff: number) => Math.pow(10, (-0.35 * Math.max(0, q - 2) * (Math.abs(rolloff) / 12)) / 20);
export const lfoPitchCents = (depth: number) => 800 * depth * depth;

/** Cutoff LFO swing in Hz at full depth. */
export const LFO_CUTOFF_HZ = 3500;

/** Pulse-width LFO swing at full depth (in Tone's -1..1 width units). */
export const LFO_PWM_SWING = 0.8;

/** How far the pulse width swings either side of the knob, as a 0-1 duty cycle (Tone widths are -1..1, so half). */
export const lfoPwmDuty = (depth: number) => (depth * LFO_PWM_SWING) / 2;

/** How far the cutoff swings either side of the knob, in Hz. */
export const lfoCutoffHz = (depth: number) => depth * LFO_CUTOFF_HZ;

/**
 * Soundtrap guide: the cutoff LFO swings in octaves (through the filter's detune) instead of Hz,
 * like a real analog synth. A Hz swing larger than the cutoff drives it to 0 Hz, which silences
 * the note for a moment on every wobble and sounds like a click.
 */
export const LFO_CUTOFF_CENTS = 3600;

/** Filter envelope swing in Hz at 100% amount. */
const FILTER_ENV_HZ = 8000;

/**
 * Pulse width in the app is the duty cycle: 0.5 = a true square (50% up, 50% down),
 * 0.1 or 0.9 = a thin pulse. Tone.js measures width from -1 to 1 with 0 = square.
 */
export const dutyToToneWidth = (duty: number) => Math.max(-0.96, Math.min(0.96, 2 * duty - 1));

const clampHz = (hz: number) => Math.max(20, Math.min(20000, hz));

type Osc = Tone.Oscillator | Tone.PulseOscillator;

/** LFO shapes the guide synths offer (Retro Synth adds a falling ramp and random steps). */
export type LfoShape = 'sine' | 'triangle' | 'square' | 'rampUp' | 'rampDown' | 'random';

/**
 * An LFO with every guide shape. Random is sample-and-hold: a new random level on every cycle.
 * Output swings -1 to 1.
 */
class ModLfo {
  readonly output = new Tone.Gain(1);
  private lfo = new Tone.LFO({ frequency: 1, type: 'sine', min: -1, max: 1 }).start();
  private hold = new Tone.Signal(0);
  private clock: Tone.Clock;
  private shape: LfoShape = 'sine';
  constructor() {
    this.lfo.connect(this.output);
    this.clock = new Tone.Clock((time) => this.hold.setValueAtTime(Math.random() * 2 - 1, time), 1);
  }
  set(rate: number, shape: LfoShape) {
    const hz = Math.max(0.05, rate);
    this.lfo.frequency.rampTo(hz, 0.05);
    this.clock.frequency.rampTo(hz, 0.05);
    if (shape === this.shape) return;
    if (shape === 'random') {
      this.lfo.disconnect(this.output);
      this.hold.connect(this.output);
      this.clock.start();
    } else {
      if (this.shape === 'random') {
        this.clock.stop();
        this.hold.disconnect(this.output);
        this.lfo.connect(this.output);
      }
      this.lfo.type = shape === 'rampUp' || shape === 'rampDown' ? 'sawtooth' : shape;
      // A falling ramp is a rising one upside down.
      this.lfo.min = shape === 'rampDown' ? 1 : -1;
      this.lfo.max = shape === 'rampDown' ? -1 : 1;
    }
    this.shape = shape;
  }
}

/**
 * Extra hardware that only the guide synths' panels use (Soundtrap's Juno-106 style synth, Logic's
 * Retro Synth). Everything here is off unless a guide panel turns it on, so the rest of the app sounds
 * exactly as before.
 */
export interface EngineExtras {
  /** Separate LFO amounts (0-1) for pitch, cutoff and pulse width, all at once. Replaces lfoDepth + lfoDestination. */
  lfoAmounts?: { pitch: number; cutoff: number; pwm: number };
  /** Seconds the LFO takes to fade in at the start of each note. */
  lfoDelay?: number;
  /** High-pass filter cutoff in Hz (20 or less = off). */
  hpfCutoff?: number;
  /** Sub-oscillator level (0-1): a square wave one octave below VCO 1. */
  subLevel?: number;
  /** Juno-style chorus: 0 off, 1 = I, 2 = II, 3 = I + II. */
  chorus?: 0 | 1 | 2 | 3;
  /**
   * Retro Synth: two separate LFOs. `main` drives cutoff and pulse width, `vibrato` drives pitch.
   * When set, they replace the app's own LFO (amounts still come from lfoAmounts).
   */
  modLfos?: { main: { rate: number; shape: LfoShape }; vibrato: { rate: number; shape: LfoShape } };
  /** Retro Synth Shape Modulation toward Filter Env: how far (0-1) the filter envelope moves the pulse width. */
  pwmEnv?: number;
  /** Retro Synth Sine Level (0-1): a sine at the oscillator's pitch, added after the filter. */
  sineLevel?: number;
  /** Retro Synth filter type (default low-pass). */
  filterType?: 'lowpass' | 'highpass';
  /** Retro Synth Effect: Chorus or Flanger with its own Mix (0-1) and Rate (Hz). */
  effect?: { type: 'chorus' | 'flanger'; mix: number; rate: number };
}

const CHORUS_MODES: Record<1 | 2 | 3, { frequency: number; depth: number; delayTime: number }> = {
  1: { frequency: 0.5, depth: 0.45, delayTime: 3.5 },
  2: { frequency: 0.85, depth: 0.75, delayTime: 3.5 },
  3: { frequency: 8, depth: 0.12, delayTime: 2.5 },
};

/** One note's worth of synth: two oscillators + noise → filter → amp envelope. */
class Voice {
  osc1: Osc | null = null;
  osc2: Osc | null = null;
  /** Soundtrap guide only: a square one octave below VCO 1. Started only while subLevel is up. */
  sub: Tone.Oscillator;
  subGain: Tone.Gain;
  subRunning = false;
  /** Soundtrap guide only: high-pass filter (sits at 10 Hz, inaudible, unless the guide moves it). */
  hpf: Tone.Filter;
  /** Retro Synth only: a sine at VCO 1's pitch, mixed in after the filter (Sine Level). */
  sine: Tone.Oscillator;
  sineGain: Tone.Gain;
  sineRunning = false;
  /** Retro Synth only: the filter envelope moving the pulse width (Shape Modulation toward Filter Env). */
  pwmEnvGain: Tone.Gain;
  /** Per-note fade for the pitch and pulse-width LFO (instant unless an LFO delay is set). */
  lfoPitchFade: Tone.Gain;
  lfoPwmFade: Tone.Gain;
  osc1Gain: Tone.Gain;
  osc2Gain: Tone.Gain;
  noiseGain: Tone.Gain;
  filter: Tone.Filter;
  filterEnv: Tone.Envelope;
  filterEnvGain: Tone.Gain;
  ampEnv: Tone.AmplitudeEnvelope;
  /** Fades the LFO's cutoff movement in at each note start, so a note never begins mid-sweep with a click. */
  lfoFade: Tone.Gain;
  /** Same fade for the octave-based cutoff LFO (Soundtrap guide). */
  lfoDetuneFade: Tone.Gain;
  /** Pulls the level down as resonance rises (real filters lose body too), so peaky patches don't clip. */
  resComp: Tone.Gain;

  note: string | null = null;
  freq = 261.63;
  /** True between attack and release. */
  held = false;
  /** When this voice was last started; used to steal the oldest voice. */
  startedAt = 0;
  running = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private engine: SubtractiveEngine, out: Tone.ToneAudioNode, noise: Tone.Noise) {
    const p = engine.getParams();
    this.osc1Gain = new Tone.Gain(0);
    this.osc2Gain = new Tone.Gain(0);
    this.noiseGain = new Tone.Gain(0);
    this.filter = new Tone.Filter({ frequency: p.filterCutoff, type: 'lowpass', rolloff: p.filterRolloff, Q: p.filterResonance });
    this.filterEnv = new Tone.Envelope();
    this.filterEnvGain = new Tone.Gain(0);
    this.ampEnv = new Tone.AmplitudeEnvelope();
    this.lfoFade = new Tone.Gain(1);
    this.lfoDetuneFade = new Tone.Gain(1);
    this.resComp = new Tone.Gain(1);
    this.sub = new Tone.Oscillator({ frequency: this.freq / 2, type: 'square' });
    this.subGain = new Tone.Gain(0);
    this.hpf = new Tone.Filter({ frequency: 10, type: 'highpass', rolloff: -12, Q: 0.7 });
    this.lfoPitchFade = new Tone.Gain(1);
    this.lfoPwmFade = new Tone.Gain(1);
    engine.lfoPitchGain.connect(this.lfoPitchFade);
    engine.lfoPwmGain.connect(this.lfoPwmFade);
    this.lfoPitchFade.connect(this.sub.detune);
    this.sine = new Tone.Oscillator({ frequency: this.freq, type: 'sine' });
    this.sineGain = new Tone.Gain(0);
    this.sine.connect(this.sineGain);
    this.lfoPitchFade.connect(this.sine.detune);
    this.pwmEnvGain = new Tone.Gain(0);
    this.sub.connect(this.subGain);
    this.subGain.connect(this.filter);

    this.osc1Gain.connect(this.filter);
    this.osc2Gain.connect(this.filter);
    this.noiseGain.connect(this.filter);
    noise.connect(this.noiseGain);
    this.filterEnv.connect(this.filterEnvGain);
    this.filterEnv.connect(this.pwmEnvGain);
    this.filterEnvGain.connect(this.filter.frequency);
    engine.lfoCutoffGain.connect(this.lfoFade);
    this.lfoFade.connect(this.filter.frequency);
    engine.lfoCutoffCentsGain.connect(this.lfoDetuneFade);
    this.lfoDetuneFade.connect(this.filter.detune);
    this.filter.connect(this.resComp);
    this.resComp.connect(this.hpf);
    this.sineGain.connect(this.hpf);
    this.hpf.connect(this.ampEnv);
    this.ampEnv.connect(out);

    this.buildOscillators();
    this.update(p);
  }

  private makeOsc(wave: SynthParams['vco1Waveform'], duty: number): Osc | null {
    if (wave === 'noise') return null;
    if (wave === 'square') {
      const o = new Tone.PulseOscillator({ frequency: this.freq, width: dutyToToneWidth(duty) });
      this.lfoPwmFade.connect(o.width);
      this.pwmEnvGain.connect(o.width);
      return o;
    }
    return new Tone.Oscillator({ frequency: this.freq, type: wave });
  }

  /** (Re)create the oscillators after a waveform change. */
  buildOscillators() {
    const p = this.engine.getParams();
    for (const o of [this.osc1, this.osc2]) {
      if (o) {
        o.stop();
        o.dispose();
      }
    }
    this.osc1 = this.makeOsc(p.vco1Waveform, p.vco1PulseWidth);
    this.osc2 = this.makeOsc(p.vco2Waveform, p.vco2PulseWidth);
    if (this.osc1) {
      this.osc1.connect(this.osc1Gain);
      this.lfoPitchFade.connect(this.osc1.detune);
    }
    if (this.osc2) {
      this.osc2.connect(this.osc2Gain);
      this.lfoPitchFade.connect(this.osc2.detune);
    }
    if (this.running) {
      this.osc1?.start();
      this.osc2?.start();
    }
    this.setPitch(this.freq, 0);
  }

  /** Apply every setting except waveform shape (handled by buildOscillators). */
  update(p: SynthParams) {
    const bal1 = p.oscBalance <= 0 ? 1 : 1 - p.oscBalance;
    const bal2 = p.oscBalance >= 0 ? 1 : 1 + p.oscBalance;
    const extraNoise = (p.vco1Waveform === 'noise' ? p.vco1Level : 0) + (p.vco2Waveform === 'noise' ? p.vco2Level : 0);
    this.osc1Gain.gain.rampTo(p.vco1Waveform === 'noise' ? 0 : p.vco1Level * bal1, 0.02);
    this.osc2Gain.gain.rampTo(p.vco2Waveform === 'noise' ? 0 : p.vco2Level * bal2, 0.02);
    this.noiseGain.gain.rampTo(Math.min(1, p.noiseLevel + extraNoise), 0.02);

    if (this.osc1 instanceof Tone.PulseOscillator) this.osc1.width.rampTo(dutyToToneWidth(p.vco1PulseWidth), 0.05);
    if (this.osc2 instanceof Tone.PulseOscillator) this.osc2.width.rampTo(dutyToToneWidth(p.vco2PulseWidth), 0.05);

    if (this.filter.rolloff !== p.filterRolloff) this.filter.rolloff = p.filterRolloff;
    this.filter.Q.rampTo(p.filterResonance, 0.05);
    this.resComp.gain.rampTo(resonanceComp(p.filterResonance, p.filterRolloff), 0.05);
    this.filterEnvGain.gain.rampTo((p.filterEnvAmount / 100) * FILTER_ENV_HZ, 0.05);

    this.ampEnv.attack = Math.max(0.003, p.ampAttack);
    this.ampEnv.decay = Math.max(0.01, p.ampDecay);
    this.ampEnv.sustain = Math.max(0, Math.min(1, p.ampSustain));
    this.ampEnv.release = Math.max(0.01, p.ampRelease);
    this.filterEnv.attack = Math.max(0.001, p.modAttack);
    this.filterEnv.decay = Math.max(0.01, p.modDecay);
    this.filterEnv.sustain = Math.max(0, Math.min(1, p.modSustain));
    this.filterEnv.release = Math.max(0.01, p.modRelease);

    this.setPitch(this.freq, 0.01);
  }

  /** Soundtrap-guide hardware: sub-oscillator and high-pass filter. */
  updateExtras(x: EngineExtras) {
    const sub = Math.max(0, Math.min(1, x.subLevel ?? 0));
    this.subGain.gain.rampTo(sub, 0.02);
    if (sub > 0 && this.running && !this.subRunning) {
      this.sub.start();
      this.subRunning = true;
    }
    this.hpf.frequency.rampTo(Math.max(10, Math.min(20000, x.hpfCutoff ?? 10)), 0.05);
    const sine = Math.max(0, Math.min(1, x.sineLevel ?? 0));
    this.sineGain.gain.rampTo(sine, 0.02);
    if (sine > 0 && this.running && !this.sineRunning) {
      this.sine.start();
      this.sineRunning = true;
    }
    this.pwmEnvGain.gain.rampTo(Math.max(-1, Math.min(1, x.pwmEnv ?? 0)) * LFO_PWM_SWING, 0.05);
    const type = x.filterType ?? 'lowpass';
    if (this.filter.type !== type) this.filter.type = type;
  }

  /**
   * Oscillator pitches plus key tracking (the filter follows the keyboard).
   * ramp: 0 = jump straight there; otherwise slide over that many seconds (glide).
   */
  setPitch(freq: number, ramp: number) {
    const p = this.engine.getParams();
    this.freq = freq;
    const f1 = freq * Math.pow(2, (p.vco1Octave * 12 + p.vco1Semi + p.vco1Fine / 100) / 12);
    const f2 = freq * Math.pow(2, (p.vco2Octave * 12 + p.vco2Semi + p.vco2Fine / 100) / 12);
    const cutoff = clampHz(p.filterCutoff * Math.pow(freq / 261.63, p.filterKeyTracking));
    if (ramp <= 0) {
      if (this.osc1) this.osc1.frequency.value = f1;
      if (this.osc2) this.osc2.frequency.value = f2;
      this.sub.frequency.value = f1 / 2;
      this.sine.frequency.value = f1;
      this.filter.frequency.value = cutoff;
    } else {
      this.osc1?.frequency.exponentialRampTo(f1, ramp);
      this.osc2?.frequency.exponentialRampTo(f2, ramp);
      this.sub.frequency.exponentialRampTo(f1 / 2, ramp);
      this.sine.frequency.exponentialRampTo(f1, ramp);
      this.filter.frequency.exponentialRampTo(cutoff, ramp);
    }
  }

  /** Start a note. With glide > 0 (mono mode), the pitch slides from the previous note. */
  attack(note: string, freq: number, velocity: number, glide = 0) {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.note = note;
    this.held = true;
    this.startedAt = performance.now();
    this.setPitch(freq, glide > 0 && this.running ? glide : 0);
    if (!this.running) {
      this.osc1?.start();
      this.osc2?.start();
      this.running = true;
    }
    if (!this.subRunning && (this.engine.getExtras().subLevel ?? 0) > 0) {
      this.sub.start();
      this.subRunning = true;
    }
    if (!this.sineRunning && (this.engine.getExtras().sineLevel ?? 0) > 0) {
      this.sine.start();
      this.sineRunning = true;
    }
    const now = Tone.now();
    // Dial the LFO in over a few tens of ms rather than letting it hit mid-wave
    // (or over the LFO delay time, when the Soundtrap guide sets one).
    const delay = Math.max(0, this.engine.getExtras().lfoDelay ?? 0);
    for (const fade of [this.lfoFade, this.lfoDetuneFade]) {
      fade.gain.cancelScheduledValues(now);
      fade.gain.setValueAtTime(0, now);
      fade.gain.linearRampToValueAtTime(1, now + Math.max(0.06, delay));
    }
    for (const fade of [this.lfoPitchFade, this.lfoPwmFade]) {
      fade.gain.cancelScheduledValues(now);
      if (delay > 0) {
        fade.gain.setValueAtTime(0, now);
        fade.gain.linearRampToValueAtTime(1, now + delay);
      } else {
        fade.gain.setValueAtTime(1, now);
      }
    }
    this.ampEnv.triggerAttack(now, velocity);
    this.filterEnv.triggerAttack(now);
  }

  /** Mono legato: move a held note to a new pitch without restarting the envelopes. */
  slideTo(note: string, freq: number, glide: number) {
    this.note = note;
    this.setPitch(freq, glide > 0 ? glide : 0.005);
  }

  release() {
    if (!this.held) return;
    this.held = false;
    const now = Tone.now();
    this.ampEnv.triggerRelease(now);
    this.filterEnv.triggerRelease(now);
    // Stop the oscillators once the note has faded, so idle voices cost nothing.
    const fade = Math.max(0.01, this.engine.getParams().ampRelease);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.held) return;
      this.osc1?.stop();
      this.osc2?.stop();
      if (this.subRunning) {
        this.sub.stop();
        this.subRunning = false;
      }
      if (this.sineRunning) {
        this.sine.stop();
        this.sineRunning = false;
      }
      this.running = false;
      this.note = null;
    }, (fade * 1.2 + 0.3) * 1000);
  }

  /** True while the voice is held or still ringing out. */
  get busy() {
    return this.held || this.idleTimer !== null;
  }
}

export class SubtractiveEngine {
  private static instance: SubtractiveEngine | null = null;
  public isStarted: boolean = false;

  // Shared nodes
  private noise!: Tone.Noise;
  private voiceBus!: Tone.Gain;
  private masterGain!: Tone.Gain;
  private limiter!: Tone.Compressor;
  private softClip!: Tone.WaveShaper;
  private waveformAnalyzer!: Tone.Waveform;
  private fftAnalyzer!: Tone.FFT;
  private recorder!: Tone.Recorder;
  private lfo!: Tone.LFO;
  /** Shared LFO sends; every voice listens to these. */
  lfoPitchGain!: Tone.Gain;
  lfoCutoffGain!: Tone.Gain;
  lfoCutoffCentsGain!: Tone.Gain;
  lfoPwmGain!: Tone.Gain;

  private voices: Voice[] = [];
  private extras: EngineExtras = {};
  private chorus: Tone.Chorus | null = null;
  private chorusOn = false;
  /** Retro Synth's two LFOs, made the first time that guide opens. */
  private modLfos: { main: ModLfo; vibrato: ModLfo } | null = null;
  private modLfosOn = false;

  // State
  private currentParams: SynthParams;
  private activeNotes: Map<string, number> = new Map(); // held keys: note -> frequency
  /** Mono mode: held keys in the order they were pressed (last one sounds). */
  private monoStack: string[] = [];

  // Arpeggiator
  private arpConfig: ArpConfig = {
    enabled: false,
    bpm: 120,
    division: '16n',
    direction: 'up',
    octaves: 1,
  };
  private heldNotesList: string[] = [];
  private arpIndex: number = 0;
  private arpStepTimer: any = null;

  // Callbacks
  public onActiveNotesChange?: (notes: string[]) => void;
  private envelopeListeners: Array<(isHeld: boolean) => void> = [];

  public subscribeEnvelope(listener: (isHeld: boolean) => void): () => void {
    this.envelopeListeners.push(listener);
    return () => {
      this.envelopeListeners = this.envelopeListeners.filter((l) => l !== listener);
    };
  }

  private notifyEnvelope(isHeld: boolean) {
    this.envelopeListeners.forEach((fn) => {
      try {
        fn(isHeld);
      } catch (e) {
        console.error(e);
      }
    });
  }

  private constructor(initialParams: SynthParams) {
    this.currentParams = { ...initialParams };
    this.setupAudioGraph();
  }

  public static getInstance(initialParams?: SynthParams): SubtractiveEngine {
    if (!SubtractiveEngine.instance) {
      if (!initialParams) {
        throw new Error('Initial parameters required to create audio engine');
      }
      SubtractiveEngine.instance = new SubtractiveEngine(initialParams);
    }
    return SubtractiveEngine.instance;
  }

  private setupAudioGraph() {
    // Voices -> bus -> master -> limiter -> speakers & analyzers
    // Safety limiter with a hard knee, so chords don't distort but single notes keep their dynamics.
    this.limiter = new Tone.Compressor({ threshold: -6, ratio: 12, attack: 0.002, release: 0.12, knee: 6 });
    this.masterGain = new Tone.Gain(this.currentParams.masterVolume);
    this.voiceBus = new Tone.Gain(VOICE_LEVEL);
    this.waveformAnalyzer = new Tone.Waveform(1024);
    // 4096 bins (~5 Hz each) so low notes land on a sharp peak instead of a blocky 86 Hz-wide step.
    this.fftAnalyzer = new Tone.FFT({ size: 4096, smoothing: 0.6 });
    this.recorder = new Tone.Recorder();

    this.voiceBus.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    // A gentle soft clipper after the limiter: anything that still overshoots is rounded off, not hard-clipped.
    this.softClip = new Tone.WaveShaper((x) => Math.tanh(x * 1.1) / Math.tanh(1.1), 2048);
    this.limiter.connect(this.softClip);
    this.softClip.connect(Tone.getDestination());
    this.softClip.connect(this.waveformAnalyzer);
    this.softClip.connect(this.fftAnalyzer);
    this.softClip.connect(this.recorder);

    // One LFO for the whole synth, so every note wobbles together (like most analog polysynths).
    this.lfo = new Tone.LFO({
      frequency: this.currentParams.lfoRate,
      type: this.currentParams.lfoWaveform,
      min: -1,
      max: 1,
    });
    this.lfo.start();
    this.lfoPitchGain = new Tone.Gain(0);
    this.lfoCutoffGain = new Tone.Gain(0);
    this.lfoCutoffCentsGain = new Tone.Gain(0);
    this.lfoPwmGain = new Tone.Gain(0);
    this.lfo.connect(this.lfoPitchGain);
    this.lfo.connect(this.lfoCutoffGain);
    this.lfo.connect(this.lfoCutoffCentsGain);
    this.lfo.connect(this.lfoPwmGain);

    // One noise source shared by every voice (each voice filters its own copy).
    this.noise = new Tone.Noise('white');
    this.noise.start();

    for (let i = 0; i < MAX_VOICES; i++) this.voices.push(new Voice(this, this.voiceBus, this.noise));
    this.applyParams(this.currentParams);
  }

  public async startAudioContext(): Promise<void> {
    if (!this.isStarted) {
      await Tone.start();
      this.isStarted = true;
    }
  }

  public applyParams(params: Partial<SynthParams>) {
    const prev = this.currentParams;
    this.currentParams = { ...this.currentParams, ...params };
    const p = this.currentParams;

    if (params.masterVolume !== undefined) this.masterGain.gain.rampTo(p.masterVolume, 0.05);

    if (p.voiceMode !== prev.voiceMode) {
      // Switching poly <-> mono: let everything ring out and start fresh.
      for (const v of this.voices) v.release();
      this.monoStack = [];
    }

    const shapeChanged = p.vco1Waveform !== prev.vco1Waveform || p.vco2Waveform !== prev.vco2Waveform;
    for (const v of this.voices) {
      if (shapeChanged) v.buildOscillators();
      v.update(p);
    }

    // LFO
    this.lfo.frequency.rampTo(Math.max(0.1, p.lfoRate), 0.05);
    if (this.lfo.type !== p.lfoWaveform) this.lfo.type = p.lfoWaveform;
    this.applyLfoRouting();
  }

  private applyLfoRouting() {
    const p = this.currentParams;
    const a = this.extras.lfoAmounts;
    const d = p.lfoDepth;
    const pitch = a ? a.pitch : p.lfoDestination === 'pitch' ? d : 0;
    const cutoff = a ? a.cutoff : p.lfoDestination === 'cutoff' ? d : 0;
    const pwm = a ? a.pwm : p.lfoDestination === 'pwm' ? d : 0;
    this.lfoPitchGain.gain.rampTo(lfoPitchCents(pitch), 0.05);
    // The guide (separate amounts) swings the cutoff in octaves; the main app keeps its Hz swing.
    this.lfoCutoffGain.gain.rampTo(a ? 0 : cutoff * LFO_CUTOFF_HZ, 0.05);
    this.lfoCutoffCentsGain.gain.rampTo(a ? cutoff * LFO_CUTOFF_CENTS : 0, 0.05);
    this.lfoPwmGain.gain.rampTo(pwm * LFO_PWM_SWING, 0.05);
  }

  /** The Soundtrap guide's extra hardware. Pass {} (or nothing) to switch it all off. */
  public setExtras(extras: EngineExtras = {}) {
    this.extras = { ...extras };
    for (const v of this.voices) v.updateExtras(this.extras);
    this.applyModLfos();
    this.applyLfoRouting();

    const mode = this.extras.chorus ?? 0;
    const fx = this.extras.effect;
    // Juno chorus modes, or Retro Synth's Chorus / Flanger (a flanger is a very short, fed-back chorus).
    const c = mode
      ? { ...CHORUS_MODES[mode], feedback: 0, wet: 0.5 }
      : fx && fx.mix > 0
      ? fx.type === 'flanger'
        ? { frequency: fx.rate, depth: 0.9, delayTime: 1.5, feedback: 0.6, wet: fx.mix }
        : { frequency: fx.rate, depth: 0.6, delayTime: 3.5, feedback: 0, wet: fx.mix }
      : null;
    if (c) {
      if (!this.chorus) {
        this.chorus = new Tone.Chorus({ frequency: 0.5, delayTime: 3.5, depth: 0.5, spread: 180, wet: 0.5 }).start();
        this.chorus.connect(this.masterGain);
      }
      this.chorus.frequency.rampTo(c.frequency, 0.05);
      this.chorus.depth = c.depth;
      this.chorus.delayTime = c.delayTime;
      this.chorus.feedback.rampTo(c.feedback, 0.05);
      this.chorus.wet.rampTo(c.wet, 0.05);
      if (!this.chorusOn) {
        this.voiceBus.disconnect(this.masterGain);
        this.voiceBus.connect(this.chorus);
        this.chorusOn = true;
      }
    } else if (this.chorusOn && this.chorus) {
      this.voiceBus.disconnect(this.chorus);
      this.voiceBus.connect(this.masterGain);
      this.chorusOn = false;
    }
  }

  /** Swap the app's LFO for Retro Synth's two (and back), keeping the same depth sends. */
  private applyModLfos() {
    const want = this.extras.modLfos;
    if (want && !this.modLfos) this.modLfos = { main: new ModLfo(), vibrato: new ModLfo() };
    const m = this.modLfos;
    if (want && m) {
      m.main.set(want.main.rate, want.main.shape);
      m.vibrato.set(want.vibrato.rate, want.vibrato.shape);
      if (!this.modLfosOn) {
        for (const g of [this.lfoPitchGain, this.lfoCutoffGain, this.lfoCutoffCentsGain, this.lfoPwmGain]) this.lfo.disconnect(g);
        m.vibrato.output.connect(this.lfoPitchGain);
        m.main.output.connect(this.lfoCutoffCentsGain);
        m.main.output.connect(this.lfoPwmGain);
        this.modLfosOn = true;
      }
    } else if (this.modLfosOn && m) {
      m.vibrato.output.disconnect(this.lfoPitchGain);
      m.main.output.disconnect(this.lfoCutoffCentsGain);
      m.main.output.disconnect(this.lfoPwmGain);
      for (const g of [this.lfoPitchGain, this.lfoCutoffGain, this.lfoCutoffCentsGain, this.lfoPwmGain]) this.lfo.connect(g);
      this.modLfosOn = false;
    }
  }

  public getExtras(): EngineExtras {
    return this.extras;
  }

  // ---------- Voice allocation ----------
  /** Same note → same voice; else a free voice; else steal the oldest (released ones first). */
  private pickVoice(note: string): Voice {
    const same = this.voices.find((v) => v.note === note && v.busy);
    if (same) return same;
    const free = this.voices.find((v) => !v.busy);
    if (free) return free;
    const released = this.voices.filter((v) => !v.held);
    const pool = released.length ? released : this.voices;
    return pool.reduce((a, b) => (a.startedAt <= b.startedAt ? a : b));
  }

  private get isMono() {
    return this.currentParams.voiceMode === 'mono';
  }

  private startVoice(note: string, velocity: number) {
    const freq = Tone.Frequency(note).toFrequency();
    if (this.isMono) {
      const v = this.voices[0];
      const glide = Math.max(0, this.currentParams.glide);
      // Legato: a key is already held, so slide to the new note without restarting it.
      if (v.held) v.slideTo(note, freq, glide);
      else v.attack(note, freq, velocity, glide);
      return;
    }
    this.pickVoice(note).attack(note, freq, velocity);
  }

  private releaseVoice(note: string) {
    for (const v of this.voices) if (v.note === note && v.held) v.release();
  }

  /** Mono key release: go back to the last key still held, or stop if none. */
  private monoNoteOff(note: string) {
    this.monoStack = this.monoStack.filter((n) => n !== note);
    const v = this.voices[0];
    if (v.note !== note) return;
    const back = this.monoStack[this.monoStack.length - 1];
    if (back && v.held) v.slideTo(back, Tone.Frequency(back).toFrequency(), Math.max(0, this.currentParams.glide));
    else v.release();
  }

  public noteOn(note: string, velocity: number = 1.0) {
    if (!this.isStarted) {
      Tone.start();
      this.isStarted = true;
    }

    const freq = Tone.Frequency(note).toFrequency();
    this.activeNotes.set(note, freq);
    this.notifyActiveNotes();

    if (this.arpConfig.enabled) {
      if (!this.heldNotesList.includes(note)) this.heldNotesList.push(note);
      this.ensureArpRunning();
      return;
    }

    if (this.isMono) this.monoStack = [...this.monoStack.filter((n) => n !== note), note];
    this.startVoice(note, velocity);
    this.notifyEnvelope(true);
  }

  public noteOff(note: string) {
    const wasHeld = this.activeNotes.delete(note);
    this.notifyActiveNotes();

    if (this.arpConfig.enabled) {
      this.heldNotesList = this.heldNotesList.filter((n) => n !== note);
      if (this.heldNotesList.length === 0) {
        this.stopArpTimer();
        this.notifyEnvelope(false);
      }
      return;
    }

    if (this.isMono) this.monoNoteOff(note);
    else this.releaseVoice(note);
    if (wasHeld && this.activeNotes.size === 0) this.notifyEnvelope(false);
  }

  public allNotesOff() {
    this.activeNotes.clear();
    this.heldNotesList = [];
    this.monoStack = [];
    this.stopArpTimer();
    for (const v of this.voices) v.release();
    this.notifyActiveNotes();
    this.notifyEnvelope(false);
  }

  private notifyActiveNotes() {
    if (this.onActiveNotesChange) {
      this.onActiveNotesChange(Array.from(this.activeNotes.keys()));
    }
  }

  // --- Arpeggiator Logic ---
  public setArpConfig(config: Partial<ArpConfig>) {
    this.arpConfig = { ...this.arpConfig, ...config };
    if (this.arpConfig.enabled && this.heldNotesList.length > 0) {
      this.stopArpTimer();
      this.ensureArpRunning();
    } else if (!this.arpConfig.enabled) {
      this.stopArpTimer();
    }
  }

  private stopArpTimer() {
    if (this.arpStepTimer) {
      clearInterval(this.arpStepTimer);
      this.arpStepTimer = null;
    }
  }

  private ensureArpRunning() {
    if (this.arpStepTimer || this.heldNotesList.length === 0) return;

    const getIntervalMs = () => {
      const beatsPerSecond = this.arpConfig.bpm / 60;
      let multiplier = 4; // 16th note default
      if (this.arpConfig.division === '8n') multiplier = 2;
      if (this.arpConfig.division === '4n') multiplier = 1;
      return 1000 / beatsPerSecond / multiplier;
    };

    const step = () => {
      if (this.heldNotesList.length === 0 || !this.arpConfig.enabled) {
        this.stopArpTimer();
        return;
      }

      const sorted = [...this.heldNotesList].sort(
        (a, b) => Tone.Frequency(a).toFrequency() - Tone.Frequency(b).toFrequency()
      );
      const sequence: string[] = [];
      for (let oct = 0; oct < this.arpConfig.octaves; oct++) {
        sequence.push(...sorted.map((n) => Tone.Frequency(n).transpose(oct * 12).toNote()));
      }

      let currentNote: string = sequence[0];
      if (sequence.length > 1) {
        if (this.arpConfig.direction === 'up') {
          currentNote = sequence[this.arpIndex % sequence.length];
          this.arpIndex = (this.arpIndex + 1) % sequence.length;
        } else if (this.arpConfig.direction === 'down') {
          const rev = [...sequence].reverse();
          currentNote = rev[this.arpIndex % rev.length];
          this.arpIndex = (this.arpIndex + 1) % rev.length;
        } else if (this.arpConfig.direction === 'upDown') {
          const upDown = [...sequence, ...sequence.slice(1, -1).reverse()];
          currentNote = upDown[this.arpIndex % upDown.length];
          this.arpIndex = (this.arpIndex + 1) % upDown.length;
        } else if (this.arpConfig.direction === 'random') {
          currentNote = sequence[Math.floor(Math.random() * sequence.length)];
        }
      }

      // Each arp step is a short note on its own voice, so tails can overlap.
      const gateMs = getIntervalMs() * 0.8;
      this.startVoice(currentNote, 0.9);
      this.notifyEnvelope(true);
      setTimeout(() => this.releaseVoice(currentNote), gateMs);
    };

    step();
    this.arpStepTimer = setInterval(step, getIntervalMs());
  }

  // --- Visualizer Accessors ---
  public getWaveformData(): Float32Array {
    return this.waveformAnalyzer.getValue() as Float32Array;
  }

  public getFFTData(): Float32Array {
    return this.fftAnalyzer.getValue() as Float32Array;
  }

  // --- Audio Recording (Snippet) ---
  public async startRecording(): Promise<void> {
    await this.startAudioContext();
    this.recorder.start();
  }

  public async stopRecording(): Promise<Blob> {
    const recording = await this.recorder.stop();
    return recording;
  }

  public getParams(): SynthParams {
    return { ...this.currentParams };
  }

  /** How many voices are sounding right now (held or ringing out). */
  public busyVoiceCount(): number {
    return this.voices.filter((v) => v.busy).length;
  }

  public setupMidi(onStatus?: (name: string) => void) {
    if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(
        (midiAccess) => {
          const inputs = midiAccess.inputs.values();
          let deviceName = 'Standard MIDI';
          for (const input of inputs) {
            const name = input.name || 'MIDI Device';
            if (!name.includes('Logic Pro')) {
              deviceName = name;
            }
            input.onmidimessage = (msg) => this.handleMidiMessage(msg as unknown as { data: Uint8Array });
          }
          if (onStatus) onStatus(deviceName);
        },
        () => {
          if (onStatus) onStatus('MIDI Unavailable');
        }
      );
    }
  }

  private handleMidiMessage(event: { data: Uint8Array | number[] }) {
    const [status, noteNumber, velocity] = event.data;
    const command = status >> 4;
    const noteName = Tone.Frequency(noteNumber, 'midi').toNote();

    if (command === 9 && velocity > 0) {
      this.noteOn(noteName, velocity / 127);
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      this.noteOff(noteName);
    }
  }
}
