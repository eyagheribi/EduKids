import { Observable } from 'rxjs';
import { IntegrationMode } from '../config/app-config';
import {
  GameTypeStatsDto,
  HistoryQuery,
  PagedResult,
  SessionDetailDto,
  SessionSummaryDto,
  SpaceSummaryDto,
} from '../models/suivi.models';

/**
 * Port to the parent progress tracking (Suivi.Api). Adapters: SuiviHttpGateway (mode 'api') and
 * DemoProgressGateway (mode 'demo', fed by sessions played through the demo games gateway).
 */
export abstract class ProgressGateway {
  abstract readonly mode: IntegrationMode;

  /** GET /api/progress/spaces/{spaceId}/summary */
  abstract summary(spaceId: string): Observable<SpaceSummaryDto>;
  /** GET /api/progress/spaces/{spaceId}/history */
  abstract history(spaceId: string, query: HistoryQuery): Observable<PagedResult<SessionSummaryDto>>;
  /** GET /api/progress/spaces/{spaceId}/games/{gameId}/history */
  abstract gameHistory(spaceId: string, gameId: string): Observable<SessionSummaryDto[]>;
  /** GET /api/progress/spaces/{spaceId}/sessions/{sessionId} (ApiError 404 when unknown) */
  abstract sessionDetail(spaceId: string, sessionId: string): Observable<SessionDetailDto>;
  /** GET /api/progress/spaces/{spaceId}/statistics/by-type */
  abstract statsByType(spaceId: string): Observable<GameTypeStatsDto[]>;
}
