import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, interval, of, throwError } from 'rxjs';
import { ApiError, errorMessage, toApiError } from '../../../core/api/api-error';
import { GamesGateway } from '../../../core/gateways/games.gateway';
import { AvailabilityDto, GameDto, SessionDto, parseGameContent } from '../../../core/models/activites.models';
import { CategoryId, getCategory } from '../../../core/models/categories';
import { ChildDashboardDemoService } from '../home/child-dashboard-demo.service';
import { ChildContext } from '../child-context';
import { ChildGameSessionRegistry } from '../child-game-session-registry.service';
import { CategoryIconComponent } from '../../../shared/ui/category-icon/category-icon.component';
import { CharacterComponent } from '../../../shared/ui/character/character.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IconName } from '../../../shared/ui/icon/icon.data';
import { IllustrationComponent } from '../../../shared/ui/illustration/illustration.component';

export type CategoryGameState = 'loading' | 'available' | 'won' | 'blocked' | 'in-progress' | 'error';

export interface CategoryGameCard {
  readonly game: GameDto;
  readonly title: string;
  readonly routeTitle: string;
  readonly instruction: string;
  readonly state: CategoryGameState;
  readonly sessionId: string | null;
  readonly nextAvailableAt: string | null;
  readonly error: string | null;
}

export function resolveCategoryGameState(
  availability: AvailabilityDto,
  session: Pick<SessionDto, 'status'> | null,
): Exclude<CategoryGameState, 'loading' | 'error'> {
  if (!availability.available) return 'blocked';
  if (session?.status === 'ACTIVE') return 'in-progress';
  if (session?.status === 'SUCCESS') return 'won';
  return 'available';
}

export function formatAvailabilityCountdown(nextAvailableAt: string | null, now: number): string {
  if (!nextAvailableAt) return '';
  const timestamp = Date.parse(nextAvailableAt);
  if (!Number.isFinite(timestamp) || timestamp <= now) return '';

  const minutesLeft = Math.ceil((timestamp - now) / 60_000);
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  return hours > 0
    ? `Disponible dans ${hours} h ${String(minutes).padStart(2, '0')} min`
    : `Disponible dans ${minutes} min`;
}

@Component({
  selector: 'ek-child-category-page',
  imports: [
    RouterLink,
    CategoryIconComponent,
    CharacterComponent,
    IconComponent,
    IllustrationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="category-page" aria-label="Jeux de la catégorie">
      <nav class="breadcrumb" aria-label="Fil d’Ariane">
        <a routerLink="/enfant"><ek-icon name="gamepad" [size]="19" /> Jeux éducatifs</a>
        <ek-icon name="chevron-right" [size]="17" />
        <span>{{ category()?.label ?? 'Mes jeux' }}</span>
      </nav>

      @if (category(); as selectedCategory) {
        <header class="category-banner" [class]="'category-banner tone-' + selectedCategory.tone">
          <div class="banner-art" aria-hidden="true">
            <ek-illustration name="child-tablet" [width]="188" />
          </div>
          <div class="banner-copy">
            <h1>{{ selectedCategory.label }}</h1>
            <p>{{ selectedCategory.childDescription }}</p>
            <span class="banner-prompt">Choisis un jeu pour commencer !</span>
          </div>
          <div class="banner-decoration" aria-hidden="true">
            <span>+</span><span>×</span><span>÷</span>
          </div>
          @if (demoStars() !== null) {
            <div class="star-counter" aria-label="Étoiles gagnées en démonstration">
              <ek-icon name="star" [size]="22" />
              <span>{{ demoStars() }} étoiles</span>
              <small>démo</small>
            </div>
          }
        </header>

        @if (loading()) {
          <div class="notice loading-notice" role="status">
            <ek-icon name="loader" [size]="22" />
            <span>On cherche tes jeux…</span>
          </div>
        } @else if (listError()) {
          <section class="notice error-notice" role="alert">
            <ek-icon name="alert" [size]="25" />
            <div>
              <strong>Les jeux ne sont pas disponibles</strong>
              <p>{{ listError() }}</p>
              <button class="retry-button" type="button" (click)="load()">Réessayer</button>
            </div>
          </section>
        } @else if (!selectedCategory.gameType) {
          <section class="notice">
            <strong>Bientôt disponible</strong>
            <p>Cette activité n’a pas encore de moteur de jeu.</p>
          </section>
        } @else if (!games().length) {
          <section class="empty-state">
            <div class="empty-art">
              <ek-character key="hibou" [size]="106" />
              <span class="empty-category-icon"><ek-category-icon [category]="categoryId()" [size]="62" /></span>
            </div>
            <p class="empty-eyebrow">Prêts pour une nouvelle aventure ?</p>
            <h2>Aucun jeu pour le moment !</h2>
            <p>Demande à ton parent de te créer un jeu.</p>
            <a class="primary-button" routerLink="/enfant">
              <ek-icon name="arrow-left" [size]="19" /> Retour à mes activités
            </a>
          </section>
        } @else {
          <section class="game-list" aria-label="Jeux de cette catégorie">
            <div class="list-heading">
              <div>
                <span class="eyebrow">À toi de jouer</span>
                <h2>Choisis ton jeu</h2>
              </div>
              <span class="game-count">{{ games().length }} jeu{{ games().length > 1 ? 'x' : '' }}</span>
            </div>

            @for (card of games(); track card.game.id) {
              <article class="game-card" [class]="'game-card state-' + card.state">
                <div class="game-art" [class]="'game-art tone-' + selectedCategory.tone">
                  @switch (card.state) {
                    @case ('won') { <ek-icon name="trophy" [size]="54" /> }
                    @case ('blocked') { <ek-icon name="lock" [size]="48" /> }
                    @case ('in-progress') { <ek-icon name="play" [size]="45" /> }
                    @case ('error') { <ek-icon name="alert" [size]="44" /> }
                    @default { <ek-category-icon [category]="categoryId()" [size]="60" /> }
                  }
                </div>
                <div class="game-copy">
                  <div class="game-title-row">
                    <h3>{{ card.title }}</h3>
                    @switch (card.state) {
                      @case ('won') {
                        <span class="status-pill status-won"><ek-icon name="check" [size]="15" /> Gagné</span>
                      }
                      @case ('blocked') {
                        <span class="status-pill status-blocked"><ek-icon name="lock" [size]="14" /> Bloqué</span>
                      }
                      @case ('in-progress') {
                        <span class="status-pill status-active"><ek-icon name="play" [size]="13" /> En cours</span>
                      }
                      @case ('error') {
                        <span class="status-pill status-error">État non vérifié</span>
                      }
                    }
                  </div>
                  @if (card.state === 'won') {
                    <p class="game-description">Jeu terminé avec succès.</p>
                  } @else {
                    <p class="game-description">{{ card.instruction }}</p>
                  }
                  @if (card.state === 'blocked') {
                    <p class="availability-text">
                      {{ countdownFor(card) || (card.nextAvailableAt ? 'Disponible maintenant, vérification…' : 'Disponible plus tard.') }}
                    </p>
                  }
                  @if (card.state === 'error') {
                    <p class="error-text">{{ card.error }}</p>
                  }
                </div>
                <div class="game-action">
                  @switch (card.state) {
                    @case ('loading') {
                      <span class="action-loading" role="status"><ek-icon name="loader" [size]="19" /> Vérification…</span>
                    }
                    @case ('blocked') {
                      <button class="action-button action-disabled" type="button" disabled>
                        {{ countdownFor(card) || 'Disponible plus tard' }}
                      </button>
                    }
                    @case ('error') {
                      <button class="action-button action-retry" type="button" (click)="retryCard(card)">Réessayer</button>
                    }
                    @case ('won') {
                      <a class="action-button action-outline" [routerLink]="playRoute(card)" [state]="navigationState(card)">
                        <ek-icon name="rotate" [size]="20" /> Rejouer
                      </a>
                    }
                    @case ('in-progress') {
                      <a class="action-button action-purple" [routerLink]="playRoute(card)" [state]="navigationState(card)">
                        <ek-icon name="play" [size]="18" /> Continuer
                      </a>
                    }
                    @default {
                      <a class="action-button action-green" [routerLink]="playRoute(card)" [state]="navigationState(card)">
                        <ek-icon name="play" [size]="18" /> Jouer
                      </a>
                    }
                  }
                </div>
              </article>
            }
          </section>
        }
      } @else {
        <section class="notice error-notice" role="alert">
          <strong>Cette catégorie n’existe pas.</strong>
          <a routerLink="/enfant">Retour à mes activités</a>
        </section>
      }
    </section>
  `,
  styles: `
    :host{display:block;color:#382452;font-family:'Nunito Variable',Nunito,sans-serif}
    .category-page{width:min(100%,1120px);margin:0 auto;padding:0 0 2.5rem}
    .breadcrumb{display:flex;align-items:center;gap:.55rem;margin:0 0 1.15rem;color:#806a9d;font-size:.95rem;font-weight:800}
    .breadcrumb a{display:inline-flex;align-items:center;gap:.45rem;color:inherit;text-decoration:none}
    .breadcrumb a:hover{color:#5d3189}.breadcrumb>span:last-child{color:#3c8d3c}
    .category-banner{position:relative;display:flex;align-items:center;min-height:180px;overflow:hidden;padding:1.2rem 2rem;border-radius:26px;background:#efe4ff;isolation:isolate}
    .tone-green.category-banner{background:linear-gradient(100deg,#eee4ff 0%,#eee5ff 75%,#e9ddff 100%)}
    .tone-purple.category-banner{background:linear-gradient(100deg,#f0e5ff,#e9e1ff)}
    .tone-blue.category-banner{background:linear-gradient(100deg,#e8edff,#e8e2ff)}
    .tone-yellow.category-banner{background:linear-gradient(100deg,#fff1d2,#f4e3ff)}
    .banner-art{align-self:flex-end;flex:0 0 190px;height:165px;display:flex;align-items:flex-end;justify-content:center;margin:-.5rem 1.3rem -1.2rem -.6rem;z-index:1}
    .banner-art ek-illustration{max-height:100%}
    .banner-copy{position:relative;z-index:2;min-width:0}
    .banner-copy h1{margin:.25rem 0 0;color:#58287f;font-family:'Fredoka Variable',Fredoka,sans-serif;font-size:clamp(2rem,4vw,3rem);line-height:1.04}
    .banner-copy p{margin:.35rem 0 0;color:#72549b;font-size:clamp(1rem,2vw,1.3rem);font-weight:800}
    .banner-prompt{display:block;margin-top:.35rem;color:#806ca0;font-size:.94rem;font-weight:700}
    .banner-decoration{position:absolute;right:5%;top:12%;display:flex;gap:1.2rem;align-items:center;color:#b79be5;font-family:'Fredoka Variable',sans-serif;font-size:3.4rem;font-weight:700;transform:rotate(-8deg);opacity:.85}
    .banner-decoration span:nth-child(2){font-size:2.9rem;transform:rotate(15deg)}
    .banner-decoration span:nth-child(3){font-size:2.7rem;transform:rotate(9deg)}
    .star-counter{position:absolute;right:1.2rem;top:1rem;display:flex;align-items:center;gap:.4rem;padding:.45rem .8rem;border:1px solid #fff9;border-radius:2rem;background:#fff9;color:#603286;font-weight:900;box-shadow:0 3px 12px #50308015;z-index:3}
    .star-counter ek-icon{color:#f4b900}.star-counter small{padding:.12rem .35rem;border-radius:1rem;background:#f1e7ff;color:#876aa9;font-size:.65rem}
    .game-list{margin-top:1.45rem}
    .list-heading{display:flex;justify-content:space-between;align-items:end;margin:0 0 .85rem;padding:0 .2rem}
    .eyebrow{color:#8c73aa;text-transform:uppercase;letter-spacing:.11em;font-size:.7rem;font-weight:900}
    .list-heading h2{margin:.12rem 0 0;color:#4d2a70;font-family:'Fredoka Variable',sans-serif;font-size:1.55rem}
    .game-count{padding:.4rem .8rem;border-radius:2rem;background:#f0e8fb;color:#795a9e;font-size:.85rem;font-weight:900}
    .game-card{display:grid;grid-template-columns:112px minmax(0,1fr) minmax(190px,240px);align-items:center;gap:1.15rem;min-height:124px;margin:.7rem 0;padding:.85rem 1.15rem .85rem .95rem;border:1.5px solid #e3d8f3;border-radius:22px;background:#fff;box-shadow:0 7px 18px #3a24500d,0 2px 5px #3a24500b;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .game-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px #3a245018}
    .game-art{display:grid;place-items:center;width:104px;height:88px;border-radius:20px;background:#e8f5de;color:#7954b2}
    .game-art.tone-purple{background:#eee5ff}.game-art.tone-blue{background:#e5edff}.game-art.tone-yellow{background:#fff1cf}
    .state-won .game-art{color:#d69000}.state-blocked .game-art{background:#f0e6ff;color:#896aad}
    .state-in-progress .game-art{background:#eee5ff;color:#754eb1}
    .state-error .game-art{background:#fff0eb;color:#bd5d48}
    .game-copy{min-width:0;border-left:2px solid #e4d7f3;padding-left:1.15rem}
    .game-title-row{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap}
    .game-title-row h3{margin:0;color:#552d7c;font-family:'Fredoka Variable',sans-serif;font-size:clamp(1.25rem,2.4vw,1.75rem);line-height:1.15;overflow-wrap:anywhere}
    .game-description{margin:.35rem 0 0;color:#766787;font-size:1rem;font-weight:700}
    .status-pill{display:inline-flex;align-items:center;gap:.25rem;padding:.27rem .66rem;border-radius:2rem;font-size:.82rem;font-weight:900;white-space:nowrap}
    .status-won{background:#ddf4d5;color:#32813c}.status-blocked{background:#eee7f5;color:#77658e}
    .status-active{background:#eee5ff;color:#7149a7}.status-error{background:#ffede7;color:#a34333}
    .availability-text{margin:.25rem 0 0;color:#786894;font-size:.88rem;font-weight:800}
    .error-text{margin:.3rem 0 0;color:#a34333;font-size:.84rem;font-weight:700}
    .game-action{display:flex;justify-content:flex-end}
    .action-button{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;width:100%;min-height:54px;padding:.7rem 1rem;border:0;border-radius:2rem;text-decoration:none;font:900 1.13rem 'Fredoka Variable',sans-serif;cursor:pointer;transition:transform .16s ease,filter .16s ease}
    .action-button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.04)}
    .action-green{background:#52b83f;color:#fff;box-shadow:0 4px 0 #319b31}
    .action-purple{background:#7650ad;color:#fff;box-shadow:0 4px 0 #5c398e}
    .action-outline{border:2px solid #b894e6;background:#fff;color:#653d94}
    .action-disabled{background:#e7e7ef;color:#85839a;cursor:not-allowed;font-size:.92rem}
    .action-retry{background:#fff0eb;color:#a34333;font-size:1rem}
    .action-loading{display:inline-flex;align-items:center;gap:.45rem;color:#846a9f;font-weight:800}
    .empty-state{display:flex;flex-direction:column;align-items:center;margin-top:1.2rem;padding:2rem 1rem 2.3rem;border:1px solid #e8def3;border-radius:26px;background:linear-gradient(145deg,#fff,#fbf8ff);text-align:center;box-shadow:0 8px 24px #37234f0c}
    .empty-art{position:relative;display:flex;align-items:center;justify-content:center;width:190px;height:128px;border-radius:60px;background:#f1e9ff}
    .empty-art>ek-character{transform:translateX(-20px)}
    .empty-category-icon{position:absolute;right:8px;bottom:2px;display:grid;place-items:center;width:76px;height:76px;border:5px solid #fff;border-radius:24px;background:#e6f4dc}
    .empty-eyebrow{margin:1rem 0 0;color:#8a70aa;font-size:.78rem;text-transform:uppercase;letter-spacing:.1em;font-weight:900}
    .empty-state h2{margin:.2rem 0;color:#552d7c;font-family:'Fredoka Variable',sans-serif;font-size:clamp(1.55rem,4vw,2.1rem)}
    .empty-state>p:not(.empty-eyebrow){margin:.1rem 0 1.2rem;color:#786787;font-size:1rem;font-weight:700}
    .primary-button,.retry-button{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;padding:.75rem 1.15rem;border:0;border-radius:2rem;background:#7650ad;color:#fff;text-decoration:none;font:800 1rem 'Nunito Variable',sans-serif;cursor:pointer}
    .notice{display:flex;align-items:center;gap:.8rem;margin:1.2rem auto;padding:1.2rem 1.4rem;border:1px solid #e8def3;border-radius:20px;background:#fff;color:#655476;box-shadow:0 7px 18px #3a24500d}
    .notice p{margin:.3rem 0;color:#786787}.loading-notice{justify-content:center}
    .loading-notice ek-icon{color:#8056b1;animation:spin 1.1s linear infinite}
    .error-notice{align-items:flex-start;color:#a34333}.error-notice>div{min-width:0}
    .error-notice strong{color:#5c355f}.retry-button{margin-top:.25rem;padding:.55rem .95rem}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media(max-width:760px){
      .category-page{padding-bottom:1.5rem}.breadcrumb{font-size:.85rem}
      .category-banner{min-height:160px;padding:1rem 1.1rem;border-radius:20px}
      .banner-art{flex-basis:125px;height:130px;margin-right:.65rem;margin-left:-.5rem}
      .banner-art ek-illustration{width:128px!important}
      .banner-copy h1{font-size:2rem}.banner-copy p{font-size:1rem}.banner-prompt{font-size:.82rem}
      .banner-decoration{right:3%;top:45%;gap:.3rem;font-size:1.9rem}.banner-decoration span:nth-child(2),.banner-decoration span:nth-child(3){font-size:1.7rem}
      .star-counter{top:.55rem;right:.55rem;padding:.32rem .55rem;font-size:.78rem}.star-counter ek-icon{width:18px!important;height:18px!important}
      .game-card{grid-template-columns:76px minmax(0,1fr);gap:.8rem;min-height:unset;padding:.8rem;border-radius:18px}
      .game-art{grid-row:1/3;width:72px;height:72px;border-radius:17px}
      .game-art ek-category-icon{transform:scale(.82)}.game-art ek-icon{transform:scale(.82)}
      .game-copy{grid-column:2;border-left:0;padding:0}
      .game-title-row h3{font-size:1.3rem}.game-description{font-size:.9rem}
      .status-pill{font-size:.73rem;padding:.2rem .5rem}
      .game-action{grid-column:2;justify-content:flex-start}
      .action-button{width:min(100%,230px);min-height:46px;font-size:1rem}
      .action-disabled{font-size:.8rem}.list-heading h2{font-size:1.35rem}
    }
    @media(max-width:420px){
      .category-banner{min-height:150px;padding:.8rem}.banner-art{flex-basis:88px;height:110px;margin-right:.35rem}
      .banner-art ek-illustration{width:100px!important}.banner-copy h1{font-size:1.7rem}
      .banner-copy p{font-size:.88rem}.banner-prompt{max-width:180px;font-size:.74rem}
      .banner-decoration{display:none}.star-counter{top:.45rem;right:.4rem}
      .game-card{grid-template-columns:60px minmax(0,1fr);gap:.65rem;padding:.68rem}
      .game-art{width:58px;height:62px;border-radius:14px}
      .game-title-row h3{font-size:1.15rem}.game-description{font-size:.84rem}
      .action-button{min-height:43px}.empty-state{padding:1.4rem .85rem 1.8rem}
    }
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
  `,
})
export class ChildCategoryPage {
  protected readonly ctx = inject(ChildContext);
  private readonly route = inject(ActivatedRoute);
  private readonly gateway = inject(GamesGateway);
  private readonly registry = inject(ChildGameSessionRegistry);
  private readonly demo = inject(ChildDashboardDemoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly categoryIdState = signal(this.route.snapshot.paramMap.get('categoryId') ?? '');
  private readonly now = signal(Date.now());
  private readonly refreshingGames = new Set<string>();

  protected readonly category = computed(() => getCategory(this.categoryIdState()));
  protected readonly categoryId = computed<CategoryId>(() => this.category()?.id ?? 'maths');
  protected readonly demoStars = computed(() => {
    const spaceId = this.ctx.spaceId();
    return this.ctx.gamesMode === 'demo' && spaceId ? this.demo.rewardGoalFor(spaceId).earnedStars : null;
  });
  protected readonly games = signal<CategoryGameCard[]>([]);
  protected readonly loading = signal(true);
  protected readonly listError = signal('');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.categoryIdState.set(params.get('categoryId') ?? '');
      this.load();
    });
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateCountdowns());
  }

  protected load(): void {
    const category = this.category();
    const spaceId = this.ctx.spaceId();
    this.listError.set('');
    this.games.set([]);

    if (!category?.gameType || !spaceId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.gateway
      .listGames(spaceId, category.gameType, 'child')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (games) => {
          this.games.set(games.map((game, index) => this.toCard(game, index)));
          this.loading.set(false);
          games.forEach((game, index) => this.loadGameState(game, index, spaceId));
        },
        error: (error: unknown) => {
          this.listError.set(toApiError(error, 'activites').message);
          this.loading.set(false);
        },
      });
  }

  protected retryCard(card: CategoryGameCard): void {
    this.updateCard(card.game.id, { state: 'loading', error: null });
    this.loadGameState(card.game, this.games().findIndex((item) => item.game.id === card.game.id), this.ctx.spaceId());
  }

  protected countdownFor(card: CategoryGameCard): string {
    return formatAvailabilityCountdown(card.nextAvailableAt, this.now());
  }

  protected playRoute(card: CategoryGameCard): readonly string[] {
    return ['/enfant/jouer', card.game.id];
  }

  protected navigationState(card: CategoryGameCard): { gameTitle: string; gameType: GameDto['type'] } {
    return { gameTitle: card.routeTitle, gameType: card.game.type };
  }

  private toCard(game: GameDto, index: number): CategoryGameCard {
    const parsedContent = parseGameContent(game.type, game.content);
    const expression =
      parsedContent?.type === 'MATH' && parsedContent.expression.trim() ? parsedContent.expression.trim() : '';
    const fallbackTitle = game.title?.trim() || `Jeu ${index + 1}`;
    const title = game.type === 'MATH' && expression ? expression : fallbackTitle;
    const instruction: Record<GameDto['type'], string> = {
      MATH: 'Résous l’expression et écris le résultat.',
      MATCHING: 'Relie les éléments qui vont ensemble.',
      DICTATION: 'Écoute la phrase et retranscris-la.',
      SENTENCE_ORDERING: 'Remets les mots dans le bon ordre.',
    };

    return {
      game,
      title,
      routeTitle: game.title?.trim() || title,
      instruction: instruction[game.type],
      state: 'loading',
      sessionId: null,
      nextAvailableAt: null,
      error: null,
    };
  }

  private loadGameState(game: GameDto, _index: number, spaceId: string): void {
    let sessionId: string | null;
    try {
      sessionId =
        this.registry.sessionIdFor(spaceId, game.id) ??
        (this.ctx.gamesMode === 'demo' ? this.demo.latestSessionIdFor(spaceId, game.id) : null);
    } catch (error: unknown) {
      this.updateCard(game.id, { state: 'error', error: errorMessage(error) });
      return;
    }

    const session$ = sessionId
      ? this.gateway.getSession(spaceId, sessionId).pipe(
          catchError((error: unknown) => {
            const apiError = toApiError(error, 'activites');
            if (!apiError.isNotFound) return throwError(() => apiError);
            try {
              this.registry.forget(spaceId, game.id);
              return of(null);
            } catch (storageError: unknown) {
              return throwError(() => storageError);
            }
          }),
        )
      : of(null);

    forkJoin({
      availability: this.gateway.availability(spaceId, game.id, 'child'),
      session: session$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ availability, session }) => {
          if (session && (session.spaceId !== spaceId || session.gameId !== game.id)) {
            this.updateCard(game.id, {
              state: 'error',
              error: 'La session mémorisée ne correspond pas à ce jeu. Réessaie de charger la liste.',
            });
            return;
          }
          const current = this.games().find((card) => card.game.id === game.id);
          if (!current) return;
          this.updateCard(game.id, this.cardFromState(current, availability, session));
        },
        error: (error: unknown) => {
          this.updateCard(game.id, {
            state: 'error',
            error: toApiError(error, 'activites').message,
          });
        },
      });
  }

  private cardFromState(
    card: CategoryGameCard,
    availability: AvailabilityDto,
    session: SessionDto | null,
  ): Pick<CategoryGameCard, 'state' | 'sessionId' | 'nextAvailableAt' | 'error'> {
    return {
      state: resolveCategoryGameState(availability, session),
      sessionId: session?.id ?? null,
      nextAvailableAt: availability.nextAvailableAt ?? session?.nextAvailableAt ?? null,
      error: null,
    };
  }

  private updateCard(
    gameId: string,
    update: Partial<Pick<CategoryGameCard, 'state' | 'sessionId' | 'nextAvailableAt' | 'error'>>,
  ): void {
    this.games.update((cards) =>
      cards.map((card) => (card.game.id === gameId ? { ...card, ...update } : card)),
    );
  }

  private updateCountdowns(): void {
    const now = Date.now();
    this.now.set(now);
    for (const card of this.games()) {
      if (
        card.state !== 'blocked' ||
        !card.nextAvailableAt ||
        Date.parse(card.nextAvailableAt) > now ||
        this.refreshingGames.has(card.game.id)
      ) {
        continue;
      }
      this.refreshingGames.add(card.game.id);
      this.gateway
        .availability(this.ctx.spaceId(), card.game.id, 'child')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (availability) => {
            const current = this.games().find((item) => item.game.id === card.game.id);
            if (current) {
              this.updateCard(card.game.id, {
                state: availability.available ? 'available' : 'blocked',
                nextAvailableAt: availability.nextAvailableAt,
                error: null,
              });
            }
            this.refreshingGames.delete(card.game.id);
          },
          error: (error: unknown) => {
            this.updateCard(card.game.id, {
              state: 'error',
              error: `Impossible de vérifier si le jeu est de nouveau disponible : ${toApiError(error, 'activites').message}`,
            });
            this.refreshingGames.delete(card.game.id);
          },
        });
    }
  }
}
