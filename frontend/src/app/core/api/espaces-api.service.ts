import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { requestContext } from '../auth/auth-context';
import {
  AccesCodeResponse,
  ChildSpace,
  CreerEspaceRequest,
  EspaceCreeResponse,
  EspaceDetailResponse,
  EspaceListItemResponse,
  EspaceModifieResponse,
  ModifierEspaceRequest,
  MonEspaceResponse,
  PersonnageResponse,
  parseActivites,
} from '../models/espaces.models';

/** HTTP client of Espaces.Api (child spaces, access codes, child self-space). */
@Injectable({ providedIn: 'root' })
export class EspacesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_CONFIG).services.espaces;

  private readonly parentCtx = () =>
    requestContext({ service: 'espaces', audience: 'parent', sessionBound: true });
  private readonly childCtx = () =>
    requestContext({ service: 'espaces', audience: 'child', sessionBound: true });

  /* ───────────── Parent (role Parent) ───────────── */

  /** GET /espaces — the list has no avatar; use get() for full details. */
  list(): Observable<EspaceListItemResponse[]> {
    return this.http.get<EspaceListItemResponse[]>(`${this.base}/espaces`, { context: this.parentCtx() });
  }

  get(id: string): Observable<ChildSpace> {
    return this.http
      .get<EspaceDetailResponse>(`${this.base}/espaces/${encodeURIComponent(id)}`, { context: this.parentCtx() })
      .pipe(map(toChildSpace));
  }

  create(body: CreerEspaceRequest): Observable<EspaceCreeResponse> {
    return this.http.post<EspaceCreeResponse>(`${this.base}/espaces`, body, { context: this.parentCtx() });
  }

  update(id: string, body: ModifierEspaceRequest): Observable<EspaceModifieResponse> {
    return this.http.put<EspaceModifieResponse>(`${this.base}/espaces/${encodeURIComponent(id)}`, body, {
      context: this.parentCtx(),
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/espaces/${encodeURIComponent(id)}`, { context: this.parentCtx() });
  }

  /* ───────────── Child access ───────────── */

  /** POST /acces/code — anonymous. */
  accessByCode(code: string): Observable<AccesCodeResponse> {
    return this.http.post<AccesCodeResponse>(
      `${this.base}/acces/code`,
      { code },
      { context: requestContext({ service: 'espaces' }) },
    );
  }

  /** GET /mon-espace (role Enfant). */
  monEspace(): Observable<MonEspaceResponse> {
    return this.http.get<MonEspaceResponse>(`${this.base}/mon-espace`, { context: this.childCtx() });
  }

  /** PUT /mon-espace/personnage (role Enfant). */
  choisirPersonnage(personnage: string): Observable<PersonnageResponse> {
    return this.http.put<PersonnageResponse>(
      `${this.base}/mon-espace/personnage`,
      { personnage },
      { context: this.childCtx() },
    );
  }
}

export function toChildSpace(dto: EspaceDetailResponse): ChildSpace {
  return {
    id: dto.id,
    nomEnfant: dto.nomEnfant,
    codeAcces: dto.codeAcces,
    avatar: dto.avatar ?? '',
    personnagePrefere: dto.personnagePrefere ?? '',
    activites: parseActivites(dto.activites),
  };
}
