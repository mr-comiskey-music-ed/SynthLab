export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'noise';

export type LfoDestination = 'pitch' | 'cutoff';

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
  vco1PulseWidth: number; // 0.1 to 0.9

  // VCO 2
  vco2Waveform: WaveformType;
  vco2Octave: number; // -2, -1, 0, 1, 2
  vco2Semi: number; // -12 to 12
  vco2Fine: number; // -50 to +50 cents
  vco2Level: number; // 0 to 1
  vco2PulseWidth: number; // 0.1 to 0.9

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
  category: 'Bass' | 'Lead' | 'Pad' | 'Pluck' | 'FX' | 'Drums';
  description: string;
  params: SynthParams;
}

export interface PatchMatcherChallenge {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  hint: string;
  targetParams: SynthParams;
  referenceNotes: string[]; // Notes played during reference playback
  referenceDuration: number;
}

export interface SynthDoctorTicket {
  id: string;
  ticketNumber: number;
  title: string;
  clientComplaint: string;
  diagnosticClue: string;
  brokenParams: SynthParams;
  // Validation function criteria:
  paramKey: keyof SynthParams;
  targetMin?: number;
  targetMax?: number;
  targetValue?: any;
  fixExplanation: string;
  recommendedTheme: ThemeMode;
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
  }[];
  encodedVerification: string;
  patchUrl: string;
  /** Task IDs the teacher assigned (from the assignment link). Empty/missing = all tasks. */
  assignedTasks?: string[];
}
