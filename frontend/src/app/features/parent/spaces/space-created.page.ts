import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError, toApiError } from '../../../core/api/api-error';
import { ChildSpace } from '../../../core/models/espaces.models';
import { ToastService } from '../../../core/services/toast.service';
import { ChildSpacesStore } from '../../../core/state/child-spaces.store';
import { AccessCodeComponent } from '../../../shared/ui/access-code/access-code.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { AVATARS } from '../../../shared/ui/avatar/avatars';
import { OwlComponent } from '../../../shared/ui/brand/owl.component';
import { SparklesComponent } from '../../../shared/ui/decor/sparkles.component';
import { EmptyStateComponent } from '../../../shared/ui/feedback/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/feedback/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { deNom, lEspaceDe } from './french';
import { activatedCategories, chipToneClass } from './space-form';

interface ConfettiPiece {
  readonly left: number;
  readonly delay: number;
  readonly duration: number;
  readonly color: string;
  readonly drift: string;
  readonly spin: string;
  readonly round: boolean;
}

const CONFETTI_COLORS = ['#8b5ce6', '#55c06a', '#ffc93c', '#4f9cf5', '#f59ac1', '#a47def'];

/** Deterministic confetti burst (no randomness so the layout is stable in tests/screenshots). */
const CONFETTI: readonly ConfettiPiece[] = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 110,
  duration: 2200 + ((i * 53) % 900),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#8b5ce6',
  drift: `${((i * 29) % 80) - 40}px`,
  spin: `${360 + ((i * 47) % 360)}deg`,
  round: i % 3 === 0,
}));

/** « L’espace d’Adam est prêt ! » (/parent/enfants/:spaceId/cree) — shown right after creation. */
@Component({
  selector: 'ek-space-created-page',
  imports: [
    RouterLink,
    AccessCodeComponent,
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    OwlComponent,
    SparklesComponent,
  ],
  templateUrl: './space-created.page.html',
  styleUrl: './space-created.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceCreatedPage {
  readonly spaceId = input.required<string>();

  private readonly store = inject(ChildSpacesStore);
  private readonly toast = inject(ToastService);

  protected readonly space = signal<ChildSpace | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  /** Avatar key being saved. */
  protected readonly savingAvatar = signal<string | null>(null);

  protected readonly avatars = AVATARS;
  protected readonly confetti = CONFETTI;

  protected readonly name = computed(() => this.space()?.nomEnfant ?? '');
  protected readonly title = computed(() => `${capitalize(lEspaceDe(this.name()))} est prêt !`);
  protected readonly deName = computed(() => deNom(this.name()));
  protected readonly categories = computed(() =>
    activatedCategories(this.space()?.activites ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      chip: `ek-chip ${chipToneClass(c.tone)}`,
    })),
  );

  constructor() {
    effect((onCleanup) => {
      const id = this.spaceId();
      const sub = untracked(() => this.load(id));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected retry(): void {
    this.load(this.spaceId());
  }

  protected chooseAvatar(key: string): void {
    const space = this.space();
    if (!space || this.savingAvatar() || space.avatar === key) return;
    const previous = space;
    this.space.set({ ...space, avatar: key });
    this.savingAvatar.set(key);
    // Not cancelled on navigation: the save must reach Espaces.Api.
    this.store.update(space.id, { avatar: key }).subscribe({
      next: (updated) => {
        this.space.set(updated);
        this.savingAvatar.set(null);
        this.toast.success('Avatar enregistré !');
      },
      error: (error: unknown) => {
        this.space.set(previous);
        this.savingAvatar.set(null);
        this.toast.error(toApiError(error, 'espaces').message);
      },
    });
  }

  private load(id: string): Subscription {
    const cached = this.store.find(id);
    this.space.set(cached ?? null);
    this.loading.set(!cached);
    this.error.set(null);
    return this.store.get(id).subscribe({
      next: (space) => {
        this.space.set(space);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(toApiError(error, 'espaces'));
        this.loading.set(false);
      },
    });
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
