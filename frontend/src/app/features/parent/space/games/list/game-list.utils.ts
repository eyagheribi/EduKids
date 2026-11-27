// View helpers of the parent game list (cards, deletion errors).
import { ApiError, errorMessage } from '../../../../../core/api/api-error';
import { IntegrationMode } from '../../../../../core/config/app-config';
import { GameDto, parseGameContent, tokenizeSentence } from '../../../../../core/models/activites.models';
import { formatRelativeDateTime } from '../../../../../shared/pipes/format';
import { displayExpression } from '../../../../../shared/utils/math-expression';

export const UNTITLED_GAME = 'Jeu sans titre';
export const PAIRS_PREVIEW_COUNT = 3;

export const DELETE_PLAYED_GAME_MESSAGE =
  'Suppression impossible : ce jeu possède probablement un historique de sessions (limitation actuelle d’Activites.Api).';

export type GameSummary =
  | { readonly type: 'MATH'; readonly expression: string }
  | {
      readonly type: 'MATCHING';
      readonly count: number;
      readonly pairs: readonly { readonly left: string; readonly right: string }[];
      readonly hidden: number;
    }
  | { readonly type: 'SENTENCE_ORDERING'; readonly sentence: string; readonly words: number }
  | { readonly type: 'DICTATION'; readonly sentence: string; readonly words: number };

export function gameTitle(game: Pick<GameDto, 'title'>): string {
  const title = game.title?.trim();
  return title ? title : UNTITLED_GAME;
}

/** Short, parent-facing summary of a game content (null when the content cannot be read). */
export function summarizeGame(game: Pick<GameDto, 'type' | 'content'>): GameSummary | null {
  const content = parseGameContent(game.type, game.content);
  if (!content) return null;
  switch (content.type) {
    case 'MATH':
      return content.expression ? { type: 'MATH', expression: displayExpression(content.expression) } : null;
    case 'MATCHING': {
      const pairs = content.pairs.map((p) => ({ left: p.left, right: p.right }));
      return {
        type: 'MATCHING',
        count: pairs.length,
        pairs: pairs.slice(0, PAIRS_PREVIEW_COUNT),
        hidden: Math.max(0, pairs.length - PAIRS_PREVIEW_COUNT),
      };
    }
    case 'SENTENCE_ORDERING':
      return content.sentence
        ? { type: 'SENTENCE_ORDERING', sentence: content.sentence, words: tokenizeSentence(content.sentence).length }
        : null;
    case 'DICTATION':
      return content.sentence
        ? { type: 'DICTATION', sentence: content.sentence, words: tokenizeSentence(content.sentence).length }
        : null;
  }
}

/** True when the game was saved again after its creation (ignores sub-second differences). */
export function wasModified(game: Pick<GameDto, 'createdAt' | 'updatedAt'>): boolean {
  const created = Date.parse(game.createdAt);
  const updated = Date.parse(game.updatedAt);
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 1000;
}

/**
 * User-facing message of a failed deletion.
 *  - 409: the backend message (active session, or demo: already played);
 *  - 500 from the real Activites.Api: a game that was already played cannot be deleted (sessions keep
 *    a RESTRICT foreign key to their game), the service answers an unhandled 500.
 */
export function deleteErrorMessage(error: unknown, mode: IntegrationMode): string {
  if (error instanceof ApiError) {
    if (error.status === 500 && mode === 'api') return DELETE_PLAYED_GAME_MESSAGE;
    return error.message;
  }
  return errorMessage(error);
}

/**
 * Date phrase following a verb: « aujourd’hui, 16:20 », « hier, 18:05 », « le 21 nov., 14:02 ».
 * Used as « Créé aujourd’hui, 16:20 ».
 */
export function relativeDatePhrase(value: string | null | undefined, now = new Date()): string {
  const text = formatRelativeDateTime(value, now);
  if (text === '—') return text;
  if (/^(Aujourd’hui|Hier|Demain)/.test(text)) return text.charAt(0).toLowerCase() + text.slice(1);
  return `le ${text}`;
}

/** French elision before a first name: « d’Adam », « de Sarah ». */
export function ofName(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(name.trim()) ? `d’${name.trim()}` : `de ${name.trim()}`;
}

/** Newest first. */
export function sortGames<T extends Pick<GameDto, 'createdAt'>>(games: readonly T[]): T[] {
  return [...games].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`;
}
