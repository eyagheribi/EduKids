import { Injectable } from '@angular/core';

export interface CachedProfile {
  readonly nom: string;
  readonly prenom: string;
}

const KEY = 'edukids.profiles';

/**
 * Comptes.Api exposes no profile endpoint (login only returns a token and /auth/me only id+role).
 * The name typed at registration is remembered on this device, keyed by e-mail, so the dashboard
 * can greet the parent. It is never sent anywhere and falls back to the e-mail address.
 */
@Injectable({ providedIn: 'root' })
export class ProfileCacheService {
  remember(email: string, profile: CachedProfile): void {
    const all = this.readAll();
    all[email.trim().toLowerCase()] = { nom: profile.nom.trim(), prenom: profile.prenom.trim() };
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      // ignore unavailable storage
    }
  }

  find(email: string | null | undefined): CachedProfile | null {
    if (!email) return null;
    return this.readAll()[email.trim().toLowerCase()] ?? null;
  }

  private readAll(): Record<string, CachedProfile> {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, CachedProfile>) : {};
    } catch {
      return {};
    }
  }
}
