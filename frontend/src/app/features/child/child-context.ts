import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { EspacesApiService } from '../../core/api/espaces-api.service';
import { SessionService } from '../../core/auth/session.service';
import { APP_CONFIG } from '../../core/config/app-config';
import { categoriesForSpace } from '../../core/models/categories';
import { ChildOwnSpace, parseActivites, PersonnageResponse } from '../../core/models/espaces.models';
import { DemoDataService } from '../../core/demo/demo-data.service';
import { ChildDashboardDemoService } from './home/child-dashboard-demo.service';

/**
 * State of the signed-in child (GET /mon-espace). Provided by ChildShellComponent; every child
 * page injects it. The space id comes from the child JWT (`espaceId` claim) because /mon-espace
 * does not return it.
 */
@Injectable()
export class ChildContext {
  private readonly api = inject(EspacesApiService);
  private readonly demoData = inject(DemoDataService);
  private readonly dashboardDemo = inject(ChildDashboardDemoService);
  private readonly session = inject(SessionService);
  readonly gamesMode = inject(APP_CONFIG).integrations.games;
  readonly demoMode = computed(() => this.spaceId() === 'space-demo');

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
    if (this.demoMode()) {
      const spaceId = this.spaceId();
      this.spaceState.set({
        spaceId,
        nomEnfant: this.session.child()?.nomEnfant ?? '',
        avatar: '',
        personnagePrefere: this.dashboardDemo.characterFor(spaceId),
        activites: ['Maths', 'Association', 'Dictee'],
      });
      this.loadingState.set(false);
      if (!this.demoData.count(spaceId).games) this.demoData.seed(spaceId, ['Maths', 'Association', 'Dictee']);
      return;
    }
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
    if (this.demoMode()) {
      this.dashboardDemo.saveCharacter(this.spaceId(), key);
      this.spaceState.update((s) => s ? { ...s, personnagePrefere: key } : s);
      return of({ personnagePrefere: key });
    }
    return this.api.choisirPersonnage(key).pipe(
      tap((res) => this.spaceState.update((s) => (s ? { ...s, personnagePrefere: res.personnagePrefere } : s))),
    );
  }
}
