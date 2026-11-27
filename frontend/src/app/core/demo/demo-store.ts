import { Injectable, signal } from '@angular/core';
import { GameType, SessionStatus } from '../models/activites.models';
import { FinalStatus } from '../models/suivi.models';

// ─────────────────────────────────────────────────────────────────────────────
// DEMONSTRATION DATA ONLY.
// Browser-local persistence used by DemoGamesGateway / DemoProgressGateway while Activites.Api and
// Suivi.Api cannot authenticate EduKids users. Nothing here is ever sent to a server.
// ─────────────────────────────────────────────────────────────────────────────

export interface DemoGame {
  id: string;
  spaceId: string;
  type: GameType;
  title: string | null;
  /** Normalized content (MATCHING pairs carry generated ids, like NormalizeContent). */
  content: unknown;
  createdAt: string;
  updatedAt: string;
  /** Created by the "generate demo data" helper rather than by the parent. */
  seeded?: boolean;
}

export interface DemoEvaluation {
  correct: boolean;
  score: number;
  maxScore: number;
  correction: unknown;
}

export interface DemoAttempt {
  attemptId: string;
  number: number;
  /** Raw JSON text of the submitted answer. */
  answer: string;
  evaluation: DemoEvaluation;
  at: string;
}

export interface DemoSession {
  id: string;
  spaceId: string;
  gameId: string;
  status: SessionStatus;
  createdAt: string;
  completedAt: string | null;
  nextAvailableAt: string | null;
  inactivityDeadlineAt: string | null;
  gameTitleSnapshot: string | null;
  gameTypeSnapshot: GameType;
  /** Raw JSON text of the content when the session started. */
  contentSnapshot: string;
  /** Internal playable state (with the expected answer, never exposed). */
  play: unknown;
  attempts: DemoAttempt[];
  idempotency: Record<string, unknown>;
}

/** Shape of Suivi.Api CompletedGameSession, filled when a demo session reaches a final status. */
export interface DemoCompletedSession {
  sessionId: string;
  gameId: string;
  spaceId: string;
  gameType: GameType;
  gameTitle: string | null;
  finalStatus: FinalStatus;
  attemptsUsed: number;
  maxAttempts: number;
  finalScore: number;
  finalMaxScore: number | null;
  startedAt: string;
  completedAt: string;
  nextAvailableAt: string | null;
  gameContentSnapshot: string;
  attempts: {
    attemptId: string;
    attemptNumber: number;
    submittedAnswer: string;
    correct: boolean;
    score: number;
    maxScore: number;
    submittedAt: string;
  }[];
  seeded?: boolean;
}

export interface DemoState {
  games: DemoGame[];
  sessions: DemoSession[];
  completed: DemoCompletedSession[];
}

const STORAGE_KEY = 'edukids.demo.v1';

function emptyState(): DemoState {
  return { games: [], sessions: [], completed: [] };
}

@Injectable({ providedIn: 'root' })
export class DemoStore {
  private state: DemoState = this.load();
  /** Incremented on every write so views can react to demo data changes. */
  readonly version = signal(0);

  read(): DemoState {
    return this.state;
  }

  /** Applies a mutation and persists it. */
  write<T>(mutate: (state: DemoState) => T): T {
    const result = mutate(this.state);
    this.persist();
    this.version.update((v) => v + 1);
    return result;
  }

  /** Removes every demo record, or only those of one space. */
  clear(spaceId?: string): void {
    this.write((s) => {
      if (!spaceId) {
        s.games = [];
        s.sessions = [];
        s.completed = [];
        return;
      }
      s.games = s.games.filter((g) => g.spaceId !== spaceId);
      s.sessions = s.sessions.filter((x) => x.spaceId !== spaceId);
      s.completed = s.completed.filter((c) => c.spaceId !== spaceId);
    });
  }

  private load(): DemoState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<DemoState>;
      return {
        games: Array.isArray(parsed.games) ? parsed.games : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      };
    } catch {
      return emptyState();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage unavailable: demo data stays in memory for this tab.
    }
  }
}
