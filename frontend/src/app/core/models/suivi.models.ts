// Contracts of Suivi.Api (src/Suivi.Api/Application/ProgressService.cs). JSON is camelCase.
import { GameType } from './activites.models';

export type FinalStatus = 'SUCCESS' | 'FAILED' | 'UNFINISHED';
export const FINAL_STATUSES: readonly FinalStatus[] = ['SUCCESS', 'FAILED', 'UNFINISHED'];

/** GET /api/progress/spaces/{spaceId}/summary */
export interface SpaceSummaryDto {
  readonly spaceId: string;
  readonly totalSessions: number;
  readonly successfulSessions: number;
  readonly failedSessions: number;
  readonly unfinishedSessions: number;
  /** 0–100, rounded to 2 decimals. */
  readonly successRate: number;
  readonly averageAttemptsPerSession: number;
  /** 0–1 (FinalScore / FinalMaxScore averaged), rounded to 4 decimals. */
  readonly averageNormalizedScore: number;
}

/** History item (SessionSummaryDto). */
export interface SessionSummaryDto {
  readonly sessionId: string;
  readonly gameId: string;
  readonly gameTitle: string | null;
  readonly gameType: GameType;
  readonly finalStatus: FinalStatus;
  readonly attemptsUsed: number;
  readonly maxAttempts: number;
  readonly finalScore: number;
  /** Null for historical sessions ingested before the field existed. */
  readonly finalMaxScore: number | null;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly nextAvailableAt: string | null;
}

export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
}

/** Attempt of a session detail. `submittedAnswer` is the exact JSON sent by the child, as a string. */
export interface SuiviAttemptDto {
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly submittedAnswer: string;
  readonly correct: boolean;
  readonly score: number;
  readonly maxScore: number;
  readonly submittedAt: string;
}

/** GET /api/progress/spaces/{spaceId}/sessions/{sessionId} (404 when unknown). */
export interface SessionDetailDto extends SessionSummaryDto {
  readonly spaceId: string;
  /** JSON snapshot of the game content when the session started, as a string. */
  readonly gameContentSnapshot: string;
  readonly attempts: readonly SuiviAttemptDto[];
}

/** GET /api/progress/spaces/{spaceId}/statistics/by-type */
export interface GameTypeStatsDto {
  readonly gameType: GameType;
  readonly totalSessions: number;
  readonly successfulSessions: number;
  readonly failedSessions: number;
  readonly unfinishedSessions: number;
  readonly successRate: number;
  readonly averageNormalizedScore: number;
}

/** Query parameters of GET /api/progress/spaces/{spaceId}/history (pageSize ≤ 100). */
export interface HistoryQuery {
  readonly gameType?: GameType | null;
  readonly finalStatus?: FinalStatus | null;
  /** ISO 8601 date-time (inclusive, compared with completedAt). */
  readonly from?: string | null;
  readonly to?: string | null;
  readonly sortOrder?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
}

export const HISTORY_MAX_PAGE_SIZE = 100;

export const FINAL_STATUS_LABELS: Readonly<Record<FinalStatus, string>> = {
  SUCCESS: 'Réussie',
  FAILED: 'Échouée',
  UNFINISHED: 'Inachevée',
};

/** Parses a JSON string returned by Suivi (submittedAnswer, gameContentSnapshot). */
export function parseJsonString(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
