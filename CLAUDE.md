# SynthLab

## Purpose
A subtractive synthesis lab. Students learn how oscillators, filters,
envelopes and LFOs shape a sound, then use that to design sounds on
purpose. Drills are the means; the goal is students expressing
themselves with sound.

## Hard rules
- Never store student data of any kind, not even names. No backend.
- Students show work with a base64 code pasted into Google Classroom.
- The app keeps nothing in the browser. Progress lives only in the code.
- Must run well on Chromebooks and stay lightweight.
- Live at synthlab.mrcomiskey.com via Vercel. Work on a branch and
  don't push to main unless I say so.

## Structure
Learn, then five challenges in this order: Ear Training (A/B),
Synth Doctor, My Presets, Sound Design, Patch Master.
- No teacher-assigned tasks; tasks are split up for grading only.
- Patch Master gets its own separate grade, graded on effort.
- Synth Doctor clues cost 5 points each.
- Test-phrase buttons everywhere read "Play: <phrase name>" with a
  Loop toggle beside them.
- Challenges start from a blank patch where it makes sense.
- Learn is freely navigable once a student has finished it. It ends
  with a "Start Challenges" button to the first assigned challenge.

## Grading
- Student Grade Report: one box per challenge, in app order, plus
  whether Learn was completed.
- Teacher side is batch only: one paste box for a whole class (can be
  a pasted Classroom page). One compact line per student, with the
  same per-quest boxes as the student report. Ear Training and Synth
  Doctor are shown separately, not as a "Main Grade". No
  individual-code check.
- Progress recovery: a "restore progress" box (paste last submission
  code), a leave-page warning when work isn't in a code yet, and a
  reminder that progress only lives in the code.

## Design
- Typefaces: Barlow and Barlow Semi Condensed only. Keep the count low.
- Logo: silver panel, thin walnut side cheeks, ADSR envelope with an
  amber peak dot (Modern Synth palette), used as tab icon and header icon.
- Filter EG knob is labeled "EG Amount" on both synth looks.
- LFO rate stays in Hz.
- Touch screens must clearly separate swipe-to-scroll from
  touch-and-drag on knobs.

## Wanted, not confirmed done (check the repo first)
- Polyphony; a Mono voice mode with glide
- Sound Design Brief covering sound FX and music requests, with
  click-to-reveal hints (two layers when tricky) and chosen parameters
  in a dropdown in the grade report
- "Build your own presets": 2 remixes (3+ significant changes), 2
  guided from-scratch builds by sound type, 1 fully original
- More glow/pulse on the EG Amount knob in Learn step 8
- Better Playground presets

## Working style
Start from the teaching goal, then shape features around it. Suggest
ideas and angles before building. Ask before big changes.
