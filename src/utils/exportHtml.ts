export function getStandaloneHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Subtractive Synthesis Lab (Standalone)</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"><\/script>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@400;500;600;700&display=swap');
    body { font-family: 'Barlow', system-ui, sans-serif; font-variant-numeric: tabular-nums; }
    .font-mono { font-family: 'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif; }
  </style>
</head>
<body class="bg-[#0e1117] text-slate-100 min-h-screen p-4 select-none">
  <div class="max-w-5xl mx-auto space-y-4">
    <header class="flex items-center justify-between border-b border-amber-500/30 pb-3">
      <div>
        <h1 class="text-xl font-bold text-amber-400">🎹 SUBTRACTIVE SYNTHESIS LAB</h1>
        <p class="text-xs text-slate-400">Standalone Client-Side Edition (Tone.js CDN)</p>
      </div>
      <div id="audio-status" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-xs border border-amber-500/30">
        Click anywhere to enable audio
      </div>
    </header>

    <!-- Visualizer -->
    <div class="bg-black rounded-xl p-2 border border-slate-800">
      <div class="text-[10px] text-emerald-400 mb-1">OLED VECTOR OSCILLOSCOPE & FFT SPECTRUM</div>
      <canvas id="scopeCanvas" width="800" height="140" class="w-full h-32 bg-[#050806] rounded"></canvas>
    </div>

    <!-- Synth Controls Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- VCO -->
      <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
        <h3 class="text-xs font-bold text-amber-300 border-b border-white/10 pb-1">1. OSCILLATOR (VCO)</h3>
        <div>
          <label class="text-[10px] text-slate-400 block mb-1">Waveform</label>
          <div class="flex gap-1" id="waveButtons">
            <button onclick="setWave('sawtooth')" class="px-2 py-1 text-xs rounded bg-amber-500 text-black font-bold">SAW</button>
            <button onclick="setWave('square')" class="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300">SQR</button>
            <button onclick="setWave('triangle')" class="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300">TRI</button>
            <button onclick="setWave('sine')" class="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300">SIN</button>
          </div>
        </div>
        <div>
          <label class="text-[10px] text-slate-400 block">Octave: <span id="octVal">0</span></label>
          <input type="range" min="-2" max="2" value="0" step="1" oninput="setOct(this.value)" class="w-full">
        </div>
      </div>

      <!-- VCF -->
      <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
        <h3 class="text-xs font-bold text-red-400 border-b border-white/10 pb-1">2. FILTER (VCF)</h3>
        <div>
          <label class="text-[10px] text-slate-400 block">Cutoff: <span id="cutVal">3500</span> Hz</label>
          <input type="range" min="50" max="16000" value="3500" oninput="setCutoff(this.value)" class="w-full">
        </div>
        <div>
          <label class="text-[10px] text-slate-400 block">Resonance (Q): <span id="resVal">3</span></label>
          <input type="range" min="0.1" max="18" step="0.1" value="3" oninput="setRes(this.value)" class="w-full">
        </div>
      </div>

      <!-- AMP ADSR -->
      <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2">
        <h3 class="text-xs font-bold text-emerald-400 border-b border-white/10 pb-1">3. AMP ENVELOPE (ADSR)</h3>
        <div>
          <label class="text-[10px] text-slate-400 block">Attack: <span id="attVal">0.02</span>s</label>
          <input type="range" min="0.001" max="2" step="0.01" value="0.02" oninput="setAttack(this.value)" class="w-full">
        </div>
        <div>
          <label class="text-[10px] text-slate-400 block">Decay: <span id="decVal">0.4</span>s</label>
          <input type="range" min="0.01" max="2" step="0.01" value="0.4" oninput="setDecay(this.value)" class="w-full">
        </div>
        <div>
          <label class="text-[10px] text-slate-400 block">Sustain: <span id="susVal">0.6</span></label>
          <input type="range" min="0" max="1" step="0.01" value="0.6" oninput="setSustain(this.value)" class="w-full">
        </div>
        <div>
          <label class="text-[10px] text-slate-400 block">Release: <span id="relVal">0.3</span>s</label>
          <input type="range" min="0.01" max="3" step="0.01" value="0.3" oninput="setRelease(this.value)" class="w-full">
        </div>
      </div>
    </div>

    <!-- Piano Keys -->
    <div class="bg-black/60 p-4 rounded-xl border border-slate-800">
      <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
        <span>Play with Mouse or Computer Keyboard (A, W, S, E, D, F, T, G, Y, H, U, J, K...)</span>
      </div>
      <div id="keyboard" class="flex h-36 relative bg-black/40 rounded overflow-hidden"></div>
    </div>
  </div>

  <script>
    let isStarted = false;
    let synth, filter, limiter, waveform, fft;
    let octaveOffset = 0;

    function initAudio() {
      if (isStarted) return;
      Tone.start();
      isStarted = true;
      document.getElementById('audio-status').textContent = 'Audio Active';
      document.getElementById('audio-status').className = 'px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30';

      limiter = new Tone.Limiter(-1).toDestination();
      waveform = new Tone.Waveform(1024);
      fft = new Tone.FFT(64);
      limiter.connect(waveform);
      limiter.connect(fft);

      filter = new Tone.Filter({
        frequency: 3500,
        type: 'lowpass',
        rolloff: -24,
        Q: 3
      }).connect(limiter);

      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.4, sustain: 0.6, release: 0.3 }
      }).connect(filter);

      renderCanvas();
    }

    document.body.addEventListener('click', initAudio, { once: true });

    function setWave(type) {
      initAudio();
      synth.set({ oscillator: { type } });
      const btns = document.querySelectorAll('#waveButtons button');
      btns.forEach(b => {
        if (b.textContent.toLowerCase().includes(type.substring(0, 3))) {
          b.className = 'px-2 py-1 text-xs rounded bg-amber-500 text-black font-bold';
        } else {
          b.className = 'px-2 py-1 text-xs rounded bg-slate-800 text-slate-300';
        }
      });
    }

    function setOct(val) {
      octaveOffset = parseInt(val);
      document.getElementById('octVal').textContent = val;
    }
    function setCutoff(val) {
      initAudio();
      filter.frequency.rampTo(parseFloat(val), 0.05);
      document.getElementById('cutVal').textContent = Math.round(val);
    }
    function setRes(val) {
      initAudio();
      filter.Q.rampTo(parseFloat(val), 0.05);
      document.getElementById('resVal').textContent = val;
    }
    function setAttack(val) {
      initAudio();
      synth.set({ envelope: { attack: parseFloat(val) } });
      document.getElementById('attVal').textContent = val;
    }
    function setDecay(val) {
      initAudio();
      synth.set({ envelope: { decay: parseFloat(val) } });
      document.getElementById('decVal').textContent = val;
    }
    function setSustain(val) {
      initAudio();
      synth.set({ envelope: { sustain: parseFloat(val) } });
      document.getElementById('susVal').textContent = val;
    }
    function setRelease(val) {
      initAudio();
      synth.set({ envelope: { release: parseFloat(val) } });
      document.getElementById('relVal').textContent = val;
    }

    // Oscilloscope & Spectrum Canvas
    function renderCanvas() {
      const canvas = document.getElementById('scopeCanvas');
      const ctx = canvas.getContext('2d');

      function draw() {
        requestAnimationFrame(draw);
        if (!waveform) return;

        ctx.fillStyle = '#050806';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Oscilloscope
        const wave = waveform.getValue();
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#34d399';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 6;

        const slice = canvas.width / wave.length;
        let x = 0;
        for (let i = 0; i < wave.length; i++) {
          const y = (canvas.height * 0.4) + (wave[i] * (canvas.height * 0.35));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += slice;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // FFT Bars
        const fftData = fft.getValue();
        const barW = canvas.width / fftData.length;
        for (let i = 0; i < fftData.length; i++) {
          const norm = Math.max(0, (fftData[i] + 90) / 90);
          const h = norm * (canvas.height * 0.35);
          ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
          ctx.fillRect(i * barW, canvas.height - h, barW - 1, h);
        }
      }
      draw();
    }

    // Virtual Keyboard Setup
    const notes = [
      { n: 'C4', b: false, k: 'a' }, { n: 'C#4', b: true, k: 'w' },
      { n: 'D4', b: false, k: 's' }, { n: 'D#4', b: true, k: 'e' },
      { n: 'E4', b: false, k: 'd' }, { n: 'F4', b: false, k: 'f' },
      { n: 'F#4', b: true, k: 't' }, { n: 'G4', b: false, k: 'g' },
      { n: 'G#4', b: true, k: 'y' }, { n: 'A4', b: false, k: 'h' },
      { n: 'A#4', b: true, k: 'u' }, { n: 'B4', b: false, k: 'j' },
      { n: 'C5', b: false, k: 'k' }
    ];

    const kbContainer = document.getElementById('keyboard');
    notes.forEach((item, idx) => {
      if (!item.b) {
        const keyEl = document.createElement('div');
        keyEl.className = 'flex-1 bg-slate-100 hover:bg-slate-200 text-black border-r border-slate-400 flex flex-col justify-end p-2 cursor-pointer';
        keyEl.innerHTML = \`<span class="text-[10px] font-bold">\${item.k.toUpperCase()}</span><span class="text-[9px] text-slate-500">\${item.n}</span>\`;
        keyEl.onmousedown = () => { initAudio(); synth.triggerAttack(Tone.Frequency(item.n).transpose(octaveOffset * 12).toNote()); };
        keyEl.onmouseup = () => { if (synth) synth.triggerRelease(Tone.Frequency(item.n).transpose(octaveOffset * 12).toNote()); };
        kbContainer.appendChild(keyEl);
      }
    });

    // Computer keyboard events
    const keyMap = { a: 'C4', w: 'C#4', s: 'D4', e: 'D#4', d: 'E4', f: 'F4', t: 'F#4', g: 'G4', y: 'G#4', h: 'A4', u: 'A#4', j: 'B4', k: 'C5' };
    window.addEventListener('keydown', (e) => {
      const note = keyMap[e.key.toLowerCase()];
      if (note && !e.repeat) {
        initAudio();
        synth.triggerAttack(Tone.Frequency(note).transpose(octaveOffset * 12).toNote());
      }
    });
    window.addEventListener('keyup', (e) => {
      const note = keyMap[e.key.toLowerCase()];
      if (note && synth) {
        synth.triggerRelease(Tone.Frequency(note).transpose(octaveOffset * 12).toNote());
      }
    });
  <\/script>
</body>
</html>`;
}
