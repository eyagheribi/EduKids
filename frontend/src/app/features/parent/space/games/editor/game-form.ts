// Pure helpers of the parent game editor: form models, validators (mirroring the Activites.Api
// engines), request builders, caret insertion for the maths keypad and a deterministic shuffle for
// the child preview. Activites.Api remains the source of truth: these checks only guide the parent.
import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import {
  CreateGameRequest,
  GameContent,
  GameType,
  MatchingContent,
  MathContent,
  ParsedContent,
  SentenceContent,
  tokenizeSentence,
} from '../../../../../core/models/activites.models';
import { MAX_EXPRESSION_LENGTH, validateExpression } from '../../../../../shared/utils/math-expression';

export const TITLE_MAX_LENGTH = 80;
export const MIN_PAIRS = 2;
export const INITIAL_PAIRS = 3;
export const MIN_SENTENCE_TOKENS = 2;

/** Messages aligned with the backend engines (MatchingEngine, SentenceOrderingEngine). */
export const EDITOR_MESSAGES = {
  titleTooLong: `Le titre ne peut pas dépasser ${TITLE_MAX_LENGTH} caractères.`,
  expressionRequired: 'Saisissez l’expression que l’enfant devra calculer.',
  pairIncomplete: 'Chaque paire doit avoir un mot et une définition.',
  pairsDuplicate: 'Les mots et définitions doivent être uniques.',
  pairsMin: 'Un jeu d’association doit contenir au moins deux paires.',
  duplicateLeft: 'Cet élément figure déjà dans une autre paire.',
  duplicateRight: 'Cette correspondance figure déjà dans une autre paire.',
  sentenceRequired: 'Saisissez la phrase que l’enfant devra remettre dans l’ordre.',
  sentenceTooShort: 'La phrase doit contenir au moins deux éléments (mots séparés par un espace).',
} as const;

/* ───────────── Form models ───────────── */

export type PairForm = FormGroup<{ left: FormControl<string>; right: FormControl<string> }>;

export interface PairValue {
  readonly left: string;
  readonly right: string;
}

/** Required, ignoring surrounding whitespace. */
export function notBlank(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim() ? null : { blank: true };
}

export function createPairForm(left = '', right = ''): PairForm {
  return new FormGroup({
    left: new FormControl(left, { nonNullable: true, validators: [notBlank] }),
    right: new FormControl(right, { nonNullable: true, validators: [notBlank] }),
  });
}

/* ───────────── MATH ───────────── */

/** Same rules and messages as MathEngine (via the shared parser). */
export const expressionValidator: ValidatorFn = (control) => {
  const value = typeof control.value === 'string' ? control.value : '';
  if (!value.trim()) return { expression: EDITOR_MESSAGES.expressionRequired };
  const message = validateExpression(value);
  return message ? { expression: message } : null;
};

export interface MathKey {
  /** Symbol shown on the key. */
  readonly label: string;
  /** ASCII character understood by Activites.Api. */
  readonly value: string;
  /** Accessible name. */
  readonly name: string;
}

export const MATH_KEYS: readonly MathKey[] = [
  { label: '+', value: '+', name: 'Insérer plus' },
  { label: '−', value: '-', name: 'Insérer moins' },
  { label: '×', value: '*', name: 'Insérer multiplié par' },
  { label: '÷', value: '/', name: 'Insérer divisé par' },
  { label: '(', value: '(', name: 'Insérer une parenthèse ouvrante' },
  { label: ')', value: ')', name: 'Insérer une parenthèse fermante' },
  { label: ',', value: '.', name: 'Insérer une virgule décimale' },
];

export const MATH_EXAMPLES: readonly { readonly label: string; readonly value: string }[] = [
  { label: '7 + 5', value: '7 + 5' },
  { label: '3 × (4 + 2)', value: '3 * (4 + 2)' },
  { label: '20 ÷ 4 − 1', value: '20 / 4 - 1' },
];

const BINARY_OPERATORS = new Set(['+', '-', '*', '/']);

export interface Insertion {
  readonly value: string;
  /** Caret position after the inserted text. */
  readonly caret: number;
}

/**
 * Inserts a keypad character at the caret (replacing the selection). Binary operators are surrounded
 * by single spaces for readability; spaces are not doubled. Returns null when the result would
 * exceed `maxLength`.
 */
export function insertAtCaret(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  character: string,
  maxLength = MAX_EXPRESSION_LENGTH,
): Insertion | null {
  const start = clamp(selectionStart ?? value.length, 0, value.length);
  const end = clamp(selectionEnd ?? start, start, value.length);
  const before = value.slice(0, start);
  const after = value.slice(end);
  let text = character;
  if (BINARY_OPERATORS.has(character)) {
    const lead = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
    const trail = /^\s/.test(after) ? '' : ' ';
    text = `${lead}${character}${trail}`;
  }
  const next = before + text + after;
  if (next.length > maxLength) return null;
  return { value: next, caret: before.length + text.length };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* ───────────── MATCHING ───────────── */

function key(value: string): string {
  return value.trim().toLowerCase();
}

/** Indices of the rows whose (trimmed, case-insensitive, non-blank) value appears more than once. */
export function duplicateIndices(values: readonly string[]): number[] {
  const groups = new Map<string, number[]>();
  values.forEach((value, index) => {
    const k = key(value);
    if (!k) return;
    groups.set(k, [...(groups.get(k) ?? []), index]);
  });
  return [...groups.values()]
    .filter((indices) => indices.length > 1)
    .flat()
    .sort((a, b) => a - b);
}

export interface PairsErrors {
  readonly minPairs?: { readonly required: number; readonly actual: number };
  readonly duplicateLeft?: readonly number[];
  readonly duplicateRight?: readonly number[];
}

/** Collection rules of MatchingEngine: ≥ 2 pairs, unique left and unique right (case-insensitive). */
export function validatePairs(rows: readonly PairValue[]): PairsErrors | null {
  const errors: { -readonly [K in keyof PairsErrors]: PairsErrors[K] } = {};
  if (rows.length < MIN_PAIRS) errors.minPairs = { required: MIN_PAIRS, actual: rows.length };
  const left = duplicateIndices(rows.map((r) => r.left));
  const right = duplicateIndices(rows.map((r) => r.right));
  if (left.length) errors.duplicateLeft = left;
  if (right.length) errors.duplicateRight = right;
  return Object.keys(errors).length ? errors : null;
}

export const pairsValidator: ValidatorFn = (control) => {
  if (!(control instanceof FormArray)) return null;
  const rows = (control.getRawValue() as unknown[]).map((row) => ({
    left: readString(row, 'left'),
    right: readString(row, 'right'),
  }));
  const errors = validatePairs(rows);
  return errors ? { ...errors } : null;
};

function readString(row: unknown, name: 'left' | 'right'): string {
  if (row === null || typeof row !== 'object') return '';
  const value = (row as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : '';
}

export function createPairsArray(rows: readonly PairValue[] = []): FormArray<PairForm> {
  const initial = rows.length ? rows : Array.from({ length: INITIAL_PAIRS }, () => ({ left: '', right: '' }));
  return new FormArray(
    initial.map((r) => createPairForm(r.left, r.right)),
    { validators: [pairsValidator] },
  );
}

/* ───────────── SENTENCE_ORDERING ───────────── */

export const sentenceValidator: ValidatorFn = (control) => {
  const value = typeof control.value === 'string' ? control.value : '';
  if (!value.trim()) return { sentence: EDITOR_MESSAGES.sentenceRequired };
  return tokenizeSentence(value).length < MIN_SENTENCE_TOKENS ? { sentence: EDITOR_MESSAGES.sentenceTooShort } : null;
};

/* ───────────── Title ───────────── */

export function createTitleControl(value = ''): FormControl<string> {
  return new FormControl(value, { nonNullable: true, validators: [Validators.maxLength(TITLE_MAX_LENGTH)] });
}

/* ───────────── Request builders ───────────── */

export function buildMathContent(expression: string): MathContent {
  return { expression: expression.trim() };
}

/** Pair ids are omitted: Activites.Api regenerates them on every save (NormalizeContent). */
export function buildMatchingContent(rows: readonly PairValue[]): MatchingContent {
  return { pairs: rows.map((r) => ({ left: r.left.trim(), right: r.right.trim() })) };
}

/** Whitespace is collapsed: tokens stay exactly those of tokenizeSentence(). */
export function buildSentenceContent(sentence: string): SentenceContent {
  return { sentence: tokenizeSentence(sentence).join(' ') };
}

export function buildGameRequest(type: GameType, title: string, content: GameContent): CreateGameRequest {
  const trimmed = title.trim();
  return { type, title: trimmed ? trimmed : null, content };
}

/** Raw editor values for every engine (only the one of the edited type is used). */
export interface EditorValues {
  readonly title: string;
  readonly expression: string;
  readonly pairs: readonly PairValue[];
  readonly sentence: string;
}

export function buildRequestFromValues(type: GameType, values: EditorValues): CreateGameRequest {
  switch (type) {
    case 'MATH':
      return buildGameRequest(type, values.title, buildMathContent(values.expression));
    case 'MATCHING':
      return buildGameRequest(type, values.title, buildMatchingContent(values.pairs));
    case 'SENTENCE_ORDERING':
      return buildGameRequest(type, values.title, buildSentenceContent(values.sentence));
  }
}

/** Editor values to prefill from a stored game (MATCHING ids are ignored). */
export function valuesFromContent(content: ParsedContent | null): Partial<EditorValues> {
  if (!content) return {};
  switch (content.type) {
    case 'MATH':
      return { expression: content.expression };
    case 'MATCHING':
      return { pairs: content.pairs.map((p) => ({ left: p.left, right: p.right })) };
    case 'SENTENCE_ORDERING':
      return { sentence: content.sentence };
  }
}

/* ───────────── Preview helpers ───────────── */

/** Small seeded PRNG (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic shuffle for previews (same input → same order, so the preview does not jump on
 * every keystroke). The result never keeps the original order when it can differ.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const next = random(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  if (copy.length > 1 && copy.every((item, i) => item === items[i])) {
    copy.push(copy.shift() as T);
  }
  return copy;
}
