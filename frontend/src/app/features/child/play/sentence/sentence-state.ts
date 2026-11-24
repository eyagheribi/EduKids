// SENTENCE_ORDERING placement state (pure). The word bank keeps the shuffled order sent by the
// backend; the sentence line holds the token ids placed by the child, in order.
import { SentenceAnswer } from '../../../../core/models/activites.models';

export interface SentenceState {
  /** Token ids on the sentence line, in the order chosen by the child. */
  readonly placed: readonly string[];
}

export const EMPTY_SENTENCE: SentenceState = { placed: [] };

/** Appends a word of the bank at the end of the sentence (ignored when already placed). */
export function placeToken(state: SentenceState, id: string): SentenceState {
  return state.placed.includes(id) ? state : { placed: [...state.placed, id] };
}

/** Sends a placed word back to the bank. */
export function returnToken(state: SentenceState, id: string): SentenceState {
  return state.placed.includes(id) ? { placed: state.placed.filter((t) => t !== id) } : state;
}

/** Moves a placed word from one position to another (indexes are clamped). */
export function moveToken(state: SentenceState, from: number, to: number): SentenceState {
  const count = state.placed.length;
  if (from < 0 || from >= count) return state;
  const target = Math.max(0, Math.min(count - 1, to));
  if (target === from) return state;
  const placed = [...state.placed];
  const [token] = placed.splice(from, 1);
  if (token === undefined) return state;
  placed.splice(target, 0, token);
  return { placed };
}

/** Moves a placed word one step left (-1) or right (+1). */
export function shiftToken(state: SentenceState, id: string, step: -1 | 1): SentenceState {
  const index = state.placed.indexOf(id);
  return index < 0 ? state : moveToken(state, index, index + step);
}

/** « Recommencer »: every word goes back to the bank. */
export function resetSentence(): SentenceState {
  return EMPTY_SENTENCE;
}

/** Words still in the bank, in the initial (shuffled) order. */
export function bankTokens(state: SentenceState, tokens: readonly string[]): string[] {
  return tokens.filter((id) => !state.placed.includes(id));
}

/** « Valider » is only possible once every word is on the line. */
export function isSentenceComplete(state: SentenceState, tokens: readonly string[]): boolean {
  return tokens.length > 0 && tokens.length === state.placed.length && tokens.every((id) => state.placed.includes(id));
}

export function toSentenceAnswer(state: SentenceState): SentenceAnswer {
  return { tokens: [...state.placed] };
}
