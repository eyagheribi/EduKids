import { Observable } from 'rxjs';
import { IntegrationMode } from '../config/app-config';
import { Audience } from '../auth/auth-context';
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
 * Port to the games engine (Activites.Api). Two adapters exist:
 *  - ActivitesHttpGateway: real HTTP calls (mode 'api');
 *  - DemoGamesGateway: browser-local demonstration mirroring the backend rules (mode 'demo').
 * The adapter is chosen in environment.ts (integrations.games). Components depend on this class
 * only, never on an adapter. All errors are ApiError instances.
 */
export abstract class GamesGateway {
  abstract readonly mode: IntegrationMode;

  /* Parent & child */
  /** GET /api/spaces/{spaceId}/games?type= */
  abstract listGames(spaceId: string, type: GameType, as: Audience): Observable<GameDto[]>;
  /** GET /api/spaces/{spaceId}/games/{gameId} */
  abstract getGame(spaceId: string, gameId: string, as: Audience): Observable<GameDto>;
  /** GET /api/spaces/{spaceId}/games/{gameId}/availability */
  abstract availability(spaceId: string, gameId: string, as: Audience): Observable<AvailabilityDto>;

  /* Parent */
  /** POST /api/spaces/{spaceId}/games → 201 GameDto */
  abstract createGame(spaceId: string, request: CreateGameRequest): Observable<GameDto>;
  /** PUT /api/spaces/{spaceId}/games/{gameId} */
  abstract updateGame(spaceId: string, gameId: string, request: CreateGameRequest): Observable<GameDto>;
  /** DELETE /api/spaces/{spaceId}/games/{gameId} → 204 (409 when a session is active) */
  abstract deleteGame(spaceId: string, gameId: string): Observable<void>;

  /* Child */
  /** POST /api/spaces/{spaceId}/games/{gameId}/sessions — starts or resumes (409 when unavailable). */
  abstract startSession(spaceId: string, gameId: string): Observable<SessionDto>;
  /** GET /api/spaces/{spaceId}/sessions/{sessionId} */
  abstract getSession(spaceId: string, sessionId: string): Observable<SessionDto>;
  /** POST /api/spaces/{spaceId}/sessions/{sessionId}/attempts */
  abstract submitAttempt(spaceId: string, sessionId: string, request: SubmitAttemptRequest): Observable<AttemptDto>;
}
