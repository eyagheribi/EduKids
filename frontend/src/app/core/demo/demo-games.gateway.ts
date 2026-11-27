import { inject, Injectable } from '@angular/core';
import { defer, delay, Observable, of, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { APP_CONFIG } from '../config/app-config';
import { Audience } from '../auth/auth-context';
import { GamesGateway } from '../gateways/games.gateway';
import {
  AttemptDto,
  AvailabilityDto,
  CreateGameRequest,
  GameDto,
  GameType,
  isGameType,
  SESSION_RULES,
  SessionDto,
  SubmitAttemptRequest,
} from '../models/activites.models';
import { uuid } from '../../shared/utils/ids';
import { DemoDomainError, evaluate, generatePlay, normalizeContent, publicPlay, validateContent } from './demo-engines';
import { DemoCompletedSession, DemoGame, DemoSession, DemoState, DemoStore } from './demo-store';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// ─────────────────────────────────────────────────────────────────────────────
// DEMONSTRATION ADAPTER — replaces Activites.Api while it cannot authenticate EduKids users.
// Mirrors GameService (src/Activites.Api/Program.cs): same routes semantics, rules, statuses and
// error messages. When a session ends it also records a Suivi-shaped completion, simulating the
// Activites → RabbitMQ → Suivi pipeline for DemoProgressGateway.
// Swap for ActivitesHttpGateway by setting environment.integrations.games = 'api'.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class DemoGamesGateway extends GamesGateway {
  readonly mode = 'demo' as const;
  private readonly store = inject(DemoStore);
  private readonly latency = inject(APP_CONFIG).demo.latencyMs;

  listGames(spaceId: string, type: GameType, _as: Audience): Observable<GameDto[]> {
    return this.run(() => {
      if (!isGameType(type)) throw new DemoDomainError("Type d'activité inconnu.");
      return this.store
        .read()
        .games.filter((g) => g.spaceId === spaceId && g.type === type)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(toGameDto);
    });
  }

  getGame(spaceId: string, gameId: string, _as: Audience): Observable<GameDto> {
    return this.run(() => toGameDto(this.required(spaceId, gameId)));
  }

  availability(spaceId: string, gameId: string, _as: Audience): Observable<AvailabilityDto> {
    return this.run(() => {
      this.required(spaceId, gameId);
      this.expireDue(spaceId, gameId);
      const wait = this.blocking(spaceId, gameId);
      return { available: !wait, nextAvailableAt: wait?.nextAvailableAt ?? null };
    });
  }

  createGame(spaceId: string, request: CreateGameRequest): Observable<GameDto> {
    return this.run(() => {
      const type = this.parseType(request.type);
      validateContent(type, request.content);
      const now = nowIso();
      const game: DemoGame = {
        id: uuid(),
        spaceId,
        type,
        title: request.title ?? null,
        content: normalizeContent(type, request.content),
        createdAt: now,
        updatedAt: now,
      };
      this.store.write((s) => s.games.push(game));
      return toGameDto(game);
    });
  }

  updateGame(spaceId: string, gameId: string, request: CreateGameRequest): Observable<GameDto> {
    return this.run(() => {
      const existing = this.required(spaceId, gameId);
      const type = this.parseType(request.type);
      validateContent(type, request.content);
      const updated: DemoGame = {
        ...existing,
        type,
        title: request.title ?? null,
        content: normalizeContent(type, request.content),
        updatedAt: nowIso(),
      };
      this.store.write((s) => {
        s.games = s.games.map((g) => (g.id === gameId ? updated : g));
      });
      return toGameDto(updated);
    });
  }

  deleteGame(spaceId: string, gameId: string): Observable<void> {
    return this.run(() => {
      this.required(spaceId, gameId);
      this.expireDue(spaceId, gameId); // the backend worker sweeps overdue sessions every 15 s
      const sessions = this.sessionsOf(spaceId, gameId);
      if (sessions.some((x) => x.status === 'ACTIVE')) {
        throw new DemoDomainError('Le jeu possède une session active.', 409);
      }
      // Activites.Api keeps sessions with a RESTRICT foreign key to their game: deleting a game that
      // was already played fails (the real service currently answers 500). Mirrored explicitly here.
      if (sessions.length) {
        throw new DemoDomainError(
          'Ce jeu a déjà été joué : Activites.Api refuse sa suppression pour conserver l’historique des sessions.',
          409,
        );
      }
      this.store.write((s) => {
        s.games = s.games.filter((g) => g.id !== gameId);
      });
    });
  }

  startSession(spaceId: string, gameId: string): Observable<SessionDto> {
    return this.run(() => {
      const game = this.required(spaceId, gameId);
      this.expireDue(spaceId, gameId);
      const active = this.sessionsOf(spaceId, gameId).find((x) => x.status === 'ACTIVE');
      if (active) return toSessionDto(active, true);
      const blocked = this.blocking(spaceId, gameId);
      if (blocked) throw new DemoDomainError(`Jeu indisponible jusqu'à ${blocked.nextAvailableAt}.`, 409);
      const session: DemoSession = {
        id: uuid(),
        spaceId,
        gameId,
        status: 'ACTIVE',
        createdAt: nowIso(),
        completedAt: null,
        nextAvailableAt: null,
        inactivityDeadlineAt: null,
        gameTitleSnapshot: game.title,
        gameTypeSnapshot: game.type,
        contentSnapshot: JSON.stringify(game.content),
        play: generatePlay(game.type, game.content),
        attempts: [],
        idempotency: {},
      };
      this.store.write((s) => s.sessions.push(session));
      return toSessionDto(session, true);
    });
  }

  getSession(spaceId: string, sessionId: string): Observable<SessionDto> {
    return this.run(() => {
      const session = this.findSession(spaceId, sessionId);
      const current = this.expireIfDue(session);
      return toSessionDto(current, current.status === 'ACTIVE');
    });
  }

  submitAttempt(spaceId: string, sessionId: string, request: SubmitAttemptRequest): Observable<AttemptDto> {
    return this.run(() => {
      const key = request.idempotencyKey;
      if (!key || !key.trim() || key.length > 128) throw new DemoDomainError('Un IdempotencyKey valide est requis.');
      const session = this.expireIfDue(this.findSession(spaceId, sessionId));
      const cached = session.idempotency[key];
      if (cached) return cached as AttemptDto;
      if (session.status !== 'ACTIVE') throw new DemoDomainError('Cette session est terminée.', 409);
      if (session.attempts.length >= SESSION_RULES.maxAttempts) {
        throw new DemoDomainError('Limite de tentatives atteinte.', 409);
      }
      const content = JSON.parse(session.contentSnapshot) as unknown;
      const result = evaluate(session.gameTypeSnapshot, content, request.answer, session.play);
      const now = new Date();
      const number = session.attempts.length + 1;
      const attemptId = uuid();
      const next: DemoSession = {
        ...session,
        attempts: [
          ...session.attempts,
          { attemptId, number, answer: JSON.stringify(request.answer), evaluation: result, at: now.toISOString() },
        ],
      };
      if (result.correct) {
        next.status = 'SUCCESS';
        next.completedAt = now.toISOString();
        next.nextAvailableAt = null;
        next.inactivityDeadlineAt = null;
      } else if (number === SESSION_RULES.maxAttempts) {
        next.status = 'FAILED';
        next.completedAt = now.toISOString();
        next.nextAvailableAt = new Date(now.getTime() + SESSION_RULES.failureCooldownHours * HOUR).toISOString();
        next.inactivityDeadlineAt = null;
      } else {
        next.inactivityDeadlineAt = new Date(
          now.getTime() + SESSION_RULES.inactivityTimeoutMinutes * MINUTE,
        ).toISOString();
      }
      const dto: AttemptDto = {
        id: attemptId,
        number,
        correct: result.correct,
        score: result.score,
        maxScore: result.maxScore,
        submittedAt: now.toISOString(),
        attemptsRemaining: SESSION_RULES.maxAttempts - number,
        status: next.status,
        correction: next.status === 'FAILED' ? result.correction : null,
        nextAvailableAt: next.nextAvailableAt,
      };
      next.idempotency = { ...session.idempotency, [key]: dto };
      this.store.write((s) => {
        replaceSession(s, next);
        if (next.status !== 'ACTIVE') recordCompletion(s, next);
      });
      return dto;
    });
  }

  /* ───────────── helpers ───────────── */

  /** Wraps a synchronous operation: latency + DemoDomainError → ApiError. */
  private run<T>(operation: () => T): Observable<T> {
    return defer(() => {
      try {
        return of(operation());
      } catch (error) {
        return throwError(() => toApiError(error));
      }
    }).pipe(delay(this.latency));
  }

  private parseType(type: string): GameType {
    if (!isGameType(type)) throw new DemoDomainError("Type d'activité inconnu.");
    return type;
  }

  private required(spaceId: string, gameId: string): DemoGame {
    const game = this.store.read().games.find((g) => g.id === gameId && g.spaceId === spaceId);
    if (!game) throw new DemoDomainError('Jeu introuvable.', 404);
    return game;
  }

  private findSession(spaceId: string, sessionId: string): DemoSession {
    const session = this.store.read().sessions.find((x) => x.id === sessionId);
    if (!session || session.spaceId !== spaceId) throw new DemoDomainError('Session introuvable.', 404);
    return session;
  }

  private sessionsOf(spaceId: string, gameId: string): DemoSession[] {
    return this.store.read().sessions.filter((x) => x.spaceId === spaceId && x.gameId === gameId);
  }

  private blocking(spaceId: string, gameId: string): DemoSession | undefined {
    const now = Date.now();
    return this.sessionsOf(spaceId, gameId)
      .filter(
        (x) =>
          (x.status === 'FAILED' || x.status === 'UNFINISHED') &&
          !!x.nextAvailableAt &&
          Date.parse(x.nextAvailableAt) > now,
      )
      .sort((a, b) => Date.parse(b.nextAvailableAt ?? '') - Date.parse(a.nextAvailableAt ?? ''))[0];
  }

  private expireDue(spaceId: string, gameId: string): void {
    for (const session of this.sessionsOf(spaceId, gameId)) this.expireIfDue(session);
  }

  /** ExpireIfDue: ACTIVE past its inactivity deadline → UNFINISHED + 24 h cooldown. */
  private expireIfDue(session: DemoSession): DemoSession {
    const deadline = session.inactivityDeadlineAt;
    if (session.status !== 'ACTIVE' || !deadline || Date.parse(deadline) > Date.now()) return session;
    const expired: DemoSession = {
      ...session,
      status: 'UNFINISHED',
      completedAt: deadline,
      nextAvailableAt: new Date(Date.parse(deadline) + SESSION_RULES.failureCooldownHours * HOUR).toISOString(),
      inactivityDeadlineAt: null,
    };
    this.store.write((s) => {
      replaceSession(s, expired);
      recordCompletion(s, expired);
    });
    return expired;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function replaceSession(state: DemoState, session: DemoSession): void {
  state.sessions = state.sessions.map((x) => (x.id === session.id ? session : x));
}

/** Builds the Suivi-side record (GameSessionCompleted → CompletedGameSession). */
function recordCompletion(state: DemoState, session: DemoSession): void {
  if (state.completed.some((c) => c.sessionId === session.id)) return; // idempotent by EventId
  const last = session.attempts[session.attempts.length - 1];
  if (!last || session.status === 'ACTIVE') return;
  const record: DemoCompletedSession = {
    sessionId: session.id,
    gameId: session.gameId,
    spaceId: session.spaceId,
    gameType: session.gameTypeSnapshot,
    gameTitle: session.gameTitleSnapshot,
    finalStatus: session.status,
    attemptsUsed: session.attempts.length,
    maxAttempts: SESSION_RULES.maxAttempts,
    finalScore: last.evaluation.score,
    finalMaxScore: last.evaluation.maxScore,
    startedAt: session.createdAt,
    completedAt: session.completedAt ?? nowIso(),
    nextAvailableAt: session.nextAvailableAt,
    gameContentSnapshot: session.contentSnapshot,
    attempts: session.attempts.map((a) => ({
      attemptId: a.attemptId,
      attemptNumber: a.number,
      submittedAnswer: a.answer,
      correct: a.evaluation.correct,
      score: a.evaluation.score,
      maxScore: a.evaluation.maxScore,
      submittedAt: a.at,
    })),
  };
  state.completed.push(record);
}

function toGameDto(game: DemoGame): GameDto {
  return {
    id: game.id,
    spaceId: game.spaceId,
    type: game.type,
    title: game.title,
    content: game.content,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

function toSessionDto(session: DemoSession, includeGame: boolean): SessionDto {
  return {
    id: session.id,
    gameId: session.gameId,
    spaceId: session.spaceId,
    status: session.status,
    attemptsUsed: session.attempts.length,
    maxAttempts: SESSION_RULES.maxAttempts,
    nextAvailableAt: session.nextAvailableAt,
    game: includeGame
      ? {
          gameId: session.gameId,
          type: session.gameTypeSnapshot,
          content: publicPlay(session.gameTypeSnapshot, session.play),
        }
      : null,
    inactivityDeadlineAt: session.inactivityDeadlineAt,
  };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof DemoDomainError) return new ApiError(error.message, error.status, 'activites');
  if (error instanceof ApiError) return error;
  return new ApiError(error instanceof Error ? error.message : 'Erreur de démonstration.', 500, 'activites');
}
