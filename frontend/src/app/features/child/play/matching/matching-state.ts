// MATCHING pairing state machine (pure). The child taps an item of one column, then an item of the
// other column to link them. Pairs are one-to-one; tapping a linked item unlinks it. Each pair gets a
// « slot » (1, 2, 3…) that drives its number badge and color on both sides.
import { MatchingAnswer } from '../../../../core/models/activites.models';

export type MatchSide = 'left' | 'right';

export interface MatchPair {
  readonly left: string;
  readonly right: string;
  /** 1-based number shown on both items; the smallest free number is reused. */
  readonly slot: number;
}

export interface MatchSelection {
  readonly side: MatchSide;
  readonly id: string;
}

export interface MatchingState {
  readonly selected: MatchSelection | null;
  readonly pairs: readonly MatchPair[];
}

export const EMPTY_MATCHING: MatchingState = { selected: null, pairs: [] };

export function pairOf(state: MatchingState, side: MatchSide, id: string): MatchPair | undefined {
  return state.pairs.find((p) => p[side] === id);
}

function freeSlot(pairs: readonly MatchPair[]): number {
  const used = new Set(pairs.map((p) => p.slot));
  let slot = 1;
  while (used.has(slot)) slot++;
  return slot;
}

/** What a tap on an item does. */
export type MatchingTap = 'select' | 'deselect' | 'pair' | 'unpair';

export function tapEffect(state: MatchingState, side: MatchSide, id: string): MatchingTap {
  if (pairOf(state, side, id)) return 'unpair';
  const selected = state.selected;
  if (!selected) return 'select';
  if (selected.side === side) return selected.id === id ? 'deselect' : 'select';
  return 'pair';
}

/** Applies a tap (pointer, Enter or Space) on an item. */
export function tapItem(state: MatchingState, side: MatchSide, id: string): MatchingState {
  switch (tapEffect(state, side, id)) {
    case 'unpair':
      return { selected: null, pairs: state.pairs.filter((p) => p[side] !== id) };
    case 'deselect':
      return { ...state, selected: null };
    case 'select':
      return { ...state, selected: { side, id } };
    case 'pair': {
      const other = state.selected;
      if (!other) return state;
      const left = side === 'left' ? id : other.id;
      const right = side === 'right' ? id : other.id;
      // One-to-one: neither item can already be in a pair at this point (paired items unpair on tap,
      // and a paired item cannot be the selection), but stay defensive.
      const pairs = state.pairs.filter((p) => p.left !== left && p.right !== right);
      return { selected: null, pairs: [...pairs, { left, right, slot: freeSlot(pairs) }] };
    }
  }
}

/** The backend rejects incomplete answers: every left item must be linked. */
export function isMatchingComplete(state: MatchingState, leftIds: readonly string[]): boolean {
  return leftIds.length > 0 && leftIds.every((id) => !!pairOf(state, 'left', id));
}

/** { matches: { leftId: rightId } } — one entry per pair. */
export function toMatchingAnswer(state: MatchingState): MatchingAnswer {
  return { matches: Object.fromEntries(state.pairs.map((p) => [p.left, p.right])) };
}

/** Pair palette (cycled when there are more pairs than colors). */
export const PAIR_COLORS: readonly { readonly main: string; readonly soft: string; readonly ink: string }[] = [
  { main: '#8b5ce6', soft: '#f1eafe', ink: '#47228f' },
  { main: '#36a64d', soft: '#e7f7ea', ink: '#185526' },
  { main: '#2f82ea', soft: '#e6f1ff', ink: '#1c4f96' },
  { main: '#f08a24', soft: '#fff1e3', ink: '#8f4705' },
  { main: '#e0569b', soft: '#fde9f3', ink: '#8c1f57' },
  { main: '#14a3a3', soft: '#e2f6f6', ink: '#0b5f5f' },
  { main: '#d99a00', soft: '#fff6d9', ink: '#6e4e00' },
  { main: '#e5484d', soft: '#ffeced', ink: '#8f1d22' },
];

export function pairColor(slot: number): { readonly main: string; readonly soft: string; readonly ink: string } {
  const index = (((slot - 1) % PAIR_COLORS.length) + PAIR_COLORS.length) % PAIR_COLORS.length;
  return PAIR_COLORS[index] ?? { main: '#8b5ce6', soft: '#f1eafe', ink: '#47228f' };
}
