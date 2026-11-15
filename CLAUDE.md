# SynthLab

## Purpose
A subtractive synthesis lab. Students learn how oscillators, filters,
envelopes and LFOs shape a sound, then use that to design sounds on
purpose. Drills are the means; the goal is students expressing
themselves with sound.

## Hard rules
- Never store student data of any kind. No backend, no analytics.
  The student's name lives only inside their submission code.
- Students show work with a base64 code pasted into Google Classroom
  (`src/utils/submissionCodec.ts`).
- The only thing kept in the browser is an autosave of the student's
  own work (localStorage key `synthlab:v1:autosave`,
  `src/utils/autosave.ts`): finished tasks, saved sounds, and Learn and
  synth-guide progress, never the student's name. It is never sent anywhere. No
  cookies, no other storage. The submission code is still what students
  hand in. On load, a "Restore your last session?" prompt offers
  Restore or Start Fresh; autosave stays off until they answer.
- Must run well on Chromebooks and stay lightweight.
- Live at synthlab.mrcomiskey.com via Vercel (deploys from `main`).
  Work on a branch and don't push to main unless I say so.

## Tech
- Vite + React 19 + TypeScript, Tailwind 4, Tone.js for audio
  (`src/audio/synthEngine.ts`).
- `npm run dev` (port 3000), `npm run build`, `npm run lint` (tsc only;
  there are no tests).
- Content lives in `src/utils/`: `learnSteps.ts`, `presets.ts`
  (Playground presets, Patch Master, Synth Doctor, Ear Training),
  `briefs.ts`, `myPresets.ts`, `adventures.ts`, `soundtrap.ts`
  and `retroSynth.ts` (the synth guides, sharing `guides.ts`); `taskCatalog.ts` maps task IDs to challenges for
  grading.

## Structure
Learn, then five challenges in this order: 1. A/B Ear Training,
2. Synth Doctor, 3. My Presets, 4. Sound Design, 5. Patch Master.
(In code, Patch Master is still called "Patch Matcher".)
- By default every task counts. The Teacher tab's optional
  "Assignment Link" builder (`AssignmentLinkBuilder.tsx`) makes a link
  with `?assignment=<name>&tasks=<ids>` so students are graded only on
  the picked tasks. The link carries the task list; nothing is stored.
- Patch Master gets its own separate grade, graded on effort.
- Synth Doctor clues cost 5 points each (`DOCTOR_CLUE_COST`).
- Test-phrase buttons everywhere: a "Test phrase" tag, then
  "Play: <phrase name>" with a Loop toggle beside it
  (`PhraseButtons.tsx`).
- Challenges start from a blank patch where it makes sense.
- "Close" feedback (`src/utils/nearMiss.ts`): Synth Doctor shows an amber
  "So close!" when the fix control has covered 85%+ of the way from the
  broken value to the fix (`CLOSE_SHARE`; Cutoff is measured in octaves,
  Octave counts one step away). Patch Master says "So close!" at 70-79
  (a match is 80+) and names the biggest gap left. Learn missions do not
  have this yet.
- Checkmarks come from the app's `completedTasks`, not from the
  Challenges screen's own state, so they survive switching tabs and
  restoring a code: each quest tab shows a check (all done) or n/m, the
  Doctor and Patch Master number buttons get checks, and Ear Training
  answers are rebuilt from the saved score (100 = picked the right tone).
- Learn has 9 steps with labeled step buttons. Once finished, it is
  freely navigable and ends with "Review steps" and "Go to Challenges".
- Synth guides: optional, ungraded extras that map SynthLab onto the
  DAW synths students use, deliberately kept out of the main path. One
  shared screen (`ModeGuide.tsx`) runs each guide from a `GuideDef`
  (`SoundtrapGuide.tsx`, `RetroGuide.tsx`). Reached from a small "For
  later" line on Learn's finish screen (and step-bar chips once Learn is
  done), or a `?guide=soundtrap` / `?guide=retro` link (copyable in the
  Assignment Link builder). Each has 7 steps with Learn-style missions
  on a playable copy of the synth's panel, then 5 "Settings to try"
  shown as small read-only panels. The Challenges stay the clear next
  step. Progress shows in the Grade Report (once a step is done), batch
  grading and CSV, and travels in the code (`s`, `r`). The panels' extra
  hardware is `EngineExtras` in `synthEngine.ts`, off outside the
  guides; leaving a guide restores the student's previous patch.
  - Soundtrap (app mode `soundtrap`, `SoundtrapView.tsx`): Juno-106
    style; HPF, Sub-Osc, Chorus, LFO delay, per-section LFO amounts.
  - Logic Retro Synth (app mode `retro`, `RetroView.tsx`): ANALOG
    engine only. Shape 1 sweeps Noise, Saw, Square, then a narrowing
    pulse; Shape 2 the same from Triangle. Two separate LFOs (LFO:
    cutoff and Shape Modulation; VIBRATO: pitch), each with its own
    wave, Rate, Sync and depth slider. Sine Level is added after the
    filter (not a sub). LP 24dB / LP 12dB / HP 12dB, Flanger or Chorus.
    Shows Logic's units (Cutoff, Res, Sustain as 0-1; Mix reads 1.00 at
    Osc 1, 0.00 at Osc 2, shown in place of the "Mix" title while
    dragging). Envelope and filter dots drag like Logic's. Glide is
    polyphonic (`polyGlide`); its Mode menu is left out. Vel sliders are
    shown but inert. The guide skips Sine Level (knob only).
- Voices: Poly (chords) or Mono with Glide.
- Sound Design briefs: 4 Music and 4 Sound FX requests, each with two
  click-to-reveal hint layers (broad, then specific).
- My Presets: 2 Adventures (guided from-scratch builds by sound type),
  2 Remixes (3+ significant changes, see `significance.ts`), 1 Original.

## Grading
- Student Grade Report: one box per challenge, in app order, plus
  whether Learn was completed.
- Teacher side is batch only: one paste box for a whole class (can be
  a pasted Classroom page). One compact line per student, with the
  same per-quest boxes as the student report. Ear Training and Synth
  Doctor are shown separately, not as a "Main Grade". No
  individual-code check. Sound Design choices show in an expandable
  list per brief.
- Progress recovery: browser autosave with a restore prompt (see Hard
  rules), a "restore progress" box (paste last submission code, for a
  different computer or cleared browser), a leave-page warning that now
  fires only if the browser can't autosave and the work isn't in a code
  yet, and a reminder to make a code to turn in. Batch grading flags
  codes restored from another student's name.

## Design
- Typefaces: Barlow and Barlow Semi Condensed only. Keep the count low.
- Header title is "SynthLab" in mixed case with the S and L set larger,
  "ynth" tucked toward the S and "ab" tight against the L's foot, and a
  thin four-color bar above and below (amber, red, green, blue: the
  Modern Synth's oscillator, filter, envelope and LFO colors;
  `SectionBar` in `App.tsx`). The browser tab title and manifest say "SynthLab" too.
- Logo: silver panel, thin walnut side cheeks, and an ADSR envelope
  drawn in the four section colors (Attack amber, Decay red, Sustain
  green, Release blue) with a black dot on the peak. Used as tab icon
  and header icon. Artwork lives in `SynthLabLogo.tsx` and
  `public/favicon.svg`; the PNG/ICO icons in `public/` are rendered from
  the SVG (bump `?v=` in `index.html` when they change).
- Two synth looks: Vintage Synth and Modern Synth (`studio-retro` and
  `hardware-bench` in code). The LFO knob is labeled "Depth" on both
  (Modern Synth used to say "Int"). The Filter EG knob
  is labeled "EG Amount" on both; it has a subtle green ring always and
  a strong pulsing ring on the Learn Filter envelope step.
- LFO rate stays in Hz.
- Touch screens must clearly separate swipe-to-scroll from
  touch-and-drag on knobs. A touch that starts on a knob dial or slider
  track turns it and never scrolls (`touch-none` on just those parts);
  a swipe that starts anywhere else, including a knob's label or
  readout, scrolls the page.

## Open items (check the repo first)
- `npm run lint` has 5 type errors in `App.tsx` (restored-progress
  parsing, around line 273). The app still builds.
- Leftover Google AI Studio scaffolding that the app doesn't use:
  `@google/genai`, `express`, `dotenv`, `tsx` in package.json; the
  package name "react-example"; `.env.example` (Gemini key);
  `metadata.json`; the Apps Script URL fallback in `App.tsx`; and the
  `single-file-build` workflow.
- `.github/workflows/deploy.yml` also deploys `main` to GitHub Pages,
  alongside Vercel. Probably redundant.
- Better Playground presets (13 now, in `INITIAL_PRESETS`).

## Working style
Start from the teaching goal, then shape features around it. Suggest
ideas and angles before building. Ask before big changes.
