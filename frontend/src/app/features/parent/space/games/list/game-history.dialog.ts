import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError, toApiError } from '../../../../../core/api/api-error';
import { ProgressGateway } from '../../../../../core/gateways/progress.gateway';
import { FINAL_STATUS_LABELS, FinalStatus, SessionSummaryDto } from '../../../../../core/models/suivi.models';
import { FullDatePipe, RelativeDatePipe } from '../../../../../shared/pipes/format.pipes';
import { DemoBannerComponent } from '../../../../../shared/ui/demo/demo-banner.component';
import { DialogShellComponent } from '../../../../../shared/ui/dialog/dialog-shell.component';
import { EmptyStateComponent } from '../../../../../shared/ui/feedback/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/feedback/error-state.component';
import { LoaderComponent } from '../../../../../shared/ui/feedback/loader.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { IconName } from '../../../../../shared/ui/icon/icon.data';
import { pluralize } from './game-list.utils';

export interface GameHistoryDialogData {
  readonly spaceId: string;
  readonly gameId: string;
  readonly gameTitle: string;
  readonly childName: string;
}

const STATUS_STYLE: Readonly<Record<FinalStatus, { chip: string; icon: IconName }>> = {
  SUCCESS: { chip: 'ek-chip--green', icon: 'check-circle' },
  FAILED: { chip: 'ek-chip--red', icon: 'x-circle' },
  UNFINISHED: { chip: 'ek-chip--orange', icon: 'hourglass' },
};

/** Sessions played on one game (Suivi.Api, via ProgressGateway), each linking to its detail page. */
@Component({
  selector: 'ek-game-history-dialog',
  imports: [
    RouterLink,
    DialogShellComponent,
    DemoBannerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoaderComponent,
    IconComponent,
    RelativeDatePipe,
    FullDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-history.dialog.html',
  styleUrl: './game-history.dialog.scss',
})
export class GameHistoryDialog {
  protected readonly data = inject<GameHistoryDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly progress = inject(ProgressGateway);

  protected readonly demo = this.progress.mode === 'demo';
  protected readonly sessions = signal<readonly SessionSummaryDto[] | null>(null);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly loading = computed(() => this.sessions() === null && !this.error());

  protected readonly stats = computed(() => {
    const list = this.sessions() ?? [];
    return {
      total: pluralize(list.length, 'session', 'sessions'),
      success: list.filter((s) => s.finalStatus === 'SUCCESS').length,
    };
  });

  protected readonly statusLabels = FINAL_STATUS_LABELS;
  protected readonly statusStyle = STATUS_STYLE;

  private subscription?: Subscription;

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  protected load(): void {
    this.subscription?.unsubscribe();
    this.sessions.set(null);
    this.error.set(null);
    this.subscription = this.progress.gameHistory(this.data.spaceId, this.data.gameId).subscribe({
      next: (list) =>
        this.sessions.set([...list].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))),
      error: (error: unknown) => this.error.set(toApiError(error, 'suivi')),
    });
  }

  protected sessionLink(session: SessionSummaryDto): string {
    return `/parent/enfants/${encodeURIComponent(this.data.spaceId)}/progres/sessions/${encodeURIComponent(session.sessionId)}`;
  }

  protected score(session: SessionSummaryDto): string {
    return session.finalMaxScore === null ? `${session.finalScore}` : `${session.finalScore} / ${session.finalMaxScore}`;
  }

  protected attempts(session: SessionSummaryDto): string {
    return `${pluralize(session.attemptsUsed, 'essai', 'essais')} sur ${session.maxAttempts}`;
  }
}
