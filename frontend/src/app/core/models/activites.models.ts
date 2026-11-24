// Contracts of Activites.Api (src/Activites.Api/Program.cs).
// Top-level DTOs are camelCase. Nested JsonElement values (playable game, correction) are
// serialized with default System.Text.Json options and therefore keep PascalCase names:
//   MATCHING playable  → { "Left": [{ "Id", "Left" }], "Right": [{ "Id", "Left" }] }
//   SENTENCE playable  → { "Tokens": [guid…], "Words": { guid: word } }
//   MATCHING correction→ [{ "Id", "Left", "Right" }]
// The normalizers below accept both casings defensively.

export type GameType = 'MATH' | 'MATCHING' | 'SENTENCE_ORDERING' | 'DICTATION';
export const GAME_TYPES: readonly GameType[] = ['MATH', 'MATCHING', 'SENTENCE_ORDERING', 'DICTATION'];

export type SessionStatus = 'ACTIVE' | 'SUCCESS' | 'FAILED' | 'UNFINISHED';

/* ───────────── Parent-authored content (CreateGameRequest.content) ───────────── */

export interface MathContent {
  readonly expression: string;
}

export interface MatchingPair {
  /** Assigned by the API (NormalizeContent regenerates ids on every save). */
  readonly id?: string;
  readonly left: string;
  readonly right: string;
}

export interface MatchingContent {
  readonly pairs: readonly MatchingPair[];
}

export interface SentenceContent {
  readonly sentence: string;
}

export interface DictationContent {
  readonly sentence: string;
}

export type GameContent = MathContent | MatchingContent | SentenceContent | DictationContent;

/** POST/PUT /api/spaces/{spaceId}/games body. */
export interface CreateGameRequest {
  readonly type: GameType;
  readonly title: string | null;
  readonly content: GameContent;
}

/** GameDto. */
export interface GameDto {
  readonly id: string;
  readonly spaceId: string;
  readonly type: GameType;
  readonly title: string | null;
  readonly content: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/* ───────────── Sessions & attempts ───────────── */

/** PlayableGame (only present while the session is ACTIVE). */
export interface PlayableGameDto {
  readonly gameId: string;
  readonly type: GameType;
  readonly content: unknown;
}

/** SessionDto. */
export interface SessionDto {
  readonly id: string;
  readonly gameId: string;
  readonly spaceId: string;
  readonly status: SessionStatus;
  readonly attemptsUsed: number;
  readonly maxAttempts: number;
  readonly nextAvailableAt: string | null;
  readonly game: PlayableGameDto | null;
  /** Set after an incorrect answer: the session becomes UNFINISHED if nothing is submitted before. */
  readonly inactivityDeadlineAt: string | null;
}

export interface MathAnswer {
  readonly value: number;
}

export interface MatchingAnswer {
  /** left token id → right token id, one entry per pair. */
  readonly matches: Readonly<Record<string, string>>;
}

export interface SentenceAnswer {
  /** Every token id, in the order chosen by the child. */
  readonly tokens: readonly string[];
}

export interface DictationAnswer {
  readonly text: string;
}

export type GameAnswer = MathAnswer | MatchingAnswer | SentenceAnswer | DictationAnswer;

/** POST /api/spaces/{spaceId}/sessions/{sessionId}/attempts body. */
export interface SubmitAttemptRequest {
  readonly idempotencyKey: string;
  readonly answer: GameAnswer;
}

/** AttemptDto. `correction` is only filled when the session ends FAILED. */
export interface AttemptDto {
  readonly id: string;
  readonly number: number;
  readonly correct: boolean;
  readonly score: number;
  readonly maxScore: number;
  readonly submittedAt: string;
  readonly attemptsRemaining: number;
  readonly status: SessionStatus;
  readonly correction: unknown;
  readonly nextAvailableAt: string | null;
}

/** AvailabilityDto. */
export interface AvailabilityDto {
  readonly available: boolean;
  readonly nextAvailableAt: string | null;
}

/** Backend session rules (GameSessions in appsettings.json) — informative only. */
export const SESSION_RULES = {
  maxAttempts: 3,
  inactivityTimeoutMinutes: 5,
  failureCooldownHours: 24,
} as const;

/* ───────────── Normalized view models ───────────── */

export interface PlayItem {
  readonly id: string;
  readonly label: string;
}

export type Playable =
  | { readonly type: 'MATH'; readonly expression: string }
  | { readonly type: 'MATCHING'; readonly left: readonly PlayItem[]; readonly right: readonly PlayItem[] }
  | { readonly type: 'SENTENCE_ORDERING'; readonly tokens: readonly PlayItem[] }
  | { readonly type: 'DICTATION'; readonly sentence: string };

export type Correction =
  | { readonly type: 'MATH'; readonly expected: number }
  | { readonly type: 'MATCHING'; readonly pairs: readonly { readonly left: string; readonly right: string }[] }
  | { readonly type: 'SENTENCE_ORDERING'; readonly sentence: string }
  | { readonly type: 'DICTATION'; readonly sentence: string };

export type ParsedContent =
  | { readonly type: 'MATH'; readonly expression: string }
  | { readonly type: 'MATCHING'; readonly pairs: readonly MatchingPair[] }
  | { readonly type: 'SENTENCE_ORDERING'; readonly sentence: string }
  | { readonly type: 'DICTATION'; readonly sentence: string };

export function isGameType(value: unknown): value is GameType {
  return typeof value === 'string' && (GAME_TYPES as readonly string[]).includes(value);
}

/* ───────────── Normalizers ───────────── */

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

/** Reads a property case-insensitively (handles camelCase and PascalCase payloads). */
export function readProp(source: unknown, name: string): unknown {
  const obj = asObject(source);
  if (!obj) return undefined;
  if (name in obj) return obj[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) return obj[key];
  }
  return undefined;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function toPlayItems(list: unknown): PlayItem[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    id: str(readProp(item, 'id')),
    // PairView(Guid Id, string Left) is reused for the right column, hence "Left".
    label: str(readProp(item, 'left') ?? readProp(item, 'label') ?? readProp(item, 'right')),
  }));
}

/** Converts SessionDto.game into a typed playable. Returns null when the payload is unusable. */
export function toPlayable(game: PlayableGameDto | null | undefined): Playable | null {
  if (!game) return null;
  const content = game.content;
  switch (game.type) {
    case 'MATH': {
      const expression = typeof content === 'string' ? content : str(readProp(content, 'expression'));
      return expression ? { type: 'MATH', expression } : null;
    }
    case 'MATCHING': {
      const left = toPlayItems(readProp(content, 'left'));
      const right = toPlayItems(readProp(content, 'right'));
      return left.length && right.length ? { type: 'MATCHING', left, right } : null;
    }
    case 'SENTENCE_ORDERING': {
      const ids = readProp(content, 'tokens');
      const words = asObject(readProp(content, 'words')) ?? {};
      if (!Array.isArray(ids)) return null;
      return {
        type: 'SENTENCE_ORDERING',
        tokens: ids.map((id) => ({ id: str(id), label: str(words[str(id)]) })),
      };
    }
    case 'DICTATION': {
      const sentence = str(readProp(content, 'sentence'));
      return sentence ? { type: 'DICTATION', sentence } : null;
    }
    default:
      return null;
  }
}

/** Converts AttemptDto.correction (only present after FAILED). */
export function toCorrection(type: GameType, raw: unknown): Correction | null {
  if (raw === null || raw === undefined) return null;
  switch (type) {
    case 'MATH': {
      const expected = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(expected) ? { type: 'MATH', expected } : null;
    }
    case 'MATCHING':
      return Array.isArray(raw)
        ? {
            type: 'MATCHING',
            pairs: raw.map((p) => ({ left: str(readProp(p, 'left')), right: str(readProp(p, 'right')) })),
          }
        : null;
    case 'SENTENCE_ORDERING':
      return typeof raw === 'string' ? { type: 'SENTENCE_ORDERING', sentence: raw } : null;
    case 'DICTATION':
      return typeof raw === 'string' ? { type: 'DICTATION', sentence: raw } : null;
    default:
      return null;
  }
}

/** Reads GameDto.content (or a Suivi content snapshot) into a typed structure. */
export function parseGameContent(type: GameType, content: unknown): ParsedContent | null {
  let value = content;
  // Suivi snapshots are raw JSON text; GameDto.content is already parsed (object or plain string).
  if (typeof value === 'string' && /^\s*[{["]/.test(value)) {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  switch (type) {
    case 'MATH': {
      const expression = typeof value === 'string' ? value : str(readProp(value, 'expression'));
      return { type, expression };
    }
    case 'MATCHING': {
      const pairs = readProp(value, 'pairs');
      return {
        type,
        pairs: Array.isArray(pairs)
          ? pairs.map((p) => ({
              id: str(readProp(p, 'id')) || undefined,
              left: str(readProp(p, 'left')),
              right: str(readProp(p, 'right')),
            }))
          : [],
      };
    }
    case 'SENTENCE_ORDERING': {
      const sentence = typeof value === 'string' ? value : str(readProp(value, 'sentence'));
      return { type, sentence };
    }
    case 'DICTATION': {
      const sentence = typeof value === 'string' ? value : str(readProp(value, 'sentence'));
      return { type, sentence };
    }
    default:
      return null;
  }
}

/** Splits a sentence exactly like SentenceOrderingEngine (whitespace separates tokens). */
export function tokenizeSentence(sentence: string): string[] {
  const trimmed = sentence.trim();
  return trimmed ? trimmed.split(/\s+/) : [];
}
