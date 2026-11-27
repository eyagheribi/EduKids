import { Injectable } from '@angular/core';

const SESSION_KEY_PREFIX = 'edukids.child.active-game-session.v1';

/** Remembers only the last session id so a child can verify/resume it from the category list. */
@Injectable({ providedIn: 'root' })
export class ChildGameSessionRegistry {
  sessionIdFor(spaceId: string, gameId: string): string | null {
    return this.storage().getItem(this.key(spaceId, gameId));
  }

  remember(spaceId: string, gameId: string, sessionId: string): void {
    this.storage().setItem(this.key(spaceId, gameId), sessionId);
  }

  forget(spaceId: string, gameId: string): void {
    this.storage().removeItem(this.key(spaceId, gameId));
  }

  private key(spaceId: string, gameId: string): string {
    return `${SESSION_KEY_PREFIX}:${encodeURIComponent(spaceId)}:${encodeURIComponent(gameId)}`;
  }

  private storage(): Storage {
    if (typeof window === 'undefined') throw new Error('Le stockage de session est indisponible.');
    return window.sessionStorage;
  }
}
