import * as Tone from 'tone';
import { SynthParams, ArpConfig } from '../types';

/** Most notes that can sound at once. Kept modest so Chromebooks stay smooth. */
export const MAX_VOICES = 8;

/** Mix level for each voice, so chords don't slam into the limiter. */
const VOICE_LEVEL = 0.6;

/** Pitch LFO depth in cents: depth² curve so small values are gentle vibrato and high values are a siren. */
export const lfoPitchCents = (depth: number) => 800 * depth * depth;

/** Cutoff LFO swing in Hz at full depth. */
const LFO_CUTOFF_HZ = 3500;

/** Pulse-width LFO swing at full depth (in Tone's -1..1 width units). */
const LFO_PWM_SWING = 0.8;

/** Filter envelope swing in Hz at 100% amount. */
const FILTER_ENV_HZ = 8000;

/**
 * Pulse width in the app is the duty cycle: 0.5 = a true square (50% up, 50% down),
 * 0.1 or 0.9 = a thin pulse. Tone.js measures width from -1 to 1 with 0 = square.
 */
export const dutyToToneWidth = (duty: number) => Math.max(-0.96, Math.min(0.96, 2 * duty - 1));

const clampHz = (hz: number) => Math.max(20, Math.min(20000, hz));

type Osc = Tone.Oscillator | Tone.PulseOscillator;

/** One note's worth of synth: two oscillators + noise → filter → amp envelope. */
class Voice {
  osc1: Osc | null = null;
  osc2: Osc | null = null;
  osc1Gain: Tone.Gain;
  osc2Gain: Tone.Gain;
  noiseGain: Tone.Gain;
  filter: Tone.Filter;
  filterEnv: Tone.Envelope;
  filterEnvGain: Tone.Gain;
  ampEnv: Tone.AmplitudeEnvelope;

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

    this.osc1Gain.connect(this.filter);
    this.osc2Gain.connect(this.filter);
    this.noiseGain.connect(this.filter);
    noise.connect(this.noiseGain);
    this.filterEnv.connect(this.filterEnvGain);
    this.filterEnvGain.connect(this.filter.frequency);
    engine.lfoCutoffGain.connect(this.filter.frequency);
    this.filter.connect(this.ampEnv);
    this.ampEnv.connect(out);

    this.buildOscillators();
    this.update(p);
  }

  private makeOsc(wave: SynthParams['vco1Waveform'], duty: number): Osc | null {
    if (wave === 'noise') return null;
    if (wave === 'square') {
      const o = new Tone.PulseOscillator({ frequency: this.freq, width: dutyToToneWidth(duty) });
      this.engine.lfoPwmGain.connect(o.width);
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
      this.engine.lfoPitchGain.connect(this.osc1.detune);
    }
    if (this.osc2) {
      this.osc2.connect(this.osc2Gain);
      this.engine.lfoPitchGain.connect(this.osc2.detune);
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
    this.filterEnvGain.gain.rampTo((p.filterEnvAmount / 100) * FILTER_ENV_HZ, 0.05);

    this.ampEnv.attack = Math.max(0.001, p.ampAttack);
    this.ampEnv.decay = Math.max(0.01, p.ampDecay);
    this.ampEnv.sustain = Math.max(0, Math.min(1, p.ampSustain));
    this.ampEnv.release = Math.max(0.01, p.ampRelease);
    this.filterEnv.attack = Math.max(0.001, p.modAttack);
    this.filterEnv.decay = Math.max(0.01, p.modDecay);
    this.filterEnv.sustain = Math.max(0, Math.min(1, p.modSustain));
    this.filterEnv.release = Math.max(0.01, p.modRelease);

    this.setPitch(this.freq, 0.01);
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
      this.filter.frequency.value = cutoff;
    } else {
      this.osc1?.frequency.exponentialRampTo(f1, ramp);
      this.osc2?.frequency.exponentialRampTo(f2, ramp);
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
    const now = Tone.now();
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
  private waveformAnalyzer!: Tone.Waveform;
  private fftAnalyzer!: Tone.FFT;
  private recorder!: Tone.Recorder;
  private lfo!: Tone.LFO;
  /** Shared LFO sends; every voice listens to these. */
  lfoPitchGain!: Tone.Gain;
  lfoCutoffGain!: Tone.Gain;
  lfoPwmGain!: Tone.Gain;

  private voices: Voice[] = [];

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
    this.limiter = new Tone.Compressor({ threshold: -3, ratio: 20, attack: 0.003, release: 0.08, knee: 2 });
    this.masterGain = new Tone.Gain(this.currentParams.masterVolume);
    this.voiceBus = new Tone.Gain(VOICE_LEVEL);
    this.waveformAnalyzer = new Tone.Waveform(1024);
    this.fftAnalyzer = new Tone.FFT(512);
    this.recorder = new Tone.Recorder();

    this.voiceBus.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(Tone.getDestination());
    this.limiter.connect(this.waveformAnalyzer);
    this.limiter.connect(this.fftAnalyzer);
    this.limiter.connect(this.recorder);

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
    this.lfoPwmGain = new Tone.Gain(0);
    this.lfo.connect(this.lfoPitchGain);
    this.lfo.connect(this.lfoCutoffGain);
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
    const d = p.lfoDepth;
    this.lfoPitchGain.gain.rampTo(p.lfoDestination === 'pitch' ? lfoPitchCents(d) : 0, 0.05);
    this.lfoCutoffGain.gain.rampTo(p.lfoDestination === 'cutoff' ? d * LFO_CUTOFF_HZ : 0, 0.05);
    this.lfoPwmGain.gain.rampTo(p.lfoDestination === 'pwm' ? d * LFO_PWM_SWING : 0, 0.05);
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
