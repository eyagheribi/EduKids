import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { requestContext } from '../auth/auth-context';
import { ProgressGateway } from '../gateways/progress.gateway';
import {
  GameTypeStatsDto,
  HISTORY_MAX_PAGE_SIZE,
  HistoryQuery,
  PagedResult,
  SessionDetailDto,
  SessionSummaryDto,
  SpaceSummaryDto,
} from '../models/suivi.models';

/**
 * Real HTTP adapter of Suivi.Api (src/Suivi.Api/Program.cs, /api/progress routes).
 * NOTE: Suivi.Api does not validate EduKids JWTs yet (development test header only), so this
 * adapter is ready but disabled by default (environment.integrations.progress = 'demo').
 */
@Injectable({ providedIn: 'root' })
export class SuiviHttpGateway extends ProgressGateway {
  readonly mode = 'api' as const;
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).services.suivi}/api/progress/spaces`;
  private readonly ctx = () => requestContext({ service: 'suivi', audience: 'parent' });

  private space(spaceId: string): string {
    return `${this.base}/${encodeURIComponent(spaceId)}`;
  }

  summary(spaceId: string): Observable<SpaceSummaryDto> {
    return this.http.get<SpaceSummaryDto>(`${this.space(spaceId)}/summary`, { context: this.ctx() });
  }

  history(spaceId: string, query: HistoryQuery): Observable<PagedResult<SessionSummaryDto>> {
    let params = new HttpParams();
    if (query.gameType) params = params.set('gameType', query.gameType);
    if (query.finalStatus) params = params.set('finalStatus', query.finalStatus);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.sortOrder) params = params.set('sortOrder', query.sortOrder);
    params = params.set('page', String(Math.max(1, query.page ?? 1)));
    params = params.set('pageSize', String(Math.min(HISTORY_MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20))));
    return this.http.get<PagedResult<SessionSummaryDto>>(`${this.space(spaceId)}/history`, {
      params,
      context: this.ctx(),
    });
  }

  gameHistory(spaceId: string, gameId: string): Observable<SessionSummaryDto[]> {
    return this.http.get<SessionSummaryDto[]>(
      `${this.space(spaceId)}/games/${encodeURIComponent(gameId)}/history`,
      { context: this.ctx() },
    );
  }

  sessionDetail(spaceId: string, sessionId: string): Observable<SessionDetailDto> {
    return this.http.get<SessionDetailDto>(`${this.space(spaceId)}/sessions/${encodeURIComponent(sessionId)}`, {
      context: this.ctx(),
    });
  }

  statsByType(spaceId: string): Observable<GameTypeStatsDto[]> {
    return this.http.get<GameTypeStatsDto[]>(`${this.space(spaceId)}/statistics/by-type`, {
      context: this.ctx(),
    });
  }
}
