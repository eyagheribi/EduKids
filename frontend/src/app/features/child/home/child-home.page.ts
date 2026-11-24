import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GamesGateway } from '../../../core/gateways/games.gateway';
import { ProgressGateway } from '../../../core/gateways/progress.gateway';
import { CATEGORIES, CategoryDef, CategoryId, categoryForGameType } from '../../../core/models/categories';
import { GameType } from '../../../core/models/activites.models';
import { EspacesActivite } from '../../../core/models/espaces.models';
import { SessionSummaryDto } from '../../../core/models/suivi.models';
import { ApiError, toApiError } from '../../../core/api/api-error';
import { OwlComponent } from '../../../shared/ui/brand/owl.component';
import { CategoryIconComponent } from '../../../shared/ui/category-icon/category-icon.component';
import { CharacterComponent } from '../../../shared/ui/character/character.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IllustrationComponent } from '../../../shared/ui/illustration/illustration.component';
import { ChildContext } from '../child-context';
import { ChildBadgesComponent } from './child-badges.component';
import { ChildDashboardDemoService } from './child-dashboard-demo.service';
import { ChildStarGoalComponent } from './child-star-goal.component';

const CATEGORY_KEYS: Readonly<Record<CategoryId, EspacesActivite | null>> = {
  maths: 'Maths',
  association: 'Association',
  ordonnancement: 'Ordonnancement',
  dictee: 'Dictee',
};

/** Child dashboard, personalized from the authenticated child space and existing progress gateway. */
@Component({
  selector: 'ek-child-home-page',
  imports: [
    DatePipe,
    RouterLink,
    OwlComponent,
    CategoryIconComponent,
    CharacterComponent,
    IconComponent,
    IllustrationComponent,
    ChildBadgesComponent,
    ChildStarGoalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './child-home.page.html',
  styleUrl: './child-home.page.scss',
})
export class ChildHomePage {
  protected readonly ctx = inject(ChildContext);
  private readonly games = inject(GamesGateway);
  private readonly progress = inject(ProgressGateway);
  private readonly dashboardDemo = inject(ChildDashboardDemoService);

  protected readonly recentGames = signal<readonly SessionSummaryDto[]>([]);
  protected readonly recentLoading = signal(true);
  protected readonly recentError = signal<ApiError | null>(null);
  protected readonly demoProgress = this.progress.mode === 'demo';

  protected readonly categories = computed<readonly CategoryDef[]>(() => {
    const activites = this.ctx.space()?.activites;
    if (!activites) return [];
    return CATEGORIES.filter((category) => {
      const key = CATEGORY_KEYS[category.id];
      return key !== null && activites.includes(key);
    });
  });

  protected readonly goal = computed(() => {
    const spaceId = this.ctx.spaceId();
    return spaceId ? this.dashboardDemo.rewardGoalFor(spaceId) : null;
  });
  protected readonly badges = computed(() => {
    const spaceId = this.ctx.spaceId();
    return spaceId ? this.dashboardDemo.badgesFor(spaceId) : [];
  });
  protected readonly resumableGame = computed(() =>
    this.dashboardDemo.resumableGameFor(this.ctx.spaceId()),
  );
  protected readonly canDiscoverResumableGame = this.games.mode === 'demo';

  constructor() {
    effect(() => {
      const spaceId = this.ctx.spaceId();
      if (spaceId) untracked(() => this.loadRecentGames(spaceId));
    });
  }

  protected loadRecentGames(spaceId = this.ctx.spaceId()): void {
    if (!spaceId) {
      this.recentLoading.set(false);
      return;
    }
    this.recentLoading.set(true);
    this.recentError.set(null);
    this.progress.history(spaceId, { sortOrder: 'desc', page: 1, pageSize: 3 }).subscribe({
      next: (result) => {
        this.recentGames.set(result.items);
        this.recentLoading.set(false);
      },
      error: (error: unknown) => {
        this.recentError.set(toApiError(error, 'suivi'));
        this.recentLoading.set(false);
      },
    });
  }

  protected categoryId(type: GameType): CategoryId {
    return categoryForGameType(type)?.id ?? 'maths';
  }

  protected categoryLabel(type: GameType): string {
    return categoryForGameType(type)?.label ?? 'Jeu éducatif';
  }

  protected resultLabel(session: SessionSummaryDto): string {
    if (session.finalStatus === 'SUCCESS') return 'Jeu réussi';
    if (session.finalStatus === 'FAILED') return 'À réessayer';
    return 'Jeu à terminer';
  }

  protected scoreLabel(session: SessionSummaryDto): string | null {
    if (session.finalMaxScore === null || session.finalMaxScore <= 0) return null;
    return `${session.finalScore} / ${session.finalMaxScore}`;
  }
}
