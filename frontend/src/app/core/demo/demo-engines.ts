// DEMONSTRATION ONLY — browser port of the Activites.Api game engines (MathEngine, MatchingEngine,
// SentenceOrderingEngine) so the demo behaves like the real service. Messages are copied verbatim.
import { GameType, readProp, tokenizeSentence } from '../models/activites.models';
import { evaluateExpression, ExpressionError } from '../../shared/utils/math-expression';
import { uuid } from '../../shared/utils/ids';
import { DemoEvaluation } from './demo-store';

export class DemoDomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

interface PairRow {
  id: string;
  left: string;
  right: string;
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/* ───────────── MATH ───────────── */

function mathExpression(content: unknown): string {
  if (typeof content === 'string') return content;
  const expression = str(readProp(content, 'expression'));
  if (expression === null) throw new DemoDomainError("Le contenu MATH doit contenir 'expression'.");
  return expression;
}

function parseMath(expression: string): number {
  try {
    return evaluateExpression(expression);
  } catch (error) {
    throw new DemoDomainError(error instanceof ExpressionError ? error.message : 'Expression invalide.');
  }
}

/* ───────────── MATCHING ───────────── */

function pairs(content: unknown): PairRow[] {
  const list = readProp(content, 'pairs');
  if (!Array.isArray(list) || list.length < 2) {
    throw new DemoDomainError('Un jeu MATCHING doit contenir au moins deux paires.');
  }
  const rows = list.map((item) => {
    const left = str(readProp(item, 'left'))?.trim() ?? '';
    const right = str(readProp(item, 'right'))?.trim() ?? '';
    const id = str(readProp(item, 'id')) ?? uuid();
    if (!left || !right) throw new DemoDomainError('Chaque paire doit avoir un mot et une définition.');
    return { id, left, right };
  });
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (
    !unique(rows.map((r) => r.id)) ||
    !unique(rows.map((r) => r.left.toLowerCase())) ||
    !unique(rows.map((r) => r.right.toLowerCase()))
  ) {
    throw new DemoDomainError('Les identifiants, mots et définitions doivent être uniques.');
  }
  return rows;
}

/* ───────────── SENTENCE_ORDERING ───────────── */

function sentenceTokens(content: unknown): string[] {
  const text = typeof content === 'string' ? content : str(readProp(content, 'sentence'));
  if (!text || !text.trim()) {
    throw new DemoDomainError("Le contenu SENTENCE_ORDERING doit contenir 'sentence'.");
  }
  const tokens = tokenizeSentence(text);
  if (tokens.length < 2) throw new DemoDomainError('La phrase doit contenir au moins deux éléments.');
  return tokens;
}

function dictationSentence(content: unknown): string {
  const sentence = str(readProp(content, 'sentence'))?.trim();
  if (!sentence || sentence.split(/\s+/).length < 2 || sentence.length > 500) {
    throw new DemoDomainError('La dictée doit contenir une phrase de 2 à 500 caractères.');
  }
  return sentence;
}

function normalizeDictation(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/* ───────────── Public API ───────────── */

export function validateContent(type: GameType, content: unknown): void {
  switch (type) {
    case 'MATH':
      parseMath(mathExpression(content));
      return;
    case 'MATCHING':
      pairs(content);
      return;
    case 'SENTENCE_ORDERING':
      sentenceTokens(content);
      return;
    case 'DICTATION':
      dictationSentence(content);
      return;
  }
}

/** GameService.NormalizeContent: MATCHING pairs get fresh ids, other contents are kept as sent. */
export function normalizeContent(type: GameType, content: unknown): unknown {
  if (type !== 'MATCHING') return content;
  const list = readProp(content, 'pairs');
  return {
    pairs: (Array.isArray(list) ? list : []).map((p) => ({
      id: uuid(),
      left: str(readProp(p, 'left')),
      right: str(readProp(p, 'right')),
    })),
  };
}

/** Engine.Generate — internal playable state, including the expected answer. */
export function generatePlay(type: GameType, content: unknown): unknown {
  switch (type) {
    case 'MATH':
      return { expression: mathExpression(content) };
    case 'MATCHING': {
      const rows = pairs(content).map((p) => ({ leftId: uuid(), rightId: uuid(), left: p.left, right: p.right }));
      return {
        Left: shuffle(rows.map((r) => ({ Id: r.leftId, Left: r.left }))),
        // PairView is reused for the right column: the label property is "Left".
        Right: shuffle(rows.map((r) => ({ Id: r.rightId, Left: r.right }))),
        CorrectMatches: Object.fromEntries(rows.map((r) => [r.leftId, r.rightId])),
      };
    }
    case 'SENTENCE_ORDERING': {
      const words = sentenceTokens(content);
      const tokens = words.map(() => uuid());
      let shuffled = shuffle(tokens);
      if (shuffled.length > 1 && shuffled.every((t, i) => t === tokens[i])) {
        shuffled = [shuffled[1] as string, shuffled[0] as string, ...shuffled.slice(2)];
      }
      return {
        Tokens: shuffled,
        Words: Object.fromEntries(tokens.map((t, i) => [t, words[i]])),
        CorrectOrder: tokens,
      };
    }
    case 'DICTATION':
      return { sentence: dictationSentence(content) };
  }
}

/** GameService.SessionDtoOf — public playable without the expected answer. */
export function publicPlay(type: GameType, play: unknown): unknown {
  switch (type) {
    case 'MATCHING':
      return { Left: readProp(play, 'Left'), Right: readProp(play, 'Right') };
    case 'SENTENCE_ORDERING':
      return { Tokens: readProp(play, 'Tokens'), Words: readProp(play, 'Words') };
    default:
      return play;
  }
}

/** Engine.Evaluate. */
export function evaluate(type: GameType, content: unknown, answer: unknown, play: unknown): DemoEvaluation {
  switch (type) {
    case 'MATH': {
      const expected = parseMath(mathExpression(content));
      const value = readProp(answer, 'value');
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new DemoDomainError("La réponse doit contenir un nombre décimal nommé 'value'.");
      }
      const correct = Math.abs(expected - value) <= 0.000001;
      return { correct, score: correct ? 1 : 0, maxScore: 1, correction: expected };
    }
    case 'MATCHING': {
      const rows = pairs(content);
      const submitted = readProp(answer, 'matches');
      if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted)) {
        throw new DemoDomainError("La réponse doit contenir les associations 'matches'.");
      }
      const entries = Object.entries(submitted as Record<string, unknown>);
      if (entries.length !== rows.length) throw new DemoDomainError('Soumettez une association pour chaque paire.');
      const expected = (readProp(play, 'CorrectMatches') ?? {}) as Record<string, string>;
      const score = entries.filter(([left, right]) => expected[left] === right).length;
      return {
        correct: score === rows.length,
        score,
        maxScore: rows.length,
        correction: rows.map((r) => ({ Id: r.id, Left: r.left, Right: r.right })),
      };
    }
    case 'SENTENCE_ORDERING': {
      const words = sentenceTokens(content);
      const submitted = readProp(answer, 'tokens');
      if (!Array.isArray(submitted)) throw new DemoDomainError("La réponse doit contenir la liste 'tokens'.");
      const order = (readProp(play, 'CorrectOrder') ?? []) as string[];
      const correct = submitted.length === order.length && submitted.every((t, i) => t === order[i]);
      const score = correct ? words.length : submitted.length === words.length ? words.length - 1 : 0;
      return { correct, score, maxScore: words.length, correction: words.join(' ') };
    }
    case 'DICTATION': {
      const expected = dictationSentence(content);
      const submitted = str(readProp(answer, 'text'))?.trim();
      if (!submitted) throw new DemoDomainError('La réponse de dictée ne peut pas être vide.');
      const correct = normalizeDictation(submitted) === normalizeDictation(expected);
      return { correct, score: correct ? 1 : 0, maxScore: 1, correction: expected };
    }
  }
}
