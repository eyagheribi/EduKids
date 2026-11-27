import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiError, toApiError } from '../../../core/api/api-error';
import { APP_CONFIG } from '../../../core/config/app-config';
import { categoriesForSpace, inactiveCategories } from '../../../core/models/categories';
import { ChildSpace, ModifierEspaceRequest } from '../../../core/models/espaces.models';
import { ChildSpacesStore } from '../../../core/state/child-spaces.store';

/**
 * State of the child space currently opened by the parent (/parent/enfants/:spaceId/…).
 * Provided by SpaceShellComponent; the « Gestion des jeux » and « Résultats et progrès » pages
 * inject it to read the space (id, name, avatar, access code, activated categories).
 */
@Injectable()
export class SpaceContext {
  private readonly store = inject(ChildSpacesStore);
  readonly gamesMode = inject(APP_CONFIG).integrations.games;
  readonly progressMode = inject(APP_CONFIG).integrations.progress;

  private readonly spaceState = signal<ChildSpace | null>(null);
  private readonly loadingState = signal(true);
  private readonly errorState = signal<ApiError | null>(null);

  readonly space = this.spaceState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly spaceId = computed(() => this.spaceState()?.id ?? '');

  /** Categories displayed in « Gestion des jeux » (see categoriesForSpace). */
  readonly categories = computed(() => {
    const space = this.spaceState();
    return space ? categoriesForSpace(space.activites, this.gamesMode) : [];
  });

  /** Categories that can still be activated through Espaces.Api. */
  readonly inactive = computed(() => {
    const space = this.spaceState();
    return space ? inactiveCategories(space.activites) : [];
  });

  /** Loads GET /espaces/{id}. Shows the cached copy immediately when available. */
  load(id: string): void {
    const cached = this.store.find(id);
    this.spaceState.set(cached ?? null);
    this.loadingState.set(!cached);
    this.errorState.set(null);
    this.store.get(id).subscribe({
      next: (space) => {
        this.spaceState.set(space);
        this.loadingState.set(false);
      },
      error: (error: unknown) => {
        this.errorState.set(toApiError(error, 'espaces'));
        this.loadingState.set(false);
      },
    });
  }

  reload(): void {
    const id = this.spaceId();
    if (id) this.load(id);
  }

  /** PUT /espaces/{id} then refreshes the context. */
  update(request: ModifierEspaceRequest): Observable<ChildSpace> {
    return this.store.update(this.spaceId(), request).pipe(tap((space) => this.spaceState.set(space)));
  }

  /** DELETE /espaces/{id}. */
  delete(): Observable<void> {
    return this.store.delete(this.spaceId());
  }
}
