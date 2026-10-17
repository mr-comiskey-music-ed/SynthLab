import { SynthParams } from '../types';

/**
 * Quest 5: My Presets. Five slots where students build presets of their own:
 * two remixes of the Playground presets, two guided "adventures" from scratch,
 * and one original. Like the briefs, these are graded by the teacher's ear.
 */
export type MyPresetKind = 'remix' | 'adventure' | 'original';

export interface MyPresetSlot {
  id: string;
  kind: MyPresetKind;
  title: string;
  blurb: string;
}

export const MY_PRESET_SLOTS: MyPresetSlot[] = [
  { id: 'my-remix-1', kind: 'remix', title: 'Remix 1', blurb: 'Take a preset and make it yours: at least 3 big changes.' },
  { id: 'my-remix-2', kind: 'remix', title: 'Remix 2', blurb: 'Remix a different preset: at least 3 big changes.' },
  { id: 'my-adv-1', kind: 'adventure', title: 'Adventure 1', blurb: 'Pick a sound type and build it from scratch, step by step.' },
  { id: 'my-adv-2', kind: 'adventure', title: 'Adventure 2', blurb: 'Pick a different sound type and build it from scratch.' },
  { id: 'my-original', kind: 'original', title: 'Original', blurb: 'All yours, from a blank patch. Make something nobody asked for.' },
];

export const REMIX_MIN_CHANGES = 3;
export const ORIGINAL_MIN_CHANGES = 5;
export const PRESET_NAME_MAX = 32;

const BY_ID = new Map(MY_PRESET_SLOTS.map((s) => [s.id, s]));
export const myPresetSlot = (id: string) => BY_ID.get(id);

/** Blank starting patch for adventures and originals: one saw, filter open, nothing moving. */
export function blankPatch(base: SynthParams): SynthParams {
  return { ...base };
}
