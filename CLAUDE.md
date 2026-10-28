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
- The app keeps nothing in the browser (no localStorage, cookies, etc.).
  Progress lives only in the code.
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
  `briefs.ts`, `myPresets.ts`, `adventures.ts`; `taskCatalog.ts` maps
  task IDs to challenges for grading.

## Structure
Learn, then five challenges in this order: 1. A/B Ear Training,
2. Synth Doctor, 3. My Presets, 4. Sound Design, 5. Patch Master.
(In code, Patch Master is still called "Patch Matcher".)
- No teacher-assigned tasks; tasks are split up for grading only.
- Patch Master gets its own separate grade, graded on effort.
- Synth Doctor clues cost 5 points each (`DOCTOR_CLUE_COST`).
- Test-phrase buttons everywhere: a "Test phrase" tag, then
  "Play: <phrase name>" with a Loop toggle beside it
  (`PhraseButtons.tsx`).
- Challenges start from a blank patch where it makes sense.
- Learn has 9 steps with labeled step buttons. Once finished, it is
  freely navigable and ends with "Review steps" and "Go to Challenges".
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
- Progress recovery: a "restore progress" box (paste last submission
  code), a leave-page warning when work isn't in a code yet, and a
  reminder that progress only lives in the code. Batch grading flags
  codes restored from another student's name.

## Design
- Typefaces: Barlow and Barlow Semi Condensed only. Keep the count low.
- Logo: silver panel, thin walnut side cheeks, ADSR envelope with an
  amber peak dot (Modern Synth palette), used as tab icon and header icon.
- Two synth looks: Studio Retro and Hardware Bench. The Filter EG knob
  is labeled "EG Amount" on both; it has a subtle green ring always and
  a strong pulsing ring on the Learn Filter envelope step.
- LFO rate stays in Hz.
- Touch screens must clearly separate swipe-to-scroll from
  touch-and-drag on knobs.

## Open items (check the repo first)
- Touch: knobs and sliders don't yet separate scroll from drag. A touch
  on a knob turns it and can scroll the page at the same time (no
  `touch-action` or `preventDefault` in `Knob.tsx` / `Slider.tsx`).
- The Teacher tab still has an "Assignment Link" builder
  (`AssignmentLinkBuilder.tsx`, `?assignment=&tasks=` URL params),
  which conflicts with "no teacher-assigned tasks". Decide whether to
  remove it.
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
