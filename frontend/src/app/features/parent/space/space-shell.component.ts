import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toApiError } from '../../../core/api/api-error';
import { DemoDataService } from '../../../core/demo/demo-data.service';
import { ChildSpace } from '../../../core/models/espaces.models';
import { ToastService } from '../../../core/services/toast.service';
import { AccessCodeComponent } from '../../../shared/ui/access-code/access-code.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { SparklesComponent } from '../../../shared/ui/decor/sparkles.component';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { EmptyStateComponent } from '../../../shared/ui/feedback/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/feedback/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { espaceDe, lEspaceDe } from '../spaces/french';
import { SpaceContext } from './space-context';

/**
 * Child space opened by the parent (/parent/enfants/:spaceId): breadcrumb, header (avatar, name,
 * access code, edit/delete) and the two tabs « Gestion des jeux » / « Résultats et progrès ».
 * Provides SpaceContext to the tab pages rendered in the outlet.
 */
@Component({
  selector: 'ek-space-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AccessCodeComponent,
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    SparklesComponent,
  ],
  providers: [SpaceContext],
  templateUrl: './space-shell.component.html',
  styleUrl: './space-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceShellComponent {
  readonly spaceId = input.required<string>();

  protected readonly ctx = inject(SpaceContext);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly demoData = inject(DemoDataService);

  protected readonly deleting = signal(false);
  protected readonly title = computed(() => espaceDe(this.ctx.space()?.nomEnfant));
  protected readonly notFound = computed(() => this.ctx.error()?.isNotFound === true);
  protected readonly base = computed(() => ['/parent/enfants', this.spaceId()]);

  constructor() {
    effect(() => {
      const id = this.spaceId();
      untracked(() => this.ctx.load(id));
    });
  }

  protected retry(): void {
    // SpaceContext.reload() needs a loaded space: reload from the route parameter instead.
    this.ctx.load(this.spaceId());
  }

  protected openEdit(): void {
    const space = this.ctx.space();
    if (!space) return;
    const nextName = window.prompt('Nom de l’enfant', space.nomEnfant)?.trim();
    if (!nextName || nextName === space.nomEnfant) return;
    this.ctx.update({ nomEnfant: nextName }).subscribe({
      next: () => this.toast.success(`L’espace de ${nextName} a été mis à jour.`),
      error: (error: unknown) => this.toast.error(toApiError(error, 'espaces').message),
    });
  }

  protected async confirmDelete(): Promise<void> {
    const space = this.ctx.space();
    if (!space || this.deleting()) return;
    const demo = this.ctx.gamesMode === 'demo';
    const confirmed = await this.dialogs.confirm({
      title: `Supprimer ${lEspaceDe(space.nomEnfant)} ?`,
      message: `Le code d’accès ${space.codeAcces} cessera immédiatement de fonctionner : ${space.nomEnfant} ne pourra plus se connecter.`,
      detail: demo
        ? 'Cette action est définitive. Les jeux et résultats de démonstration enregistrés dans ce navigateur seront aussi effacés.'
        : 'Cette action est définitive et ne peut pas être annulée.',
      confirmLabel: 'Supprimer l’espace',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.deleting.set(true);
    this.ctx.delete().subscribe({
      next: () => {
        if (demo) this.demoData.clear(space.id);
        this.toast.success(`${capitalize(lEspaceDe(space.nomEnfant))} a été supprimé.`);
        void this.router.navigate(['/parent/enfants']);
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.toast.error(toApiError(error, 'espaces').message);
      },
    });
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
