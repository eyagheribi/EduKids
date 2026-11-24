import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { ApiError, toApiError } from '../api/api-error';
import { EspacesApiService } from '../api/espaces-api.service';
import { SessionService } from '../auth/session.service';
import {
  ChildSpace,
  CreerEspaceRequest,
  EspaceCreeResponse,
  ModifierEspaceRequest,
  parseActivites,
} from '../models/espaces.models';

/**
 * Parent-side cache of the child spaces (Espaces.Api). GET /espaces has no avatar, so each space
 * detail is fetched as well (N+1 requests — see the integration report).
 */
@Injectable({ providedIn: 'root' })
export class ChildSpacesStore {
  private readonly api = inject(EspacesApiService);
  private readonly session = inject(SessionService);
  /** Parent the cache belongs to (the cache is dropped when another parent signs in). */
  private ownerId: string | null = null;

  private readonly state = signal<readonly ChildSpace[] | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | null>(null);

  /** Null until loaded at least once. */
  readonly spaces = this.state.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loaded = computed(() => this.state() !== null);
  readonly count = computed(() => this.state()?.length ?? 0);

  /** Loads the list (cached unless `force`). Errors are exposed through `error()` and rethrown. */
  load(force = false): Observable<readonly ChildSpace[]> {
    const owner = this.session.parent()?.userId ?? null;
    if (owner !== this.ownerId) {
      this.reset();
      this.ownerId = owner;
    }
    const cached = this.state();
    if (cached && !force) return of(cached);
    this.loadingState.set(true);
    this.errorState.set(null);
    return this.api.list().pipe(
      switchMap((items) =>
        items.length
          ? forkJoin(
              items.map((item) =>
                this.api.get(item.id).pipe(
                  // A detail failure must not hide the space: fall back to the list data.
                  catchError(() =>
                    of<ChildSpace>({
                      id: item.id,
                      nomEnfant: item.nomEnfant,
                      codeAcces: item.codeAcces,
                      avatar: '',
                      personnagePrefere: '',
                      activites: parseActivites(item.typesActivites),
                    }),
                  ),
                ),
              ),
            )
          : of([] as ChildSpace[]),
      ),
      map((spaces) => [...spaces].sort((a, b) => a.nomEnfant.localeCompare(b.nomEnfant, 'fr'))),
      tap({
        next: (spaces) => {
          this.state.set(spaces);
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          this.errorState.set(toApiError(error, 'espaces'));
          this.loadingState.set(false);
        },
      }),
    );
  }

  /** Returns a space from cache or fetches it (404 → ApiError). */
  get(id: string): Observable<ChildSpace> {
    return this.api.get(id).pipe(tap((space) => this.upsert(space)));
  }

  find(id: string): ChildSpace | undefined {
    return this.state()?.find((s) => s.id === id);
  }

  create(request: CreerEspaceRequest): Observable<EspaceCreeResponse> {
    return this.api.create(request).pipe(
      tap((created) =>
        this.upsert({
          id: created.id,
          nomEnfant: created.nomEnfant,
          codeAcces: created.codeAcces,
          avatar: '',
          personnagePrefere: '',
          activites: parseActivites(created.activites),
        }),
      ),
    );
  }

  update(id: string, request: ModifierEspaceRequest): Observable<ChildSpace> {
    return this.api.update(id, request).pipe(
      // PUT returns no code/character: re-read the detail to keep the cache exact.
      switchMap(() => this.api.get(id)),
      tap((space) => this.upsert(space)),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(id).pipe(
      tap(() => this.state.update((list) => list?.filter((s) => s.id !== id) ?? null)),
      catchError((error: unknown) => throwError(() => toApiError(error, 'espaces'))),
    );
  }

  /** Clears the cache (on logout). */
  reset(): void {
    this.state.set(null);
    this.errorState.set(null);
  }

  private upsert(space: ChildSpace): void {
    this.state.update((list) => {
      if (!list) return list;
      const exists = list.some((s) => s.id === space.id);
      const next = exists ? list.map((s) => (s.id === space.id ? space : s)) : [...list, space];
      return [...next].sort((a, b) => a.nomEnfant.localeCompare(b.nomEnfant, 'fr'));
    });
  }
}
