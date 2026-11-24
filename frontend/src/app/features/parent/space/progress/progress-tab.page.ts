import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoDataService } from '../../../../core/demo/demo-data.service';
import { ProgressGateway } from '../../../../core/gateways/progress.gateway';
import { CATEGORIES, categoryForGameType, CategoryId, CategoryTone, GAME_TYPE_LABELS } from '../../../../core/models/categories';
import {
  GameTypeStatsDto,
  HISTORY_MAX_PAGE_SIZE,
  PagedResult,
  SessionSummaryDto,
  SpaceSummaryDto,
} from '../../../../core/models/suivi.models';
import { ToastService } from '../../../../core/services/toast.service';
import { formatNumber, formatPercent } from '../../../../shared/pipes/format';
import { OwlComponent } from '../../../../shared/ui/brand/owl.component';
import { CategoryIconComponent } from '../../../../shared/ui/category-icon/category-icon.component';
import { ProgressBarComponent } from '../../../../shared/ui/data/progress-bar.component';
import { StatCardComponent } from '../../../../shared/ui/data/stat-card.component';
import { DemoBannerComponent } from '../../../../shared/ui/demo/demo-banner.component';
import { DialogService } from '../../../../shared/ui/dialog/dialog.service';
import { EmptyStateComponent } from '../../../../shared/ui/feedback/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/feedback/error-state.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { IllustrationComponent } from '../../../../shared/ui/illustration/illustration.component';
import { asyncBlock, PROGRESS_SPACE, provideProgressSpace } from './progress-state';
import { cumulativeSuccessSeries, plural, StatusTone } from './progress.utils';
import { SessionHistoryComponent } from './session-history.component';
import { SuccessRateChartComponent } from './success-rate-chart.component';

interface CategoryRow {
  readonly key: string;
  readonly categoryId: CategoryId | null;
  readonly label: string;
  readonly tone: Exclude<CategoryTone, 'yellow'> | 'yellow';
  readonly rate: number;
  readonly rateLabel: string;
  readonly meta: string;
}

interface DistributionSegment {
  readonly key: string;
  readonly label: string;
  readonly tone: StatusTone;
  readonly count: number;
  readonly share: string;
}

/** « Résultats et progrès » tab of a child space (mockup « Tableau de progrès d’Adam »). */
@Component({
  selector: 'ek-progress-tab-page',
  imports: [
    RouterLink,
    IconComponent,
    OwlComponent,
    IllustrationComponent,
    CategoryIconComponent,
    ProgressBarComponent,
    StatCardComponent,
    DemoBannerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SessionHistoryComponent,
    SuccessRateChartComponent,
  ],
  providers: [provideProgressSpace()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-tab.page.html',
  styleUrl: './progress-tab.page.scss',
})
export class ProgressTabPage {
  /** Route parameter of /parent/enfants/:spaceId (inherited by the child route). */
  readonly spaceId = input.required<string>();

  private readonly gateway = inject(ProgressGateway);
  private readonly demoData = inject(DemoDataService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly progressSpace = inject(PROGRESS_SPACE);
  protected readonly context = this.progressSpace.context;

  protected readonly demo = this.gateway.mode === 'demo';
  protected readonly trendWindow = HISTORY_MAX_PAGE_SIZE;

  protected readonly summary = asyncBlock<SpaceSummaryDto>();
  protected readonly stats = asyncBlock<GameTypeStatsDto[]>();
  protected readonly trend = asyncBlock<PagedResult<SessionSummaryDto>>();
  /** Bumped to reload the history block. */
  protected readonly refresh = signal(0);
  protected readonly demoCount = signal({ games: 0, sessions: 0 });
  protected readonly demoBusy = signal(false);

  protected readonly childName = computed(() => this.context.space()?.nomEnfant?.trim() || 'votre enfant');
  protected readonly isEmpty = computed(() => this.summary.data()?.totalSessions === 0);

  protected readonly kpis = computed(() => {
    const s = this.summary.data();
    if (!s) return null;
    return {
      total: formatNumber(s.totalSessions, 0),
      successful: formatNumber(s.successfulSessions, 0),
      rate: formatPercent(s.successRate),
      attempts: formatNumber(s.averageAttemptsPerSession, 1),
      score: formatPercent(s.averageNormalizedScore * 100),
    };
  });

  protected readonly distribution = computed<DistributionSegment[]>(() => {
    const s = this.summary.data();
    if (!s) return [];
    const total = Math.max(1, s.successfulSessions + s.failedSessions + s.unfinishedSessions);
    const segment = (key: string, label: string, tone: StatusTone, count: number): DistributionSegment => ({
      key,
      label,
      tone,
      count,
      share: formatPercent((count / total) * 100),
    });
    return [
      segment('success', 'Réussies', 'green', s.successfulSessions),
      segment('failed', 'Échouées', 'red', s.failedSessions),
      segment('unfinished', 'Inachevées', 'orange', s.unfinishedSessions),
    ];
  });

  protected readonly distributionLabel = computed(() =>
    this.distribution()
      .map((d) => `${d.label} : ${d.count} (${d.share})`)
      .join(', '),
  );

  protected readonly categoryRows = computed<CategoryRow[]>(() => {
    const order = (type: string) => {
      const index = CATEGORIES.findIndex((c) => c.gameType === type);
      return index < 0 ? CATEGORIES.length : index;
    };
    return [...(this.stats.data() ?? [])]
      .filter((s) => s.totalSessions > 0)
      .sort((a, b) => order(a.gameType) - order(b.gameType))
      .map((s) => {
        const category = categoryForGameType(s.gameType);
        return {
          key: s.gameType,
          categoryId: category?.id ?? null,
          label: category?.label ?? GAME_TYPE_LABELS[s.gameType] ?? s.gameType,
          tone: category?.tone ?? 'purple',
          rate: s.successRate,
          rateLabel: formatPercent(s.successRate),
          meta: `${plural(s.totalSessions, 'session')} · score moyen ${formatPercent(s.averageNormalizedScore * 100)}`,
        };
      });
  });

  protected readonly series = computed(() => cumulativeSuccessSeries(this.trend.data()?.items ?? []));

  protected readonly trendNote = computed(() => {
    const data = this.trend.data();
    if (!data) return '';
    return data.totalCount > data.items.length
      ? `Calculé à partir des ${data.items.length} dernières sessions.`
      : `Calculé à partir de ${data.items.length > 1 ? `toutes les sessions terminées (${data.items.length})` : 'la session terminée'}.`;
  });

  constructor() {
    effect(() => {
      const spaceId = this.spaceId();
      untracked(() => {
        if (this.progressSpace.owned && this.context.spaceId() !== spaceId) this.context.load(spaceId);
        this.loadAll(spaceId);
      });
    });
  }

  protected loadSummary(spaceId = this.spaceId()): void {
    this.summary.load(() => this.gateway.summary(spaceId));
  }

  protected loadStats(spaceId = this.spaceId()): void {
    this.stats.load(() => this.gateway.statsByType(spaceId));
  }

  /** The 100 most recent sessions, used to draw the success-rate curve. */
  protected loadTrend(spaceId = this.spaceId()): void {
    this.trend.load(() =>
      this.gateway.history(spaceId, { sortOrder: 'desc', page: 1, pageSize: HISTORY_MAX_PAGE_SIZE }),
    );
  }

  private loadAll(spaceId: string): void {
    this.loadSummary(spaceId);
    this.loadStats(spaceId);
    this.loadTrend(spaceId);
    this.refresh.update((v) => v + 1);
    if (this.demo) this.demoCount.set(this.demoData.count(spaceId));
  }

  /* ───────── Demonstration helpers (demo mode only) ───────── */

  protected generateDemo(): void {
    const space = this.context.space();
    if (!this.demo || !space || this.demoBusy()) return;
    const before = this.demoData.count(space.id).sessions;
    this.demoData.seed(space.id, space.activites);
    const added = this.demoData.count(space.id).sessions - before;
    this.loadAll(this.spaceId());
    this.toast.success(
      added > 0
        ? `Historique de démonstration généré : ${plural(added, 'session')} ajoutée${added > 1 ? 's' : ''}.`
        : 'Aucune donnée de démonstration n’a pu être générée.',
    );
  }

  protected async clearDemo(): Promise<void> {
    if (!this.demo || this.demoBusy()) return;
    this.demoBusy.set(true);
    try {
      const confirmed = await this.dialog.confirm({
        title: 'Effacer les données de démo ?',
        message: `Tous les jeux, sessions et résultats de démonstration de l’espace de ${this.childName()} seront supprimés de ce navigateur.`,
        detail: 'Aucune donnée réelle n’est concernée. Cette action est irréversible.',
        confirmLabel: 'Effacer',
        tone: 'danger',
      });
      if (!confirmed) return;
      this.demoData.clear(this.spaceId());
      this.loadAll(this.spaceId());
      this.toast.success('Les données de démonstration ont été effacées.');
    } finally {
      this.demoBusy.set(false);
    }
  }
}
