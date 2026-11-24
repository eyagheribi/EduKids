import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { GamesGateway } from '../../../core/gateways/games.gateway';
import { ProgressGateway } from '../../../core/gateways/progress.gateway';
import { CATEGORIES, CategoryDef, CategoryId } from '../../../core/models/categories';
import { GAME_TYPES, GameType } from '../../../core/models/activites.models';
import { ChildSpace } from '../../../core/models/espaces.models';
import { SessionSummaryDto } from '../../../core/models/suivi.models';
import { ChildSpacesStore } from '../../../core/state/child-spaces.store';
import { ToastService } from '../../../core/services/toast.service';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { OwlComponent } from '../../../shared/ui/brand/owl.component';
import { CategoryIconComponent } from '../../../shared/ui/category-icon/category-icon.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IllustrationComponent } from '../../../shared/ui/illustration/illustration.component';

interface ActivityItem {
  readonly id: string;
  readonly childName: string;
  readonly gameTitle: string;
  readonly category: string;
  readonly completedAt: string;
  readonly successful: boolean;
}

interface CategoryProgress {
  readonly id: CategoryId;
  readonly label: string;
  readonly rate: number;
}

interface DashboardOverview {
  readonly games: number;
  readonly gamesExample: boolean;
  readonly sessionsThisWeek: number;
  readonly sessionsExample: boolean;
  readonly successRate: number;
  readonly successRateExample: boolean;
  readonly categories: readonly CategoryProgress[];
  readonly categoriesExample: boolean;
  readonly activities: readonly ActivityItem[];
}

const EXAMPLE_DATA = {
  games: 12,
  sessionsThisWeek: 18,
  successRate: 87,
  categories: [
    { id: 'maths', label: 'Mathématiques', rate: 90 },
    { id: 'association', label: 'Association', rate: 84 },
    { id: 'dictee', label: 'Dictée', rate: 78 },
  ],
} as const satisfies {
  games: number;
  sessionsThisWeek: number;
  successRate: number;
  categories: readonly CategoryProgress[];
};

const CATEGORY_ICONS: Readonly<Record<CategoryId, 'calculator' | 'puzzle' | 'list-ordered' | 'pen-line'>> = {
  maths: 'calculator',
  association: 'puzzle',
  ordonnancement: 'list-ordered',
  dictee: 'pen-line',
};

@Component({
  selector: 'ek-dashboard-page',
  imports: [
    RouterLink,
    AvatarComponent,
    CategoryIconComponent,
    IconComponent,
    IllustrationComponent,
    OwlComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard" [attr.aria-busy]="loading()">
      <section class="welcome" aria-labelledby="welcome-title">
        <div class="welcome__copy">
          <p class="eyebrow">ESPACE PARENT</p>
          <h1 id="welcome-title">Bienvenue sur votre tableau de bord</h1>
          <p class="welcome__description">
            Gérez les espaces de vos enfants, créez des jeux éducatifs et suivez leurs progrès en un coup d’œil.
          </p>
        </div>
        <div class="welcome__art" aria-hidden="true">
          <ek-illustration name="parent-child-laptop" [width]="'100%'" [eager]="true" />
        </div>
      </section>

      @if (spacesStore.error() && !spacesStore.spaces()) {
        <div class="error-banner" role="alert">
          <ek-icon name="alert" [size]="20" />
          <span>Impossible de charger les espaces enfants : {{ spacesStore.error()?.message }}</span>
          <button type="button" (click)="reload()">Réessayer</button>
        </div>
      }
      @if (overviewError()) {
        <div class="error-banner" role="alert">
          <ek-icon name="alert" [size]="20" />
          <span>Les statistiques n’ont pas pu être chargées : {{ overviewError() }}</span>
          <button type="button" (click)="reload()">Réessayer</button>
        </div>
      }

      <section class="stats" aria-label="Statistiques du tableau de bord">
        <article class="stat-card stat-card--purple">
          <span class="stat-card__icon"><ek-icon name="users" [size]="27" /></span>
          <div class="stat-card__text">
            <h2>Espaces enfants</h2>
            <strong>{{ loading() ? '…' : spacesStore.spaces()?.length ?? 0 }}</strong>
          </div>
          <span class="stat-card__spark" aria-hidden="true">✦</span>
        </article>
        <article class="stat-card stat-card--green">
          <span class="stat-card__icon"><ek-icon name="gamepad" [size]="27" /></span>
          <div class="stat-card__text">
            <h2>Jeux créés</h2>
            <strong>{{ overview()?.games ?? '…' }}</strong>
            @if (overview()?.gamesExample) { <span class="example-label">Exemple fictif</span> }
          </div>
          <span class="stat-card__spark" aria-hidden="true">✦</span>
        </article>
        <article class="stat-card stat-card--blue">
          <span class="stat-card__icon"><ek-icon name="calendar" [size]="27" /></span>
          <div class="stat-card__text">
            <h2>Sessions complétées cette semaine</h2>
            <strong>{{ overview()?.sessionsThisWeek ?? '…' }}</strong>
            @if (overview()?.sessionsExample) { <span class="example-label">Exemple fictif</span> }
          </div>
          <span class="stat-card__spark" aria-hidden="true">✦</span>
        </article>
        <article class="stat-card stat-card--yellow">
          <span class="stat-card__icon"><ek-icon name="trophy" [size]="27" /></span>
          <div class="stat-card__text">
            <h2>Taux de réussite moyen</h2>
            <strong>{{ overview() ? overview()?.successRate + ' %' : '…' }}</strong>
            @if (overview()?.successRateExample) { <span class="example-label">Exemple fictif</span> }
          </div>
          <span class="stat-card__spark" aria-hidden="true">✦</span>
        </article>
      </section>

      <div class="dashboard-grid">
        <section class="panel children-panel" aria-labelledby="children-title">
          <header class="panel__heading">
            <div class="panel__title-wrap">
              <span class="panel__icon"><ek-icon name="users" [size]="27" /></span>
              <div>
                <h2 id="children-title">Mes enfants</h2>
                <p>Accédez rapidement aux espaces de vos enfants et gérez leurs jeux.</p>
              </div>
            </div>
            <a class="text-link" routerLink="/parent/enfants">Gérer les espaces <span aria-hidden="true">→</span></a>
          </header>

          @if (loading() && !spacesStore.spaces()) {
            <div class="children-list children-list--loading" aria-hidden="true">
              @for (item of [1, 2, 3]; track item) { <div class="child-skeleton"></div> }
            </div>
          } @else if (spacesStore.spaces()?.length) {
            <div class="children-list">
              @for (child of spacesStore.spaces() ?? []; track child.id) {
                <article class="child-card">
                  <header class="child-card__heading">
                    <ek-avatar [avatar]="child.avatar" [seed]="child.id" [size]="56" />
                    <h3>{{ child.nomEnfant }}</h3>
                  </header>
                  <div class="category-pills" aria-label="Catégories activées">
                    @for (category of activeCategories(child); track category.id) {
                      <span [class]="'category-pill category-pill--' + category.tone">
                        <ek-icon [name]="categoryIcon(category.id)" [size]="14" />
                        {{ category.label }}
                      </span>
                    } @empty {
                      <span class="category-empty">Aucune catégorie activée</span>
                    }
                  </div>
                  <div class="child-card__actions">
                    <button class="code-button" type="button" (click)="copyCode(child)" [attr.aria-label]="'Copier le code d’accès de ' + child.nomEnfant">
                      <ek-icon name="key" [size]="16" />
                      <span>Code : <strong>{{ child.codeAcces }}</strong></span>
                      <ek-icon name="copy" [size]="16" />
                    </button>
                    <a class="open-button" [routerLink]="['/parent/enfants', child.id]">
                      <ek-icon name="play" [size]="14" /> Ouvrir
                    </a>
                  </div>
                </article>
              }
            </div>
          } @else {
            <div class="children-empty">
              <ek-icon name="baby" [size]="30" />
              <p>Créez un premier espace enfant pour commencer.</p>
              <a routerLink="/parent/enfants" [queryParams]="{ creer: 1 }">Créer un espace</a>
            </div>
          }
        </section>

        <section class="panel quick-panel" aria-labelledby="quick-title">
          <header class="panel__heading panel__heading--compact">
            <span class="panel__icon"><ek-icon name="sparkles" [size]="27" /></span>
            <h2 id="quick-title">Actions rapides</h2>
          </header>
          <div class="quick-actions">
            <a class="quick-action quick-action--green" routerLink="/parent/enfants" [queryParams]="{ creer: 1 }">
              <ek-icon name="user-plus" [size]="27" />
              <span>Créer un<br />espace enfant</span>
            </a>
            @if (firstChild(); as child) {
              <a class="quick-action quick-action--purple" [routerLink]="['/parent/enfants', child.id, 'jeux']">
                <ek-icon name="gamepad" [size]="27" />
                <span>Ajouter un jeu</span>
              </a>
              <a class="quick-action quick-action--blue" [routerLink]="['/parent/enfants', child.id, 'progres']">
                <ek-icon name="chart" [size]="27" />
                <span>Voir les progrès</span>
              </a>
            } @else {
              <a class="quick-action quick-action--purple" routerLink="/parent/jeux">
                <ek-icon name="gamepad" [size]="27" />
                <span>Ajouter un jeu</span>
              </a>
              <a class="quick-action quick-action--blue" routerLink="/parent/progres">
                <ek-icon name="chart" [size]="27" />
                <span>Voir les progrès</span>
              </a>
            }
            <button class="quick-action quick-action--yellow" type="button" (click)="copyFirstCode()">
              <ek-icon name="copy" [size]="27" />
              <span>Copier un<br />code d’accès</span>
            </button>
          </div>
        </section>

        <section class="panel activity-panel" aria-labelledby="activity-title">
          <header class="panel__heading">
            <div class="panel__title-wrap">
              <span class="panel__icon"><ek-icon name="clock" [size]="27" /></span>
              <div>
                <h2 id="activity-title">Activité récente</h2>
                <p>Les dernières activités sur vos espaces enfants.</p>
              </div>
            </div>
            <a class="text-link" routerLink="/parent/progres">Voir tout <span aria-hidden="true">→</span></a>
          </header>
          @if (overview()?.activities?.length) {
            <ol class="activity-list">
              @for (activity of overview()?.activities ?? []; track activity.id) {
                <li class="activity-item">
                  <span class="activity-item__icon" [class.activity-item__icon--success]="activity.successful">
                    <ek-icon [name]="activity.successful ? 'gamepad' : 'history'" [size]="20" />
                  </span>
                  <div class="activity-item__copy">
                    <p><strong>{{ activity.childName }}</strong> {{ activity.successful ? 'a terminé' : 'a joué à' }} le jeu <strong>« {{ activity.gameTitle }} »</strong>.</p>
                    <small>{{ activity.category }} · {{ relativeTime(activity.completedAt) }}</small>
                  </div>
                  @if (activity.successful) {
                    <span class="activity-item__status" aria-label="Réussite"><ek-icon name="check" [size]="20" /></span>
                  }
                </li>
              }
            </ol>
          } @else {
            <div class="activity-empty">
              <ek-icon name="history" [size]="25" />
              <p>Les dernières sessions apparaîtront ici.</p>
            </div>
          }
        </section>

        <section class="panel progress-panel" aria-labelledby="progress-title">
          <header class="panel__heading">
            <div class="panel__title-wrap">
              <span class="panel__icon"><ek-icon name="chart" [size]="27" /></span>
              <div>
                <h2 id="progress-title">Progression globale</h2>
                <p>Taux de réussite moyen par catégorie (tous les enfants).</p>
              </div>
            </div>
            @if (overview()?.categoriesExample) { <span class="example-label">Exemple fictif</span> }
          </header>
          @if (overview()?.categories?.length) {
            <div class="progress-list">
              @for (row of overview()?.categories ?? []; track row.id) {
                <div class="progress-row">
                  <ek-category-icon [category]="row.id" [size]="33" />
                  <strong>{{ row.label }}</strong>
                  <span class="progress-track" role="img" [attr.aria-label]="row.label + ' : ' + row.rate + ' %'">
                    <span class="progress-track__fill" [class]="'progress-track__fill progress-track__fill--' + row.id" [style.width.%]="row.rate"></span>
                  </span>
                  <b>{{ row.rate }} %</b>
                </div>
              }
            </div>
          } @else if (overview()) {
            <div class="activity-empty">
              <ek-icon name="chart-line" [size]="25" />
              <p>Les résultats par catégorie apparaîtront après les premières sessions.</p>
            </div>
          } @else {
            <div class="progress-skeleton" aria-hidden="true"></div>
          }
        </section>

        <aside class="tip-card" aria-labelledby="tip-title">
          <div class="tip-card__inner">
            <header>
              <ek-icon name="lightbulb" [size]="29" />
              <h2 id="tip-title">Conseil du jour</h2>
            </header>
            <p>
              Variez les types de jeux (calcul, association, dictée…) pour renforcer l’apprentissage de manière
              ludique et équilibrée.
            </p>
            <div class="tip-card__owl" aria-hidden="true">
              <ek-owl [size]="132" mood="cheer" [sparkles]="true" />
            </div>
          </div>
        </aside>
      </div>
      <p class="data-note">
        <ek-icon name="info" [size]="15" />
        Les valeurs marquées « Exemple fictif » illustrent le tableau et ne proviennent pas du backend.
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 1440px;
      margin: 0 auto;
      color: #2e1d4b;
      font-family: var(--ek-font-body, 'Nunito Variable', sans-serif);
    }

    .dashboard { display: grid; gap: 1.15rem; }
    .welcome {
      position: relative;
      display: flex;
      align-items: center;
      min-height: 170px;
      overflow: hidden;
      padding: 0.2rem 1.5rem 0.1rem 2rem;
    }
    .welcome__copy { position: relative; z-index: 1; width: min(69%, 760px); }
    .eyebrow {
      margin: 0 0 0.35rem;
      color: #7434d5;
      font-family: var(--ek-font-display);
      font-size: 0.85rem;
      font-weight: 750;
      letter-spacing: 0.045em;
    }
    h1, h2, h3, p { margin-top: 0; }
    .welcome h1 {
      margin-bottom: 0.35rem;
      color: #2c1948;
      font-family: var(--ek-font-display);
      font-size: clamp(1.7rem, 3vw, 2.45rem);
      font-weight: 750;
      line-height: 1.13;
    }
    .welcome__description { max-width: 700px; margin: 0; color: #655b75; font-size: 1rem; }
    .welcome__art {
      position: absolute;
      right: 0;
      bottom: 0;
      width: min(34%, 340px);
      max-height: 100%;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
      opacity: 0.98;
    }
    .welcome__art ek-illustration { width: 100%; }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.8rem 1rem;
      border: 1px solid #f2c5bd;
      border-radius: 14px;
      background: #fff5f2;
      color: #8d3429;
      font-size: 0.9rem;
      font-weight: 700;
    }
    .error-banner span { flex: 1; }
    .error-banner button { border: 0; background: transparent; color: inherit; font: inherit; text-decoration: underline; cursor: pointer; }

    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.65rem; }
    .stat-card {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      min-width: 0;
      min-height: 112px;
      padding: 0.85rem 1rem;
      border: 1px solid rgba(226, 215, 244, 0.85);
      border-radius: 22px;
      background: #fff;
      box-shadow: 0 6px 15px rgba(48, 24, 81, 0.08);
    }
    .stat-card::before {
      position: absolute;
      inset: 9px;
      z-index: 0;
      border-radius: 16px;
      content: '';
      opacity: 0.56;
    }
    .stat-card--purple::before { background: linear-gradient(115deg, #f8f2ff, #f1e7ff); }
    .stat-card--green::before { background: linear-gradient(115deg, #f5fff0, #e9f8df); }
    .stat-card--blue::before { background: linear-gradient(115deg, #f2f8ff, #e5f1ff); }
    .stat-card--yellow::before { background: linear-gradient(115deg, #fffdf2, #fff6d8); }
    .stat-card__icon, .stat-card__text, .stat-card__spark { position: relative; z-index: 1; }
    .stat-card__icon {
      display: grid;
      place-items: center;
      flex: 0 0 55px;
      width: 55px;
      height: 55px;
      border-radius: 50%;
    }
    .stat-card--purple .stat-card__icon { background: #eadbff; color: #7938d4; }
    .stat-card--green .stat-card__icon { background: #dff4d5; color: #309129; }
    .stat-card--blue .stat-card__icon { background: #d9eaff; color: #1681dc; }
    .stat-card--yellow .stat-card__icon { background: #fff0bd; color: #d89500; }
    .stat-card__text { display: grid; gap: 0.05rem; min-width: 0; }
    .stat-card h2 {
      margin: 0;
      color: #241542;
      font-family: var(--ek-font-display);
      font-size: 0.87rem;
      font-weight: 650;
      line-height: 1.18;
    }
    .stat-card strong { color: #34204f; font-family: var(--ek-font-display); font-size: 2rem; font-weight: 750; line-height: 1.05; }
    .stat-card__spark { margin-left: auto; color: #ffc400; font-size: 1.65rem; }
    .stat-card--green .stat-card__spark { color: #79ce4c; }
    .stat-card--blue .stat-card__spark { color: #8d85ff; }
    .example-label {
      display: inline-flex;
      align-items: center;
      width: max-content;
      padding: 0.15rem 0.45rem;
      border-radius: 99px;
      background: #fff2ca;
      color: #775600;
      font-size: 0.65rem;
      font-weight: 800;
      line-height: 1.2;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 1rem;
      align-items: stretch;
    }
    .panel {
      min-width: 0;
      padding: 1rem;
      border: 1px solid #e8def6;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.82);
      box-shadow: 0 7px 20px rgba(52, 29, 86, 0.07);
    }
    .children-panel { grid-column: span 8; }
    .quick-panel { grid-column: span 4; }
    .activity-panel { grid-column: span 5; }
    .progress-panel { grid-column: span 4; }
    .panel__heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.7rem;
      margin-bottom: 0.9rem;
    }
    .panel__title-wrap { display: flex; align-items: flex-start; gap: 0.7rem; min-width: 0; }
    .panel__icon { display: inline-flex; flex: none; color: #7734d2; }
    .panel__heading h2, .tip-card h2 {
      margin: 0;
      color: #2d1948;
      font-family: var(--ek-font-display);
      font-size: 1.27rem;
      font-weight: 700;
      line-height: 1.2;
    }
    .panel__heading p { margin: 0.12rem 0 0; color: #716880; font-size: 0.82rem; line-height: 1.35; }
    .text-link {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 0.35rem;
      padding-top: 0.25rem;
      color: #7434d5;
      font-size: 0.84rem;
      font-weight: 800;
      text-decoration: none;
    }
    .text-link:hover { color: #4c1ca4; text-decoration: underline; }
    .children-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; }
    .child-card {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 0.7rem;
      border: 1px solid #e7ddf5;
      border-radius: 17px;
      background: linear-gradient(145deg, #fff, #fcfaff);
      box-shadow: 0 3px 8px rgba(54, 32, 85, 0.045);
    }
    .child-card__heading { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; }
    .child-card h3 {
      min-width: 0;
      margin: 0;
      overflow: hidden;
      color: #2e1a4a;
      font-family: var(--ek-font-display);
      font-size: 1.13rem;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .category-pills { display: flex; flex-wrap: wrap; gap: 0.25rem; min-height: 25px; margin-bottom: 0.55rem; }
    .category-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.22rem;
      padding: 0.2rem 0.42rem;
      border-radius: 99px;
      font-size: 0.68rem;
      font-weight: 750;
      line-height: 1.15;
    }
    .category-pill--green { background: #e8f7e3; color: #267c24; }
    .category-pill--purple { background: #f0e7ff; color: #6a35b7; }
    .category-pill--blue { background: #e6f1ff; color: #246eb4; }
    .category-pill--yellow { background: #fff3ce; color: #a76b00; }
    .category-empty { color: #81788d; font-size: 0.76rem; }
    .child-card__actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.35rem;
      margin-top: auto;
    }
    .code-button {
      display: inline-flex;
      align-items: center;
      gap: 0.28rem;
      min-width: 0;
      padding: 0.36rem 0.15rem;
      border: 0;
      background: transparent;
      color: #45395c;
      font-family: inherit;
      font-size: 0.72rem;
      cursor: pointer;
    }
    .code-button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .code-button strong { color: #291843; letter-spacing: 0.02em; }
    .code-button:hover { color: #7136c9; }
    .open-button {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 0.22rem;
      padding: 0.44rem 0.7rem;
      border-radius: 12px;
      background: linear-gradient(135deg, #9852e2, #7133c5);
      color: #fff;
      font-size: 0.74rem;
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 3px 8px #7234c52a;
    }
    .open-button:hover { background: #5f27ae; }
    .children-empty, .activity-empty {
      display: grid;
      justify-items: center;
      gap: 0.45rem;
      padding: 1rem;
      color: #796e89;
      text-align: center;
    }
    .children-empty > ek-icon, .activity-empty > ek-icon { color: #8b5bd1; }
    .children-empty p, .activity-empty p { margin: 0; font-size: 0.86rem; }
    .children-empty a { color: #7136c9; font-size: 0.85rem; font-weight: 800; }
    .child-skeleton { height: 165px; border-radius: 16px; background: linear-gradient(90deg, #f3eff8, #faf8fc, #f3eff8); }

    .panel__heading--compact { align-items: center; justify-content: flex-start; gap: 0.7rem; margin-bottom: 0.8rem; }
    .quick-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem; }
    .quick-action {
      display: flex;
      min-height: 86px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.55rem;
      border: 0;
      border-radius: 16px;
      color: #241640;
      font-family: inherit;
      font-size: 0.84rem;
      font-weight: 800;
      line-height: 1.16;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .quick-action:hover { transform: translateY(-2px); box-shadow: 0 5px 12px rgba(51, 27, 86, 0.12); }
    .quick-action--green { background: #eaf8e3; color: #2d8b27; }
    .quick-action--purple { background: #f1e8ff; color: #7836d1; }
    .quick-action--blue { background: #e7f2ff; color: #1676cf; }
    .quick-action--yellow { background: #fff5dc; color: #d28d00; }
    .quick-action span { color: #241640; }

    .activity-list { display: grid; gap: 0.12rem; margin: 0; padding: 0; list-style: none; }
    .activity-item { display: flex; align-items: center; gap: 0.65rem; min-width: 0; padding: 0.43rem 0.1rem; }
    .activity-item__icon {
      display: grid;
      position: relative;
      place-items: center;
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #eee5ff;
      color: #753bd0;
    }
    .activity-item__icon--success { background: #e7f7df; color: #32912d; }
    .activity-item__copy { min-width: 0; flex: 1; }
    .activity-item__copy p { margin: 0; color: #372b4c; font-size: 0.8rem; line-height: 1.35; }
    .activity-item__copy small { display: block; margin-top: 0.12rem; color: #80778e; font-size: 0.72rem; }
    .activity-item__status {
      display: grid;
      place-items: center;
      flex: none;
      width: 28px;
      height: 28px;
      border-radius: 9px;
      background: #e7f7df;
      color: #338d2b;
    }

    .progress-list { display: grid; }
    .progress-row {
      display: grid;
      grid-template-columns: 38px minmax(90px, 0.85fr) minmax(65px, 1.15fr) 40px;
      align-items: center;
      gap: 0.45rem;
      min-height: 50px;
      border-bottom: 1px solid #f0ebf5;
    }
    .progress-row:last-child { border-bottom: 0; }
    .progress-row > strong { color: #342449; font-size: 0.78rem; line-height: 1.2; }
    .progress-row > b { color: #2e194a; font-family: var(--ek-font-display); font-size: 0.8rem; text-align: right; }
    .progress-track { height: 12px; overflow: hidden; border-radius: 99px; background: #e9e4f0; }
    .progress-track__fill { display: block; height: 100%; border-radius: inherit; }
    .progress-track__fill--maths { background: linear-gradient(90deg, #a35be4, #8b40d3); }
    .progress-track__fill--association { background: linear-gradient(90deg, #86d951, #66bf3d); }
    .progress-track__fill--ordonnancement { background: linear-gradient(90deg, #68b7f4, #388fe0); }
    .progress-track__fill--dictee { background: linear-gradient(90deg, #ffd13c, #ffbd17); }
    .progress-skeleton { height: 145px; border-radius: 14px; background: linear-gradient(90deg, #f3eff8, #faf8fc, #f3eff8); }

    .tip-card { grid-column: span 3; min-width: 0; padding: 0.6rem; border: 1px solid #e3eedb; border-radius: 22px; background: #fbfff8; box-shadow: 0 7px 20px rgba(52, 29, 86, 0.07); }
    .tip-card__inner {
      display: flex;
      height: 100%;
      min-height: 200px;
      flex-direction: column;
      overflow: hidden;
      padding: 0.9rem;
      border-radius: 16px;
      background: linear-gradient(150deg, #f7ffef, #eef9e5);
    }
    .tip-card header { display: flex; align-items: center; gap: 0.55rem; color: #78ba29; }
    .tip-card h2 { color: #318332; font-size: 1.2rem; }
    .tip-card p { margin: 0.65rem 0 0; color: #5c5868; font-size: 0.82rem; line-height: 1.5; }
    .tip-card__owl { display: flex; justify-content: flex-end; align-items: flex-end; flex: 1; min-height: 100px; margin: 0 -0.5rem -0.9rem 0; }
    .data-note { display: flex; align-items: center; gap: 0.35rem; margin: -0.4rem 0 0; color: #756d80; font-size: 0.72rem; }
    .data-note ek-icon { color: #8062a8; }
    a:focus-visible, button:focus-visible { outline: 3px solid #8750d0; outline-offset: 3px; }

    @media (max-width: 1180px) {
      .dashboard-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
      .children-panel, .quick-panel, .activity-panel, .progress-panel { grid-column: span 3; }
      .tip-card { grid-column: span 6; }
      .quick-actions { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .quick-action { min-height: 95px; }
    }
    @media (max-width: 760px) {
      .dashboard { gap: 0.9rem; }
      .welcome { min-height: 145px; padding: 0.5rem 0.4rem; }
      .welcome__copy { width: 100%; padding-right: 22%; }
      .welcome h1 { font-size: clamp(1.5rem, 6vw, 2rem); }
      .welcome__description { max-width: 440px; font-size: 0.88rem; }
      .welcome__art { right: -0.5rem; width: 32%; opacity: 0.64; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem; }
      .stat-card { min-height: 98px; gap: 0.55rem; padding: 0.7rem; border-radius: 18px; }
      .stat-card__icon { flex-basis: 43px; width: 43px; height: 43px; }
      .stat-card h2 { font-size: 0.77rem; }
      .stat-card strong { font-size: 1.65rem; }
      .stat-card__spark { display: none; }
      .dashboard-grid { grid-template-columns: minmax(0, 1fr); gap: 0.8rem; }
      .children-panel, .quick-panel, .activity-panel, .progress-panel, .tip-card { grid-column: 1; }
      .children-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .quick-actions { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.4rem; }
      .quick-action { min-height: 92px; padding: 0.4rem 0.2rem; font-size: 0.72rem; }
      .panel { padding: 0.85rem; }
      .tip-card__inner { min-height: 180px; }
    }
    @media (max-width: 480px) {
      .welcome { min-height: 160px; }
      .welcome__copy { padding-right: 5%; }
      .welcome__art { right: -1rem; width: 35%; opacity: 0.36; }
      .stats { gap: 0.4rem; }
      .stat-card { align-items: flex-start; min-height: 104px; flex-direction: column; gap: 0.35rem; padding: 0.65rem; }
      .stat-card__icon { position: absolute; top: 0.55rem; right: 0.55rem; width: 34px; height: 34px; }
      .stat-card__icon ek-icon { width: 20px; height: 20px; }
      .stat-card__text { padding-right: 1.8rem; }
      .stat-card h2 { max-width: 125px; }
      .stat-card strong { font-size: 1.5rem; }
      .children-list { grid-template-columns: minmax(0, 1fr); }
      .child-card { padding: 0.7rem; }
      .quick-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .quick-action { min-height: 82px; font-size: 0.8rem; }
      .panel__heading { flex-wrap: wrap; }
      .panel__heading .text-link { margin-left: auto; }
      .progress-row { grid-template-columns: 36px minmax(82px, 0.85fr) minmax(54px, 1fr) 36px; gap: 0.35rem; }
      .progress-row > strong { font-size: 0.72rem; }
      .data-note { align-items: flex-start; line-height: 1.4; }
    }
    @media (prefers-reduced-motion: reduce) {
      .quick-action { transition: none; }
    }
  `,
})
export class DashboardPage {
  protected readonly spacesStore = inject(ChildSpacesStore);
  private readonly games = inject(GamesGateway);
  private readonly progress = inject(ProgressGateway);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly overview = signal<DashboardOverview | null>(null);
  protected readonly overviewError = signal<string | null>(null);

  constructor() {
    this.reload();
  }

  protected firstChild(): ChildSpace | undefined {
    return this.spacesStore.spaces()?.[0];
  }

  protected activeCategories(child: ChildSpace): readonly CategoryDef[] {
    return CATEGORIES.filter((category) => category.espacesKey && child.activites.includes(category.espacesKey));
  }

  protected categoryIcon(id: CategoryId): (typeof CATEGORY_ICONS)[CategoryId] {
    return CATEGORY_ICONS[id];
  }

  protected reload(): void {
    this.loading.set(true);
    this.overviewError.set(null);
    this.spacesStore.load(true).subscribe({
      next: (spaces) => this.loadOverview(spaces),
      error: (error: unknown) => {
        this.loading.set(false);
        this.overviewError.set(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
      },
    });
  }

  protected async copyCode(child: ChildSpace): Promise<void> {
    try {
      await navigator.clipboard.writeText(child.codeAcces);
      this.toast.success(`Code d’accès de ${child.nomEnfant} copié.`);
    } catch {
      this.toast.error('Impossible de copier le code. Vérifiez les autorisations du navigateur.');
    }
  }

  protected copyFirstCode(): void {
    const child = this.firstChild();
    if (child) {
      void this.copyCode(child);
      return;
    }
    void this.router.navigate(['/parent/enfants'], { queryParams: { creer: 1 } });
  }

  protected relativeTime(value: string): string {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
    if (elapsedMinutes < 1) return 'à l’instant';
    if (elapsedMinutes < 60) return `Il y a ${elapsedMinutes} min`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `Il y a ${elapsedHours} h`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    return `Il y a ${elapsedDays} j`;
  }

  private loadOverview(spaces: readonly ChildSpace[]): void {
    const now = new Date();
    const weekStart = new Date(now);
    const daysSinceMonday = (now.getDay() + 6) % 7;
    weekStart.setDate(now.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);

    const progressRequests = spaces.map((space) =>
      forkJoin({
        summary: this.progress.summary(space.id),
        week: this.progress.history(space.id, {
          from: weekStart.toISOString(),
          sortOrder: 'desc',
          page: 1,
          pageSize: 1,
        }),
        recent: this.progress.history(space.id, { sortOrder: 'desc', page: 1, pageSize: 4 }),
        categories: this.progress.statsByType(space.id),
      }).pipe(map((results) => ({ space, ...results }))),
    );
    const gameRequests = spaces.flatMap((space) =>
      GAME_TYPES.filter((type) =>
        CATEGORIES.some(
          (category) => category.gameType === type && category.espacesKey && space.activites.includes(category.espacesKey),
        ),
      ).map((type) => this.games.listGames(space.id, type, 'parent')),
    );

    forkJoin({
      progress: progressRequests.length ? forkJoin(progressRequests) : of([]),
      games: gameRequests.length ? forkJoin(gameRequests) : of([]),
    }).subscribe({
      next: ({ progress, games }) => {
        const summaries = progress.map((entry) => entry.summary);
        const sessionCount = summaries.reduce((total, summary) => total + summary.totalSessions, 0);
        const successfulCount = summaries.reduce((total, summary) => total + summary.successfulSessions, 0);
        const actualWeeklyCount = progress.reduce((total, entry) => total + entry.week.totalCount, 0);
        const gameCount = games.reduce((total, list) => total + list.length, 0);
        const categoryTotals = new Map<GameType, { sessions: number; successful: number }>();
        for (const entry of progress) {
          for (const category of entry.categories) {
            const current = categoryTotals.get(category.gameType) ?? { sessions: 0, successful: 0 };
            categoryTotals.set(category.gameType, {
              sessions: current.sessions + category.totalSessions,
              successful: current.successful + category.successfulSessions,
            });
          }
        }

        const actualCategories: CategoryProgress[] = CATEGORIES.flatMap((category) => {
          if (!category.gameType) return [];
          const totals = categoryTotals.get(category.gameType);
          if (!totals?.sessions) return [];
          return [{
            id: category.id,
            label: category.label,
            rate: Math.round((totals.successful / totals.sessions) * 100),
          }];
        });

        const activities: ActivityItem[] = progress
          .flatMap((entry) => entry.recent.items.map((session) => this.toActivity(entry.space, session)))
          .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
          .slice(0, 4);

        const useGameExample = this.games.mode === 'demo' && gameCount === 0;
        const useProgressExample = this.progress.mode === 'demo' && sessionCount === 0;
        this.overview.set({
          games: useGameExample ? EXAMPLE_DATA.games : gameCount,
          gamesExample: useGameExample,
          sessionsThisWeek: useProgressExample ? EXAMPLE_DATA.sessionsThisWeek : actualWeeklyCount,
          sessionsExample: useProgressExample,
          successRate: useProgressExample
            ? EXAMPLE_DATA.successRate
            : sessionCount
              ? Math.round((successfulCount / sessionCount) * 100)
              : 0,
          successRateExample: useProgressExample,
          categories: actualCategories.length
            ? actualCategories
            : this.progress.mode === 'demo'
              ? EXAMPLE_DATA.categories
              : [],
          categoriesExample: actualCategories.length === 0 && this.progress.mode === 'demo',
          activities,
        });
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.overviewError.set(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
        this.loading.set(false);
      },
    });
  }

  private toActivity(space: ChildSpace, session: SessionSummaryDto): ActivityItem {
    const category = CATEGORIES.find((item) => item.gameType === session.gameType);
    return {
      id: `${space.id}-${session.sessionId}`,
      childName: space.nomEnfant,
      gameTitle: session.gameTitle?.trim() || 'Jeu sans titre',
      category: category?.label ?? session.gameType,
      completedAt: session.completedAt,
      successful: session.finalStatus === 'SUCCESS',
    };
  }
}
