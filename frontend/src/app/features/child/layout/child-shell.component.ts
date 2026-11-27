import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthFlowsService } from '../../../core/auth/auth-flows.service';
import { LogoComponent } from '../../../shared/ui/brand/logo.component';
import { CharacterComponent } from '../../../shared/ui/character/character.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IconName } from '../../../shared/ui/icon/icon.data';
import { IllustrationComponent } from '../../../shared/ui/illustration/illustration.component';
import { ChildContext } from '../child-context';

interface ChildNavItem {
  readonly label: string;
  readonly icon: IconName;
  readonly link: string;
  readonly fragment?: string;
}

/** Navigation frame of the child area; shares the authenticated ChildContext with every page. */
@Component({
  selector: 'ek-child-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LogoComponent,
    CharacterComponent,
    IconComponent,
    IllustrationComponent,
  ],
  providers: [ChildContext],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="child-layout"
      [class.child-layout--drawer-open]="drawerOpen()"
      [class.child-layout--immersive]="immersive()"
    >
      @if (!immersive()) {
      <aside class="sidebar" id="navigation-enfant" aria-label="Navigation de l’espace enfant">
        <div class="sidebar__brand">
          <a routerLink="/enfant" aria-label="EduKids — accueil enfant" (click)="drawerOpen.set(false)">
            <ek-logo />
          </a>
          <button type="button" class="sidebar__close" (click)="drawerOpen.set(false)" aria-label="Fermer le menu">
            <ek-icon name="x" [size]="22" />
          </button>
        </div>

        <nav aria-label="Menu principal">
          <ul>
            @for (item of navItems; track item.label) {
              <li>
                <a
                  [routerLink]="item.link"
                  [fragment]="item.fragment"
                  [routerLinkActive]="item.fragment ? '' : 'is-active'"
                  [routerLinkActiveOptions]="{ exact: true }"
                  (click)="drawerOpen.set(false)"
                >
                  <span class="nav-icon"><ek-icon [name]="item.icon" [size]="23" [strokeWidth]="2.3" /></span>
                  {{ item.label }}
                </a>
              </li>
            }
          </ul>
        </nav>

        <div class="sidebar__art" aria-hidden="true">
          <ek-illustration name="plant-books" [width]="170" />
        </div>
      </aside>

      <button
        class="backdrop"
        type="button"
        aria-label="Fermer le menu"
        tabindex="-1"
        (click)="drawerOpen.set(false)"
      ></button>
      }

      <div class="main">
        @if (!immersive()) {
        <header class="topbar">
          <button
            type="button"
            class="menu-button"
            (click)="drawerOpen.set(true)"
            aria-label="Ouvrir le menu"
            aria-controls="navigation-enfant"
            [attr.aria-expanded]="drawerOpen()"
          >
            <ek-icon name="menu" [size]="25" />
          </button>
          <a routerLink="/enfant" class="mobile-logo" aria-label="Accueil EduKids"><ek-logo size="sm" /></a>
          <div class="breadcrumb"><ek-icon name="home" [size]="19" /><span aria-hidden="true">/</span><strong>Mon espace</strong></div>

          <details class="account" #accountMenu>
            <summary>
              <ek-character [key]="ctx.space()?.personnagePrefere" [size]="39" [framed]="true" />
              <span>{{ ctx.firstName() || 'Mon espace' }}</span>
              <ek-icon name="chevron-down" [size]="18" />
            </summary>
            <div class="account__menu">
              <p class="account__name">{{ ctx.firstName() || 'Mon espace' }}</p>
              <a routerLink="/enfant/personnage" (click)="accountMenu.open = false">
                <ek-icon name="user" [size]="18" /> Changer de personnage
              </a>
              <button type="button" (click)="leave()">
                <ek-icon name="log-out" [size]="18" /> Me déconnecter
              </button>
            </div>
          </details>
        </header>
        }

        @if (ctx.error()) {
          <div class="space-error" role="alert">
            <ek-icon name="alert" [size]="20" />
            <span>Impossible de charger ton espace. Demande à ton parent de vérifier la connexion.</span>
            <button type="button" (click)="ctx.load(true)">Réessayer</button>
          </div>
        }

        <main class="content" id="contenu-enfant" [class.content--game]="immersive()">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      min-height: 100vh;
      overflow-x: clip;
      background: linear-gradient(180deg, #f7f2ff 0%, #fbfaff 48%, #f3fcf4 100%);
    }
    .child-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
    .child-layout--immersive { grid-template-columns: minmax(0, 1fr); }
    .sidebar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      height: 100vh;
      flex-direction: column;
      padding: 1.25rem 1rem 0;
      overflow: hidden auto;
      border: 1px solid #e8def8;
      border-radius: 0 25px 25px 0;
      background: rgba(255,255,255,.92);
      box-shadow: 4px 0 24px rgba(67,39,113,.06);
    }
    .sidebar__brand { display: flex; align-items: center; justify-content: space-between; padding: 0 .45rem 2rem; }
    .sidebar__brand a, .mobile-logo { text-decoration: none; }
    .sidebar__close, .menu-button, .backdrop, .mobile-logo { display: none; }
    nav ul { display: grid; gap: .45rem; margin: 0; padding: 0; list-style: none; }
    nav a {
      display: flex;
      align-items: center;
      gap: .85rem;
      min-height: 51px;
      padding: .65rem .85rem;
      border-radius: 16px;
      color: #281746;
      font: 650 1.04rem var(--ek-font-display);
      text-decoration: none;
      transition: background 160ms ease, transform 160ms ease, color 160ms ease;
    }
    nav a:hover { transform: translateX(2px); background: #f3edff; }
    nav a.is-active { background: linear-gradient(100deg, #f2eaff, #ebe0ff); color: #6a2bc1; }
    .nav-icon { display: grid; place-items: center; flex: none; width: 29px; color: #7d62ab; }
    .sidebar__art { display: flex; justify-content: center; align-items: flex-end; margin-top: auto; padding: 1rem 0 .6rem; }
    .main { display: flex; min-width: 0; flex-direction: column; }
    .topbar {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: .85rem;
      min-height: 64px;
      padding: .65rem clamp(1rem, 2.2vw, 2rem);
    }
    .breadcrumb { display: flex; align-items: center; gap: .65rem; color: #39225f; font-size: .92rem; }
    .breadcrumb ek-icon { color: #6034ad; }
    .breadcrumb > span { color: #8c82a0; }
    .breadcrumb strong { font-weight: 800; }
    .account { position: relative; margin-left: auto; }
    .account summary {
      display: flex;
      align-items: center;
      gap: .55rem;
      padding: .28rem .55rem .28rem .3rem;
      border-radius: 99px;
      background: rgba(255,255,255,.88);
      box-shadow: 0 4px 12px rgba(56,35,91,.08);
      color: #2e1a4a;
      cursor: pointer;
      font: 700 1rem var(--ek-font-display);
      list-style: none;
    }
    .account summary::-webkit-details-marker { display: none; }
    .account summary:hover, .account[open] summary { background: #fff; }
    .account__menu {
      position: absolute;
      top: calc(100% + .55rem);
      right: 0;
      z-index: 30;
      display: grid;
      min-width: 220px;
      gap: .2rem;
      padding: .55rem;
      border: 1px solid #e5dcf2;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 12px 30px #34234a20;
    }
    .account__name { margin: .25rem .55rem .4rem; color: #36234e; font-weight: 850; }
    .account__menu a, .account__menu button {
      display: flex;
      align-items: center;
      gap: .55rem;
      padding: .65rem .55rem;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #453655;
      font: 750 .9rem var(--ek-font-body, 'Nunito Variable', sans-serif);
      text-align: left;
      text-decoration: none;
      cursor: pointer;
    }
    .account__menu a:hover, .account__menu button:hover { background: #f5efff; }
    .account__menu button { color: #9c3d56; }
    .space-error { display: flex; align-items: center; gap: .6rem; margin: 0 clamp(1rem, 2.2vw, 2rem) .5rem; padding: .7rem .9rem; border-radius: 13px; background: #fff2ee; color: #903e30; font-size: .86rem; font-weight: 750; }
    .space-error span { flex: 1; }
    .space-error button { border: 0; background: transparent; color: inherit; font: inherit; text-decoration: underline; cursor: pointer; }
    .content { position: relative; z-index: 1; flex: 1; width: 100%; max-width: 1530px; margin: 0 auto; padding: .3rem clamp(1rem, 2.2vw, 2rem) 2rem; }
    .content--game { max-width: none; padding: 0; }
    a:focus-visible, button:focus-visible, summary:focus-visible { outline: 3px solid #8750d0; outline-offset: 3px; }
    @media (max-width: 920px) {
      .child-layout { grid-template-columns: minmax(0, 1fr); }
      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: min(280px, 85vw);
        height: 100dvh;
        transform: translateX(-105%);
        transition: transform 230ms ease;
        box-shadow: 0 12px 35px rgba(40,20,65,.2);
      }
      .child-layout--drawer-open .sidebar { transform: translateX(0); }
      .sidebar__close { display: inline-grid; place-items: center; width: 38px; height: 38px; border: 0; border-radius: 50%; background: #f3edff; color: #6b3db0; }
      .child-layout--drawer-open .backdrop { position: fixed; inset: 0; z-index: 15; display: block; border: 0; background: rgba(35,19,57,.32); }
      .topbar { position: sticky; top: 0; min-height: 58px; padding: .45rem 1rem; border-bottom: 1px solid rgba(226,216,240,.85); background: rgba(250,248,255,.9); backdrop-filter: blur(9px); }
      .menu-button { display: inline-grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 13px; background: #fff; color: #6337a9; box-shadow: 0 3px 9px #3a245510; }
      .mobile-logo { display: inline-flex; }
      .breadcrumb { display: none; }
      .sidebar__art { padding-bottom: 1rem; }
      .content { padding-top: 1rem; }
    }
    @media (max-width: 500px) {
      .account summary { gap: .25rem; padding-right: .4rem; }
      .account summary > span { max-width: 94px; overflow: hidden; font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
      .content { padding-right: .8rem; padding-left: .8rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      nav a, .sidebar { transition: none; }
    }
  `,
})
export class ChildShellComponent implements OnInit {
  protected readonly ctx = inject(ChildContext);
  protected readonly drawerOpen = signal(false);
  protected readonly immersive = signal(false);
  protected readonly navItems: readonly ChildNavItem[] = [
    { label: 'Accueil', icon: 'home', link: '/enfant' },
    { label: 'Mon espace', icon: 'user', link: '/enfant/personnage' },
    { label: 'Jeux éducatifs', icon: 'gamepad', link: '/enfant', fragment: 'jouer-et-apprendre' },
    { label: 'Mes progrès', icon: 'chart', link: '/enfant', fragment: 'mes-derniers-jeux' },
    { label: 'Mes récompenses', icon: 'trophy', link: '/enfant', fragment: 'mes-badges' },
  ];
  private readonly auth = inject(AuthFlowsService);
  private readonly router = inject(Router);

  constructor() {
    this.immersive.set(this.isGameRoute(this.router.url));
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.immersive.set(this.isGameRoute(event.urlAfterRedirects)));
  }

  ngOnInit(): void {
    this.ctx.load();
  }

  protected leave(): void {
    this.auth.logoutChild();
  }

  private isGameRoute(url: string): boolean {
    return url.split(/[?#]/, 1)[0]?.startsWith('/enfant/jouer/') ?? false;
  }
}
