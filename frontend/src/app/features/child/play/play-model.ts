// Screen state of the game player and the pure rules mapping backend outcomes onto screens.
// The backend (Activites.Api) is the only judge of answers: nothing here evaluates correctness, it only
// reads AttemptDto / SessionDto statuses.
import { ApiError } from '../../../core/api/api-error';
import {
  AttemptDto,
  Correction,
  GameType,
  SessionDto,
  toCorrection,
} from '../../../core/models/activites.models';

export type PlayScreen =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  /** 404: the game was deleted (or never existed). */
  | { readonly kind: 'missing' }
  /** 409 on start: 24 h cooldown after FAILED / UNFINISHED. */
  | { readonly kind: 'unavailable'; readonly nextAvailableAt: string | null }
  | { readonly kind: 'playing' }
  | {
      readonly kind: 'success';
      /** Number of the winning attempt (null when only the session is known). */
      readonly attempts: number | null;
      readonly score: number | null;
      readonly maxScore: number | null;
    }
  | {
      readonly kind: 'failed';
      readonly correction: Correction | null;
      readonly nextAvailableAt: string | null;
    }
  | { readonly kind: 'unfinished'; readonly nextAvailableAt: string | null };

export type PlayScreenKind = PlayScreen['kind'];

/** Inline feedback after an incorrect answer while the session stays ACTIVE. */
export interface AttemptFeedback {
  readonly attemptNumber: number;
  readonly attemptsRemaining: number;
  readonly score: number;
  readonly maxScore: number;
  /** Partial scores are meaningful for MATCHING / SENTENCE_ORDERING only (MATH is 0 or 1). */
  readonly showScore: boolean;
}

export type AttemptOutcome =
  | { readonly kind: 'retry'; readonly feedback: AttemptFeedback }
  | { readonly kind: 'end'; readonly screen: PlayScreen };

/** Maps the AttemptDto returned by POST …/attempts onto what the child sees next. */
export function outcomeOfAttempt(type: GameType, attempt: AttemptDto): AttemptOutcome {
  switch (attempt.status) {
    case 'SUCCESS':
      return {
        kind: 'end',
        screen: { kind: 'success', attempts: attempt.number, score: attempt.score, maxScore: attempt.maxScore },
      };
    case 'FAILED':
      return {
        kind: 'end',
        screen: {
          kind: 'failed',
          correction: toCorrection(type, attempt.correction),
          nextAvailableAt: attempt.nextAvailableAt,
        },
      };
    case 'UNFINISHED':
      return { kind: 'end', screen: { kind: 'unfinished', nextAvailableAt: attempt.nextAvailableAt } };
    case 'ACTIVE':
    default:
      return {
        kind: 'retry',
        feedback: {
          attemptNumber: attempt.number,
          attemptsRemaining: Math.max(0, attempt.attemptsRemaining),
          score: attempt.score,
          maxScore: attempt.maxScore,
          showScore: type !== 'MATH',
        },
      };
  }
}

/**
 * End screen for a session read with GET …/sessions/{id} (after a 409, a countdown reaching zero…).
 * Returns null while the session is still ACTIVE. The correction is only known from the final
 * AttemptDto, so a FAILED session read here has none.
 */
export function endScreenForSession(session: SessionDto): PlayScreen | null {
  switch (session.status) {
    case 'SUCCESS':
      return { kind: 'success', attempts: session.attemptsUsed || null, score: null, maxScore: null };
    case 'FAILED':
      return { kind: 'failed', correction: null, nextAvailableAt: session.nextAvailableAt };
    case 'UNFINISHED':
      return { kind: 'unfinished', nextAvailableAt: session.nextAvailableAt };
    default:
      return null;
  }
}

/** Remaining attempts displayed as hearts (SessionDto is the source of truth). */
export function attemptsLeft(session: Pick<SessionDto, 'maxAttempts' | 'attemptsUsed'> | null): number {
  if (!session) return 0;
  return Math.max(0, session.maxAttempts - session.attemptsUsed);
}

/**
 * « Jeu indisponible jusqu'à 2026-11-25T10:00:00.0000000+00:00. » → ISO date, used as a fallback when
 * GET …/availability cannot be read.
 */
export function unavailableUntil(message: string | null | undefined): string | null {
  if (!message) return null;
  const match = /jusqu['’]à\s+(\d{4}-\d{2}-\d{2}T[^\s]+?)\.?\s*$/.exec(message);
  if (!match?.[1]) return null;
  const time = Date.parse(match[1]);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** How a failed POST …/attempts must be handled. */
export type SubmitErrorAction =
  /** Unknown outcome (network / server error): retry with the SAME idempotency key. */
  | 'retry-same-key'
  /** 409 (session finished, attempt limit, concurrent update): read the session again. */
  | 'refresh-session'
  /** 400 and other client errors: show the backend message. */
  | 'show-message';

export function submitErrorAction(error: unknown): SubmitErrorAction {
  if (error instanceof ApiError) {
    // status 0 = unreachable, -1 = not an HTTP response: the attempt may or may not have been saved.
    if (error.status <= 0 || error.status >= 500) return 'retry-same-key';
    if (error.isConflict) return 'refresh-session';
    return 'show-message';
  }
  return 'retry-same-key';
}

/** « 1 essai » · « 2 essais ». */
export function essais(count: number): string {
  return `${count} essai${Math.abs(count) > 1 ? 's' : ''}`;
}
