import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { EspacesApiService } from '../../core/api/espaces-api.service';
import { SessionService } from '../../core/auth/session.service';
import { APP_CONFIG } from '../../core/config/app-config';
import { categoriesForSpace } from '../../core/models/categories';
import { ChildOwnSpace, parseActivites, PersonnageResponse } from '../../core/models/espaces.models';

/**
 * State of the signed-in child (GET /mon-espace). Provided by ChildShellComponent; every child
 * page injects it. The space id comes from the child JWT (`espaceId` claim) because /mon-espace
 * does not return it.
 */
@Injectable()
export class ChildContext {
  private readonly api = inject(EspacesApiService);
  private readonly session = inject(SessionService);
  readonly gamesMode = inject(APP_CONFIG).integrations.games;

  private readonly spaceState = signal<ChildOwnSpace | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | null>(null);

  readonly space = this.spaceState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Available immediately from the session, even before /mon-espace answers. */
  readonly spaceId = computed(() => this.session.child()?.spaceId ?? '');
  readonly firstName = computed(() => this.spaceState()?.nomEnfant ?? this.session.child()?.nomEnfant ?? '');
  readonly categories = computed(() => {
    const space = this.spaceState();
    return space ? categoriesForSpace(space.activites, this.gamesMode) : [];
  });

  load(force = false): void {
    if (this.spaceState() && !force) return;
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api.monEspace().subscribe({
      next: (res) => {
        this.spaceState.set({
          spaceId: this.spaceId(),
          nomEnfant: res.nomEnfant,
          avatar: res.avatar ?? '',
          personnagePrefere: res.personnagePrefere ?? '',
          activites: parseActivites(res.activites),
        });
        this.session.updateChildName(res.nomEnfant);
        this.loadingState.set(false);
      },
      error: (error: unknown) => {
        this.errorState.set(toApiError(error, 'espaces'));
        this.loadingState.set(false);
      },
    });
  }

  /** PUT /mon-espace/personnage. */
  chooseCharacter(key: string): Observable<PersonnageResponse> {
    return this.api.choisirPersonnage(key).pipe(
      tap((res) => this.spaceState.update((s) => (s ? { ...s, personnagePrefere: res.personnagePrefere } : s))),
    );
  }
}
