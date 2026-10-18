/** One note in a test phrase. Times are in seconds. */
export interface PhraseNote {
  note: string;
  at: number;
  dur: number;
  vel?: number;
}

export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'noise';

export type VoiceMode = 'poly' | 'mono';

export type LfoDestination = 'pitch' | 'cutoff' | 'pwm';

export type FilterType = 'lowpass';
export type FilterRolloff = -12 | -24;

export interface SynthParams {
  // Master
  masterVolume: number; // 0 to 1
  
  // VCO 1
  vco1Waveform: WaveformType;
  vco1Octave: number; // -2, -1, 0, 1, 2
  vco1Semi: number; // -12 to 12
  vco1Fine: number; // -50 to +50 cents
  vco1Level: number; // 0 to 1
  vco1PulseWidth: number; // duty cycle 0.05 to 0.95 (0.5 = square)

  // VCO 2
  vco2Waveform: WaveformType;
  vco2Octave: number; // -2, -1, 0, 1, 2
  vco2Semi: number; // -12 to 12
  vco2Fine: number; // -50 to +50 cents
  vco2Level: number; // 0 to 1
  vco2PulseWidth: number; // duty cycle 0.05 to 0.95 (0.5 = square)

  // Noise & Mix
  noiseLevel: number; // 0 to 1
  oscBalance: number; // -1 (all VCO1) to +1 (all VCO2)

  // VCF (Filter)
  filterCutoff: number; // 20 to 20000 Hz
  filterResonance: number; // 0.1 to 20
  filterEnvAmount: number; // -100 to 100 (%)
  filterKeyTracking: number; // 0 to 1
  filterRolloff: FilterRolloff; // -12 or -24 dB/oct

  // Amp EG
  ampAttack: number; // 0.001 to 4s
  ampDecay: number; // 0.01 to 4s
  ampSustain: number; // 0 to 1
  ampRelease: number; // 0.01 to 6s

  // Filter / Mod EG
  modAttack: number; // 0.001 to 4s
  modDecay: number; // 0.01 to 4s
  modSustain: number; // 0 to 1
  modRelease: number; // 0.01 to 6s

  // LFO
  lfoRate: number; // 0.1 to 25 Hz
  lfoWaveform: 'sine' | 'triangle' | 'sawtooth' | 'square';
  lfoDepth: number; // 0 to 1
  lfoDestination: LfoDestination;

  // Voicing
  voiceMode: VoiceMode; // 'poly' = chords; 'mono' = one note at a time, with glide
  glide: number; // seconds to slide between notes (mono only), 0 to 1
}

export type ThemeMode = 'studio-retro' | 'hardware-bench';

export type AppMode = 'learn' | 'playground' | 'challenges' | 'teacher';

export type ArpDivision = '16n' | '8n' | '4n';
export type ArpDirection = 'up' | 'down' | 'upDown' | 'random';

export interface ArpConfig {
  enabled: boolean;
  bpm: number;
  division: ArpDivision;
  direction: ArpDirection;
  octaves: number; // 1 to 3
}

export interface Preset {
  id: string;
  name: string;
  category: 'Bass' | 'Lead' | 'Pad' | 'Pluck' | 'FX' | 'Drums' | 'Brass' | 'Strings' | 'Keys' | 'Custom';
  description: string;
  /** "What makes it work": the 2-3 settings that give this sound its character. */
  why?: string;
  params: SynthParams;
}

/** One thing the Patch Master grader compares (see utils/patchScore.ts). */
export type PatchAspect =
  | 'wave'
  | 'octave'
  | 'pulseWidth'
  | 'osc2'
  | 'detune'
  | 'noise'
  | 'oscMuted'
  | 'cutoff'
  | 'resonance'
  | 'filterEnv'
  | 'filterDecay'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release'
  | 'lfo';

export interface PatchMatcherChallenge {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  hint: string;
  targetParams: SynthParams;
  /** The patch loaded when the student opens this challenge: the target with a few graded settings knocked off. */
  startParams: SynthParams;
  /** What the auto-grader listens for on this patch, with weights that add up to 100. */
  gradeOn: Partial<Record<PatchAspect, number>>;
  /** What plays for "Play the Target" and "Play My Synth": chosen to show off what defines this patch. */
  phrase: PhraseNote[];
}

export interface SynthDoctorTicket {
  id: string;
  ticketNumber: number;
  title: string;
  clientComplaint: string;
  /** Clue 1: which part of the synth to look at. */
  sectionClue: string;
  /** Clue 2: the exact control. */
  diagnosticClue: string;
  brokenParams: SynthParams;
  // Validation function criteria:
  paramKey: keyof SynthParams;
  targetMin?: number;
  targetMax?: number;
  targetValue?: any;
  /** Any of these values fixes it (e.g. sine or triangle). */
  targetValues?: any[];
  fixExplanation: string;
  recommendedTheme: ThemeMode;
  /** A test phrase that makes this ticket's problem easy to hear. */
  phrase: PhraseNote[];
}

export interface BlindTestChallenge {
  id: string;
  question: string;
  optionA: {
    label: string;
    params: SynthParams;
    note: string;
  };
  optionB: {
    label: string;
    params: SynthParams;
    note: string;
  };
  correctOption: 'A' | 'B';
  explanation: string;
  /** What both tones play: chosen so the difference is easy to hear. */
  phrase: PhraseNote[];
}

export type BriefKind = 'Music' | 'Sound FX';
/** What the test button plays so students can hear their patch in context. */
export type PhraseId = 'bassRiff' | 'padChords' | 'leadLine' | 'pluckArp' | 'longHit' | 'shortHits' | 'swell' | 'drumBeat';

export interface SoundBrief {
  id: string;
  kind: BriefKind;
  title: string;
  /** The request, written like a client or producer would ask. */
  ask: string;
  /** What a teacher (and the student) should listen for. */
  listenFor: string;
  /** Hint 1: where to start. Hint 2: more specific settings. */
  hints: [string, string];
  phrase: PhraseId;
}

/** A student's saved sound: a Sound Design Brief answer or one of their My Presets. */
export interface BriefWork {
  params: SynthParams;
  /** How many hints they opened (0-2). Briefs only. */
  hints: number;
  /** Optional one-line description in the student's words. */
  note?: string;
  /** My Presets: the name the student gave it. */
  name?: string;
  /** My Presets: the preset it remixes, or the adventure it followed. */
  base?: string;
  /** My Presets: which test phrase suits it (for playback in the grade report). */
  phrase?: PhraseId;
}

export interface TeacherAssignment {
  code: string;
  title: string;
  tasks: string[]; // task IDs like ['pm-pluck', 'sd-1', 'ab-1']
  dueDate?: string;
}

export interface StudentSubmission {
  studentName: string;
  assignmentCode: string;
  timestamp: number;
  totalScore: number;
  completedTasks: {
    taskId: string;
    taskTitle: string;
    score: number;
    /** Patch Master only: how many times Test Match was pressed (score is the best). */
    tries?: number;
  }[];
  encodedVerification: string;
  patchUrl: string;
  /** Task IDs the teacher assigned (from the assignment link). Empty/missing = all tasks. */
  assignedTasks?: string[];
  /** Sound Design Brief patches, by brief id. */
  briefs?: Record<string, BriefWork>;
}
