import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthFlowsService } from '../../../core/auth/auth-flows.service';
import { LogoComponent } from '../../../shared/ui/brand/logo.component';
import { CharacterComponent } from '../../../shared/ui/character/character.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ChildContext } from '../child-context';

/** Playful frame of the child area; provides ChildContext to every child page. */
@Component({
  selector: 'ek-child-shell',
  imports: [RouterOutlet, RouterLink, LogoComponent, CharacterComponent, IconComponent],
  providers: [ChildContext],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sky" aria-hidden="true">
      <span class="blob blob--1"></span>
      <span class="blob blob--2"></span>
      <span class="star star--1">★</span>
      <span class="star star--2">✦</span>
      <span class="star star--3">★</span>
    </div>

    <header class="bar">
      <a routerLink="/enfant" class="home-link" aria-label="Mon espace EduKids"><ek-logo size="sm" /></a>
      <div class="me">
        <a routerLink="/enfant/personnage" class="me__character" aria-label="Changer de personnage">
          <ek-character [key]="ctx.space()?.personnagePrefere" [size]="40" [framed]="true" />
        </a>
        <span class="me__name">{{ ctx.firstName() }}</span>
        <button type="button" class="ek-btn ek-btn--outline ek-btn--sm" (click)="leave()">
          <ek-icon name="door" [size]="18" /> Quitter
        </button>
      </div>
    </header>

    <main class="content" id="contenu-enfant">
      <router-outlet />
    </main>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      overflow-x: hidden;
      background: linear-gradient(180deg, #f6f0ff 0%, #fbf9ff 45%, #f1fbf3 100%);
    }
    .sky {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }
    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(2px);
    }
    .blob--1 {
      width: 420px;
      height: 420px;
      top: -160px;
      right: -120px;
      background: radial-gradient(circle, rgba(196, 169, 246, 0.45), transparent 70%);
    }
    .blob--2 {
      width: 380px;
      height: 380px;
      bottom: -160px;
      left: -120px;
      background: radial-gradient(circle, rgba(143, 215, 158, 0.35), transparent 70%);
    }
    .star {
      position: absolute;
      color: var(--ek-yellow-400);
      font-size: 1.6rem;
      animation: ek-float 6s ease-in-out infinite;
      opacity: 0.8;
    }
    .star--1 {
      top: 18%;
      left: 6%;
    }
    .star--2 {
      top: 30%;
      right: 7%;
      color: var(--ek-purple-300);
      animation-delay: -2s;
    }
    .star--3 {
      bottom: 14%;
      right: 12%;
      font-size: 1.2rem;
      animation-delay: -4s;
    }
    .bar {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem var(--ek-gutter);
    }
    .home-link {
      text-decoration: none;
    }
    .me {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.35rem 0.4rem 0.35rem 0.35rem;
      border-radius: var(--ek-radius-pill);
      background: rgba(255, 255, 255, 0.85);
      box-shadow: var(--ek-shadow-sm);
    }
    .me__character {
      display: inline-flex;
      border-radius: 50%;
      transition: transform var(--ek-duration) var(--ek-ease-bounce);
      &:hover {
        transform: scale(1.08) rotate(-4deg);
      }
    }
    .me__name {
      color: var(--ek-ink);
      font-family: var(--ek-font-display);
      font-weight: 650;
      font-size: 1.15rem;
      @include m.down(xs) {
        display: none;
      }
    }
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0.5rem var(--ek-gutter) 3rem;
    }
  `,
})
export class ChildShellComponent implements OnInit {
  protected readonly ctx = inject(ChildContext);
  private readonly auth = inject(AuthFlowsService);

  ngOnInit(): void {
    this.ctx.load();
  }

  protected leave(): void {
    this.auth.logoutChild();
  }
}
