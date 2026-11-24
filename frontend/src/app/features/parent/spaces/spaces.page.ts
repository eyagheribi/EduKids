import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError, toApiError } from '../../../core/api/api-error';
import { EspacesActivite } from '../../../core/models/espaces.models';
import { ChildSpacesStore } from '../../../core/state/child-spaces.store';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/ui/feedback/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/feedback/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IllustrationComponent } from '../../../shared/ui/illustration/illustration.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { CategoryPickerComponent } from './category-picker.component';
import { espaceDe } from './french';
import {
  activatedCategories,
  ACTIVITES_REQUIRED_MESSAGE,
  atLeastOneActivite,
  CHILD_NAME_MAX_LENGTH,
  childNameError,
  childNameValidator,
  chipToneClass,
  sortActivites,
} from './space-form';

export type SpacesMode = 'list' | 'create';

/** Activities pre-selected in the creation form. */
const DEFAULT_ACTIVITES: readonly EspacesActivite[] = ['Maths'];

/**
 * « Mes espaces enfants » (/parent/enfants): list of the child spaces OR creation form — never both.
 * `?creer=1` opens the creation form directly; switching state keeps the query parameter in sync.
 */
@Component({
  selector: 'ek-spaces-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AvatarComponent,
    CategoryPickerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    IllustrationComponent,
    PageHeaderComponent,
  ],
  templateUrl: './spaces.page.html',
  styleUrl: './spaces.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpacesPage {
  /** Query parameter `?creer=1` (bound by the router). */
  readonly creer = input<string | null | undefined>(undefined);

  protected readonly store = inject(ChildSpacesStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly mode = signal<SpacesMode>('list');
  protected readonly pending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly submitError = signal<ApiError | null>(null);

  protected readonly nameMax = CHILD_NAME_MAX_LENGTH;
  protected readonly activitesMessage = ACTIVITES_REQUIRED_MESSAGE;

  protected readonly spaces = computed(() => this.store.spaces());
  protected readonly rows = computed(() =>
    (this.spaces() ?? []).map((space) => ({
      space,
      label: espaceDe(space.nomEnfant),
      categories: activatedCategories(space.activites).map((category) => ({
        id: category.id,
        label: category.label,
        chip: `ek-chip ek-chip--sm ${chipToneClass(category.tone)}`,
      })),
    })),
  );

  readonly form = this.fb.group({
    nomEnfant: this.fb.control('', [childNameValidator]),
    activites: this.fb.control<EspacesActivite[]>([...DEFAULT_ACTIVITES], [atLeastOneActivite]),
  });

  private readonly listTitle = viewChild<ElementRef<HTMLElement>>('listTitle');
  private readonly createTitle = viewChild<ElementRef<HTMLElement>>('createTitle');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    // The URL drives the state (direct link, browser back/forward).
    effect(() => {
      const wanted: SpacesMode = this.creer() === '1' ? 'create' : 'list';
      untracked(() => this.applyMode(wanted, false));
    });
    this.reload(false);
  }

  protected reload(force: boolean): void {
    // Errors are exposed by the store (error()).
    this.store.load(force).subscribe({ error: () => undefined });
  }

  /** Opens the creation form (« Créer un espace enfant »). */
  openCreate(): void {
    this.applyMode('create', true);
    this.syncUrl('create');
  }

  /** Back to the list (« Retour à la liste », « Annuler »). */
  showList(): void {
    if (this.pending()) return;
    this.applyMode('list', true);
    this.syncUrl('list');
  }

  protected nameError(): string | null {
    const control = this.form.controls.nomEnfant;
    return control.touched || this.submitted() ? childNameError(control) : null;
  }

  protected activitesError(): boolean {
    const control = this.form.controls.activites;
    return (control.touched || this.submitted()) && control.invalid;
  }

  submit(): void {
    if (this.pending()) return;
    this.submitted.set(true);
    this.submitError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.nomEnfant.invalid) this.nameInput()?.nativeElement.focus();
      return;
    }
    const { nomEnfant, activites } = this.form.getRawValue();
    this.pending.set(true);
    this.store.create({ nomEnfant: nomEnfant.trim(), activites: sortActivites(activites) }).subscribe({
      next: (created) => {
        this.pending.set(false);
        void this.router.navigate(['/parent/enfants', created.id, 'cree']);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.submitError.set(toApiError(error, 'espaces'));
      },
    });
  }

  private applyMode(mode: SpacesMode, moveFocus: boolean): void {
    if (this.mode() === mode) return;
    if (mode === 'create') this.resetForm();
    this.mode.set(mode);
    if (moveFocus) {
      afterNextRender(
        () => {
          const target = mode === 'create' ? this.createTitle() : this.listTitle();
          target?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    }
  }

  private resetForm(): void {
    this.form.reset({ nomEnfant: '', activites: [...DEFAULT_ACTIVITES] });
    this.submitted.set(false);
    this.submitError.set(null);
  }

  private syncUrl(mode: SpacesMode): void {
    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { creer: mode === 'create' ? 1 : null },
        queryParamsHandling: 'merge',
        replaceUrl: mode === 'list',
      })
      .catch(() => undefined);
  }
}
