import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { Audience, requestContext } from '../auth/auth-context';
import { GamesGateway } from '../gateways/games.gateway';
import {
  AttemptDto,
  AvailabilityDto,
  CreateGameRequest,
  GameDto,
  GameType,
  SessionDto,
  SubmitAttemptRequest,
} from '../models/activites.models';

/**
 * Real HTTP adapter of Activites.Api, matching the routes of src/Activites.Api/Program.cs.
 * NOTE: Activites.Api does not validate EduKids JWTs yet (development test header only), so this
 * adapter is ready but disabled by default (environment.integrations.games = 'demo').
 */
@Injectable({ providedIn: 'root' })
export class ActivitesHttpGateway extends GamesGateway {
  readonly mode = 'api' as const;
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).services.activites}/api/spaces`;

  private ctx(as: Audience) {
    // Not session-bound: a 401 here means the service rejects EduKids tokens, not an expired session.
    return requestContext({ service: 'activites', audience: as });
  }

  private space(spaceId: string): string {
    return `${this.base}/${encodeURIComponent(spaceId)}`;
  }

  listGames(spaceId: string, type: GameType, as: Audience): Observable<GameDto[]> {
    return this.http.get<GameDto[]>(`${this.space(spaceId)}/games`, {
      params: { type },
      context: this.ctx(as),
    });
  }

  getGame(spaceId: string, gameId: string, as: Audience): Observable<GameDto> {
    return this.http.get<GameDto>(`${this.space(spaceId)}/games/${encodeURIComponent(gameId)}`, {
      context: this.ctx(as),
    });
  }

  availability(spaceId: string, gameId: string, as: Audience): Observable<AvailabilityDto> {
    return this.http.get<AvailabilityDto>(
      `${this.space(spaceId)}/games/${encodeURIComponent(gameId)}/availability`,
      { context: this.ctx(as) },
    );
  }

  createGame(spaceId: string, request: CreateGameRequest): Observable<GameDto> {
    return this.http.post<GameDto>(`${this.space(spaceId)}/games`, request, { context: this.ctx('parent') });
  }

  updateGame(spaceId: string, gameId: string, request: CreateGameRequest): Observable<GameDto> {
    return this.http.put<GameDto>(`${this.space(spaceId)}/games/${encodeURIComponent(gameId)}`, request, {
      context: this.ctx('parent'),
    });
  }

  deleteGame(spaceId: string, gameId: string): Observable<void> {
    return this.http
      .delete(`${this.space(spaceId)}/games/${encodeURIComponent(gameId)}`, { context: this.ctx('parent') })
      .pipe(map(() => undefined));
  }

  startSession(spaceId: string, gameId: string): Observable<SessionDto> {
    return this.http.post<SessionDto>(
      `${this.space(spaceId)}/games/${encodeURIComponent(gameId)}/sessions`,
      null,
      { context: this.ctx('child') },
    );
  }

  getSession(spaceId: string, sessionId: string): Observable<SessionDto> {
    return this.http.get<SessionDto>(`${this.space(spaceId)}/sessions/${encodeURIComponent(sessionId)}`, {
      context: this.ctx('child'),
    });
  }

  submitAttempt(spaceId: string, sessionId: string, request: SubmitAttemptRequest): Observable<AttemptDto> {
    return this.http.post<AttemptDto>(
      `${this.space(spaceId)}/sessions/${encodeURIComponent(sessionId)}/attempts`,
      request,
      { context: this.ctx('child') },
    );
  }
}
