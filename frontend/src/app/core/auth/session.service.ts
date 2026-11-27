import { computed, Injectable, signal } from '@angular/core';
import { Audience } from './auth-context';
import { decodeJwt, tokenExpiry } from './jwt';

export interface ParentSession {
  readonly token: string;
  readonly userId: string;
  readonly email: string;
  readonly expiresAt: number;
}

export interface ChildSession {
  readonly token: string;
  readonly spaceId: string;
  readonly nomEnfant: string;
  readonly expiresAt: number;
}

export type SessionEndReason = 'logout' | 'expired';

const PARENT_KEY = 'edukids.session.parent';
const CHILD_KEY = 'edukids.session.child';
/** Tokens expiring in less than this are treated as expired. */
const EXPIRY_SKEW_MS = 15_000;

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the session then lives in memory only.
  }
}

/**
 * Holds the two independent sessions of EduKids: the parent (Comptes.Api JWT) and the child
 * (Espaces.Api access-code JWT). Both can coexist in the same browser.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  /** Why the last session of each audience ended (shown on the login pages). */
  private readonly endReasons = signal<Partial<Record<Audience, SessionEndReason>>>({});
  private readonly parentState = signal<ParentSession | null>(this.restore<ParentSession>(PARENT_KEY, 'parent'));
  private readonly childState = signal<ChildSession | null>(this.restore<ChildSession>(CHILD_KEY, 'child'));

  readonly parent = this.parentState.asReadonly();
  readonly child = this.childState.asReadonly();
  readonly isParentAuthenticated = computed(() => this.isValid(this.parentState()));
  readonly isChildAuthenticated = computed(() => this.isValid(this.childState()));

  /** Stores a parent token issued by POST /auth/login. Throws if it is not a valid parent token. */
  startParentSession(token: string, email: string): ParentSession {
    const payload = decodeJwt(token);
    const expiresAt = tokenExpiry(payload);
    if (!payload?.sub || payload.role !== 'Parent' || !expiresAt) {
      throw new Error('Jeton parent invalide.');
    }
    const session: ParentSession = { token, userId: payload.sub, email: email.trim(), expiresAt };
    this.parentState.set(session);
    writeStorage(PARENT_KEY, session);
    this.clearReason('parent');
    return session;
  }

  /** Stores a child token issued by POST /acces/code. Throws if it is not a valid child token. */
  startChildSession(token: string, nomEnfant: string): ChildSession {
    const payload = decodeJwt(token);
    const expiresAt = tokenExpiry(payload);
    const spaceId = typeof payload?.espaceId === 'string' ? payload.espaceId : payload?.sub;
    if (!spaceId || payload?.role !== 'Enfant' || !expiresAt) {
      throw new Error('Jeton enfant invalide.');
    }
    const session: ChildSession = { token, spaceId, nomEnfant, expiresAt };
    this.childState.set(session);
    writeStorage(CHILD_KEY, session);
    this.clearReason('child');
    return session;
  }

  /** Updates the cached child name (e.g. after GET /mon-espace). */
  updateChildName(nomEnfant: string): void {
    const current = this.childState();
    if (!current || current.nomEnfant === nomEnfant) return;
    const next = { ...current, nomEnfant };
    this.childState.set(next);
    writeStorage(CHILD_KEY, next);
  }

  end(audience: Audience, reason: SessionEndReason = 'logout'): void {
    if (audience === 'parent') {
      this.parentState.set(null);
      writeStorage(PARENT_KEY, null);
    } else {
      this.childState.set(null);
      writeStorage(CHILD_KEY, null);
    }
    this.endReasons.update((r) => ({ ...r, [audience]: reason }));
  }

  /** Returns the bearer token if the session is still valid; ends an expired session. */
  tokenFor(audience: Audience): string | null {
    const session = audience === 'parent' ? this.parentState() : this.childState();
    if (!session) return null;
    if (!this.isValid(session)) {
      this.end(audience, 'expired');
      return null;
    }
    return session.token;
  }

  /** Checks the stored session and ends it if expired. */
  ensureValid(audience: Audience): boolean {
    return this.tokenFor(audience) !== null;
  }

  /** Reason of the last session end, consumed once by the login page. */
  consumeEndReason(audience: Audience): SessionEndReason | null {
    const reason = this.endReasons()[audience] ?? null;
    this.clearReason(audience);
    return reason;
  }

  private clearReason(audience: Audience): void {
    this.endReasons.update((r) => {
      const next = { ...r };
      delete next[audience];
      return next;
    });
  }

  private isValid(session: { expiresAt: number } | null): boolean {
    return !!session && session.expiresAt - EXPIRY_SKEW_MS > Date.now();
  }

  private restore<T extends { token: string; expiresAt: number }>(key: string, audience: Audience): T | null {
    const stored = readStorage<T>(key);
    if (!stored?.token || typeof stored.expiresAt !== 'number') return null;
    if (stored.expiresAt - EXPIRY_SKEW_MS <= Date.now()) {
      writeStorage(key, null);
      this.endReasons.update((r) => ({ ...r, [audience]: 'expired' }));
      return null;
    }
    return stored;
  }
}
