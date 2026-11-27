import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { AuthFlowsService } from '../../../core/auth/auth-flows.service';
import { SessionService } from '../../../core/auth/session.service';
import { LogoComponent } from '../../../shared/ui/brand/logo.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IconName } from '../../../shared/ui/icon/icon.data';
import { IllustrationComponent } from '../../../shared/ui/illustration/illustration.component';

interface NavItem {
  readonly label: string;
  readonly icon: IconName;
  readonly link: string;
  readonly exact?: boolean;
}

@Component({
  selector: 'ek-parent-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    LogoComponent,
    IconComponent,
    IllustrationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-shell.component.html',
  styleUrl: './parent-shell.component.scss',
})
export class ParentShellComponent {
  private readonly auth = inject(AuthFlowsService);
  private readonly session = inject(SessionService);

  protected readonly nav: readonly NavItem[] = [
    { label: 'Accueil', icon: 'home', link: '/parent/accueil' },
    { label: 'Mes enfants', icon: 'users', link: '/parent/enfants' },
    { label: 'Jeux éducatifs', icon: 'gamepad', link: '/parent/jeux' },
    { label: 'Suivi des progrès', icon: 'chart', link: '/parent/progres' },
    { label: 'Paramètres', icon: 'settings', link: '/parent/parametres' },
  ];

  protected readonly drawerOpen = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly displayName = computed(() => {
    this.session.parent(); // re-evaluate on session change
    return this.auth.parentDisplayName();
  });
  protected readonly email = computed(() => this.session.parent()?.email ?? '');

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.drawerOpen.set(false);
        this.notificationsOpen.set(false);
      });
  }

  protected logout(): void {
    this.auth.logoutParent();
  }
}
