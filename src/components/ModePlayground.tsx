import React, { useState, useRef } from 'react';
import { SynthParams, Preset, ArpConfig, ArpDivision, ArpDirection, ThemeMode } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import { INITIAL_PRESETS } from '../utils/presets';
import { encodePatch, decodePatch } from '../utils/submissionCodec';
import { copyText } from '../utils/copyText';
import {
  Play,
  Square,
  Share2,
  Radio,
  Download,
  Flame,
  Check,
  Music,
  Activity,
  Zap,
  Copy,
} from 'lucide-react';

interface ModePlaygroundProps {
  engine: SubtractiveEngine;
  params: SynthParams;
  theme: ThemeMode;
  onThemeToggle: () => void;
  onLoadPreset: (preset: Preset) => void;
  onParamChange: (key: keyof SynthParams, val: any) => void;
}

export const ModePlayground: React.FC<ModePlaygroundProps> = ({
  engine,
  params,
  theme,
  onThemeToggle,
  onLoadPreset,
  onParamChange,
}) => {
  // Arpeggiator State
  const [arpEnabled, setArpEnabled] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(120);
  const [division, setDivision] = useState<ArpDivision>('16n');
  const [direction, setDirection] = useState<ArpDirection>('up');

  // Tap Tempo State
  const tapTimesRef = useRef<number[]>([]);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // Preset / Patch Code State
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [savedPresets, setSavedPresets] = useState<Preset[]>(INITIAL_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string>('init-patch');

  // Handle Arp Settings Update
  const updateArp = (newConfig: Partial<ArpConfig>) => {
    if (newConfig.enabled !== undefined) setArpEnabled(newConfig.enabled);
    if (newConfig.bpm !== undefined) setBpm(newConfig.bpm);
    if (newConfig.division !== undefined) setDivision(newConfig.division);
    if (newConfig.direction !== undefined) setDirection(newConfig.direction);

    engine.setArpConfig({
      enabled: newConfig.enabled ?? arpEnabled,
      bpm: newConfig.bpm ?? bpm,
      division: newConfig.division ?? division,
      direction: newConfig.direction ?? direction,
    });
  };

  // Tap Tempo Logic
  const handleTapTempo = () => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    taps.push(now);

    // Keep only last 4 taps within 2.5 seconds
    if (taps.length > 4) taps.shift();
    if (taps.length >= 2 && now - taps[taps.length - 2] > 2500) {
      tapTimesRef.current = [now];
      return;
    }

    if (taps.length >= 2) {
      let intervalsSum = 0;
      for (let i = 1; i < taps.length; i++) {
        intervalsSum += taps[i] - taps[i - 1];
      }
      const avgInterval = intervalsSum / (taps.length - 1);
      const calculatedBpm = Math.round(60000 / avgInterval);
      const clampedBpm = Math.max(40, Math.min(240, calculatedBpm));
      updateArp({ bpm: clampedBpm });
    }
  };

  // Record 5s Snippet
  const handleRecordSnippet = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setRecordingProgress(0);
    setRecordedAudioUrl(null);

    await engine.startRecording();

    const durationSeconds = 5;
    const intervalMs = 100;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += intervalMs;
      setRecordingProgress(Math.min(100, (elapsed / (durationSeconds * 1000)) * 100));
    }, intervalMs);

    setTimeout(async () => {
      clearInterval(timer);
      const blob = await engine.stopRecording();
      setIsRecording(false);
      setRecordingProgress(100);
      const audioUrl = URL.createObjectURL(blob);
      setRecordedAudioUrl(audioUrl);
    }, durationSeconds * 1000);
  };

  // Copy the patch as a short code
  const handleCopyPatchCode = async () => {
    const encoded = await encodePatch(params);
    if (await copyText(encoded)) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } else {
      window.prompt('Your browser blocked copying. Press Ctrl+C to copy this patch code:', encoded);
    }
  };

  // Paste & import a patch code (new short codes, older codes, or a ?patch= link)
  const handleImportPatchCode = async () => {
    const code = window.prompt('Paste synthesizer patch code:');
    if (!code) return;
    const parsedParams = await decodePatch(code);
    if (!parsedParams) {
      alert('Invalid patch code. Please make sure you copied the whole code.');
      return;
    }
    onLoadPreset({
      id: 'imported-' + Date.now(),
      name: 'Imported Patch',
      category: 'Custom' as Preset['category'],
      description: '',
      params: parsedParams,
    });
    alert('Synth patch imported successfully!');
  };

  return (
    <div id="mode-playground-bar" className="mb-4 space-y-3">
      {(() => {
        const active = savedPresets.find((p) => p.id === activePresetId);
        return active?.why ? (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/25 px-3 py-2 text-xs text-slate-200 flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono font-bold text-amber-300">{active.name}:</span>
            <span className="text-slate-300">{active.description}</span>
            <span className="text-amber-100">
              <b className="font-mono text-amber-300">What makes it work:</b> {active.why}
            </span>
          </div>
        ) : null;
      })()}
      {/* Top Playground Control Rack */}
      <div className="rounded-xl bg-[#12151b] border border-[#2b3342] p-3 shadow-xl text-slate-100 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Presets Selection */}
        <div className="flex items-center gap-2 flex-wrap">
          <Music className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold text-slate-300">PRESETS:</span>
          <select
            value={activePresetId}
            onChange={(e) => {
              const p = savedPresets.find((item) => item.id === e.target.value);
              if (p) {
                setActivePresetId(p.id);
                onLoadPreset(p);
              }
            }}
            className="px-2.5 py-1 text-xs rounded bg-slate-800 text-amber-300 border border-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            {savedPresets.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.category}] {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCopyPatchCode}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 border border-white/10 transition-colors"
            title="Copy patch base64 code"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Code Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copy Patch Code</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleImportPatchCode}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 border border-white/10 transition-colors"
            title="Paste and import patch base64 code"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Paste & Import Patch Code</span>
          </button>
        </div>

        {/* Center: 5s Snippet Recording Rack */}
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
          <div className={`w-3 h-3 rounded-full bg-red-500 ${isRecording ? 'animate-ping' : ''}`} />
          <button
            type="button"
            onClick={handleRecordSnippet}
            disabled={isRecording}
            className={`px-3 py-1 rounded text-xs font-bold font-mono uppercase transition-all flex items-center gap-1.5 ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
            }`}
          >
            {isRecording ? 'Recording 5sec...' : 'Record 5sec Snippet'}
          </button>

          {isRecording && (
            <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all duration-100"
                style={{ width: `${recordingProgress}%` }}
              />
            </div>
          )}

          {recordedAudioUrl && !isRecording && (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <audio src={recordedAudioUrl} controls className="h-6 w-36" />
              <a
                href={recordedAudioUrl}
                download="my-synth-performance.wav"
                className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                title="Download WAV Recording"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Right: Theme Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onThemeToggle}
            className="px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all border flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            Theme: {theme === 'studio-retro' ? 'Retro Synth' : 'Modern Synth'}
          </button>
        </div>
      </div>

      {/* Arpeggiator Dedicated Control Panel (Exclusive to Playground) */}
      <div
        id="playground-arpeggiator"
        className={`rounded-xl p-3 border transition-all ${
          arpEnabled
            ? 'bg-gradient-to-r from-amber-950/40 via-[#181d24] to-emerald-950/40 border-amber-500/50 shadow-lg'
            : 'bg-[#121419] border-[#252b36]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Arp Power Toggle */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => updateArp({ enabled: !arpEnabled })}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                arpEnabled
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_#f59e0b]'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/10'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${arpEnabled ? 'fill-current' : ''}`} />
              ARP: {arpEnabled ? 'ON (ACTIVE)' : 'OFF'}
            </button>
          </div>

          {/* BPM & Tap Tempo */}
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-lg border border-white/10">
            <span className="text-xs font-mono text-slate-300">TEMPO:</span>
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => updateArp({ bpm: Number(e.target.value) })}
              className="w-14 px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs text-center border border-slate-700"
            />
            <span className="text-xs font-mono text-slate-400">BPM</span>

            <button
              type="button"
              onClick={handleTapTempo}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-black text-amber-300 text-xs font-mono font-bold transition-colors active:scale-95 ml-1 border border-amber-500/30"
            >
              TAP
            </button>
          </div>

          {/* Beat Division: 16th, 8th, 1/4 */}
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-lg border border-white/10">
            <span className="text-xs font-mono text-slate-300 mr-1">DIVISION:</span>
            {(['16n', '8n', '4n'] as ArpDivision[]).map((div) => (
              <button
                key={div}
                type="button"
                onClick={() => updateArp({ division: div })}
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase transition-colors ${
                  division === div
                    ? 'bg-amber-500 text-black'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {div === '16n' ? '1/16' : div === '8n' ? '1/8' : '1/4'}
              </button>
            ))}
          </div>

          {/* Direction: Up, Down, Up & Down, Random */}
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-lg border border-white/10">
            <span className="text-xs font-mono text-slate-300 mr-1">DIRECTION:</span>
            {(
              [
                { label: 'UP', value: 'up' },
                { label: 'DOWN', value: 'down' },
                { label: 'UP/DN', value: 'upDown' },
                { label: 'RND', value: 'random' },
              ] as { label: string; value: ArpDirection }[]
            ).map((dir) => (
              <button
                key={dir.value}
                type="button"
                onClick={() => updateArp({ direction: dir.value })}
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase transition-colors ${
                  direction === dir.value
                    ? 'bg-amber-500 text-black'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {dir.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
