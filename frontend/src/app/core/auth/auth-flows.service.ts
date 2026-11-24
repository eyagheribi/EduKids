import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, switchMap } from 'rxjs';
import { ComptesApiService } from '../api/comptes-api.service';
import { EspacesApiService } from '../api/espaces-api.service';
import { ChildSession, ParentSession, SessionService } from './session.service';
import { ProfileCacheService } from './profile-cache.service';
import { normalizeAccessCode } from '../models/espaces.models';
import { ChildSpacesStore } from '../state/child-spaces.store';

export interface ParentRegistration {
  readonly nom: string;
  readonly prenom: string;
  readonly email: string;
  readonly motDePasse: string;
}

/** Real sign-in / sign-up / sign-out flows (no simulation: failures propagate as ApiError). */
@Injectable({ providedIn: 'root' })
export class AuthFlowsService {
  private readonly comptes = inject(ComptesApiService);
  private readonly espaces = inject(EspacesApiService);
  private readonly session = inject(SessionService);
  private readonly profiles = inject(ProfileCacheService);
  private readonly router = inject(Router);
  private readonly spaces = inject(ChildSpacesStore);

  /** POST /auth/login then stores the parent session. */
  loginParent(email: string, motDePasse: string): Observable<ParentSession> {
    const cleanEmail = email.trim();
    return this.comptes
      .login({ email: cleanEmail, motDePasse })
      .pipe(map((res) => this.session.startParentSession(res.token, cleanEmail)));
  }

  /** POST /auth/register, then signs in with the same credentials (Comptes.Api returns no token). */
  registerParent(data: ParentRegistration): Observable<ParentSession> {
    const email = data.email.trim();
    return this.comptes
      .register({ email, motDePasse: data.motDePasse, nom: data.nom.trim(), prenom: data.prenom.trim() })
      .pipe(
        switchMap(() => {
          this.profiles.remember(email, { nom: data.nom, prenom: data.prenom });
          return this.loginParent(email, data.motDePasse);
        }),
      );
  }

  logoutParent(): void {
    this.session.end('parent', 'logout');
    this.spaces.reset();
    void this.router.navigateByUrl('/');
  }

  /** POST /acces/code then stores the child session. */
  enterChildSpace(code: string): Observable<ChildSession> {
    return this.espaces
      .accessByCode(normalizeAccessCode(code))
      .pipe(map((res) => this.session.startChildSession(res.token, res.nomEnfant)));
  }

  logoutChild(): void {
    this.session.end('child', 'logout');
    void this.router.navigateByUrl('/');
  }

  /** Display name of the signed-in parent (cached registration name, else e-mail). */
  parentDisplayName(): string {
    const parent = this.session.parent();
    if (!parent) return '';
    const profile = this.profiles.find(parent.email);
    if (profile && (profile.prenom || profile.nom)) {
      return `${profile.prenom} ${profile.nom}`.trim();
    }
    return parent.email;
  }

  /** First name for greetings, or null when unknown. */
  parentFirstName(): string | null {
    const parent = this.session.parent();
    return parent ? (this.profiles.find(parent.email)?.prenom || null) : null;
  }
}
