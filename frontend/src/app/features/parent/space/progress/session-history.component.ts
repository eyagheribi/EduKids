import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProgressGateway } from '../../../../core/gateways/progress.gateway';
import { GAME_TYPES, GameType } from '../../../../core/models/activites.models';
import { CategoryId, CategoryTone, categoryForGameType, GAME_TYPE_LABELS } from '../../../../core/models/categories';
import {
  FINAL_STATUS_LABELS,
  FINAL_STATUSES,
  FinalStatus,
  PagedResult,
  SessionSummaryDto,
} from '../../../../core/models/suivi.models';
import { RelativeDatePipe } from '../../../../shared/pipes/format.pipes';
import { CategoryIconComponent } from '../../../../shared/ui/category-icon/category-icon.component';
import { EmptyStateComponent } from '../../../../shared/ui/feedback/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/feedback/error-state.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { asyncBlock } from './progress-state';
import { ScoreChipComponent } from './score-chip.component';
import {
  dateRangeError,
  DEFAULT_HISTORY_FILTERS,
  filtersToQuery,
  formatAttempts,
  formatScore,
  gameTypeTone,
  hasActiveFilters,
  HistoryFilters,
  plural,
  scoreKind,
  ScoreKind,
  SortOrder,
  statusView,
  StatusView,
} from './progress.utils';

interface HistoryRow {
  readonly session: SessionSummaryDto;
  readonly title: string;
  readonly categoryId: CategoryId | null;
  readonly categoryLabel: string;
  readonly tone: CategoryTone;
  readonly score: string;
  readonly scoreKind: ScoreKind;
  readonly attempts: string;
  readonly status: StatusView;
  readonly link: readonly string[];
  readonly ariaLabel: string;
}

/** « Historique des sessions »: filters, paginated table (cards on small screens). */
@Component({
  selector: 'ek-session-history',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IconComponent,
    CategoryIconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    RelativeDatePipe,
    ScoreChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-history.component.html',
  styleUrl: './session-history.component.scss',
})
export class SessionHistoryComponent {
  readonly spaceId = input.required<string>();
  /** Incremented by the page to force a reload (demo data generated or cleared). */
  readonly refresh = input(0);

  private readonly gateway = inject(ProgressGateway);
  private readonly router = inject(Router);
  private readonly card = viewChild<ElementRef<HTMLElement>>('top');

  protected readonly gameTypes = GAME_TYPES.map((type) => ({ value: type, label: GAME_TYPE_LABELS[type] }));
  protected readonly statuses = FINAL_STATUSES.map((status) => ({ value: status, label: FINAL_STATUS_LABELS[status] }));
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly form = inject(FormBuilder).nonNullable.group({
    gameType: ['' as GameType | ''],
    finalStatus: ['' as FinalStatus | ''],
    from: [''],
    to: [''],
    sortOrder: ['desc' as SortOrder],
  });

  protected readonly filters = signal<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  protected readonly page = signal(1);
  protected readonly history = asyncBlock<PagedResult<SessionSummaryDto>>();

  protected readonly rangeError = computed(() => dateRangeError(this.filters()));
  protected readonly filtered = computed(() => hasActiveFilters(this.filters()));

  protected readonly rows = computed<HistoryRow[]>(() =>
    (this.history.data()?.items ?? []).map((session) => this.toRow(session)),
  );

  protected readonly pageInfo = computed(() => {
    const data = this.history.data();
    if (!data) return null;
    const totalPages = Math.max(1, data.totalPages);
    return {
      page: Math.min(data.page, totalPages),
      totalPages,
      total: data.totalCount,
      label: `Page ${Math.min(data.page, totalPages)} sur ${totalPages} · ${plural(data.totalCount, 'session')}`,
    };
  });

  /** Announced to screen readers when the results change. */
  protected readonly liveMessage = computed(() => {
    if (this.rangeError()) return '';
    if (this.history.loading()) return 'Chargement de l’historique…';
    const info = this.pageInfo();
    if (!info) return '';
    return info.total
      ? `${plural(info.total, 'session')} trouvée${info.total > 1 ? 's' : ''}, page ${info.page} sur ${info.totalPages}.`
      : 'Aucune session trouvée.';
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.filters.set(this.form.getRawValue());
      this.page.set(1);
    });

    effect(() => {
      const spaceId = this.spaceId();
      const filters = this.filters();
      const page = this.page();
      this.refresh();
      if (!spaceId || dateRangeError(filters)) return;
      untracked(() => this.history.load(() => this.gateway.history(spaceId, filtersToQuery(filters, page))));
    });

    // The current page can disappear (data cleared, filters…): go back to the last existing page.
    effect(() => {
      const data = this.history.data();
      if (data && data.page > 1 && data.page > data.totalPages) {
        const target = Math.max(1, data.totalPages);
        untracked(() => this.page.set(target));
      }
    });
  }

  protected reset(): void {
    this.form.reset(DEFAULT_HISTORY_FILTERS);
  }

  protected goTo(page: number): void {
    const info = this.pageInfo();
    if (!info || page < 1 || page > info.totalPages || page === this.page()) return;
    this.page.set(page);
    const top = this.card()?.nativeElement;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /** Mouse click anywhere on a table row opens the session (the title link handles the keyboard). */
  protected openRow(event: MouseEvent, row: HistoryRow): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    void this.router.navigate(row.link);
  }

  private toRow(session: SessionSummaryDto): HistoryRow {
    const category = categoryForGameType(session.gameType);
    const title = session.gameTitle?.trim() || 'Jeu sans titre';
    const status = statusView(session.finalStatus);
    const score = formatScore(session.finalScore, session.finalMaxScore);
    return {
      session,
      title,
      categoryId: category?.id ?? null,
      categoryLabel: category?.label ?? GAME_TYPE_LABELS[session.gameType] ?? session.gameType,
      tone: gameTypeTone(session.gameType),
      score,
      scoreKind: scoreKind(session),
      attempts: formatAttempts(session.attemptsUsed, session.maxAttempts),
      status,
      link: ['/parent/enfants', this.spaceId(), 'progres', 'sessions', session.sessionId],
      ariaLabel: `${title} — ${status.label}, score ${score}`,
    };
  }
}
