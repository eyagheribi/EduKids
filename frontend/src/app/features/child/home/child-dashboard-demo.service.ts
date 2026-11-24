import { inject, Injectable } from '@angular/core';
import { APP_CONFIG } from '../../../core/config/app-config';
import { DemoStore } from '../../../core/demo/demo-store';
import { ChildAchievementBadge, ChildStarRewardGoal } from '../../../core/models/child-rewards.models';
import { GameType, SESSION_RULES } from '../../../core/models/activites.models';
import { findCharacter } from '../../../shared/ui/character/characters';

export interface ResumableDemoGame {
  readonly gameId: string;
  readonly title: string;
  readonly type: GameType;
  readonly attemptsUsed: number;
  readonly maxAttempts: number;
}

export interface ChildDashboardBadge {
  readonly id: string;
  readonly title: string;
  readonly icon: 'star' | 'calendar' | 'trophy' | 'calculator' | 'gamepad';
  readonly unlocked: boolean;
}

const DEMO_BADGES: readonly ChildDashboardBadge[] = [
  { id: 'first-success', title: 'Premier jeu réussi', icon: 'star', unlocked: true },
  { id: 'three-games', title: 'Série de 3 jeux', icon: 'gamepad', unlocked: true },
  { id: 'regular-player', title: 'Joueur régulier', icon: 'calendar', unlocked: true },
  { id: 'ten-games', title: '10 jeux joués', icon: 'trophy', unlocked: false },
  { id: 'maths-champion', title: 'Champion des maths', icon: 'calculator', unlocked: false },
];

const DEMO_CHARACTER_KEY = 'edukids.demo.child-character.v1';

/** Isolated browser-only examples for child rewards, badges and demo-only session discovery. */
@Injectable({ providedIn: 'root' })
export class ChildDashboardDemoService {
  private readonly store = inject(DemoStore);
  private readonly gamesMode = inject(APP_CONFIG).integrations.games;

  rewardGoalFor(spaceId: string): ChildStarRewardGoal {
    return {
      id: `demo-reward-${spaceId}`,
      spaceId,
      targetStars: 200,
      earnedStars: 126,
      promisedReward: 'Une surprise',
      updatedAt: null,
    };
  }

  badgesFor(_spaceId: string): readonly ChildDashboardBadge[] {
    return DEMO_BADGES;
  }

  /** Active sessions are only enumerable in the local demo store, not through Activites.Api. */
  resumableGameFor(spaceId: string): ResumableDemoGame | null {
    if (this.gamesMode !== 'demo') return null;

    this.store.version();
    const state = this.store.read();
    const now = Date.now();
    const active = state.sessions
      .filter(
        (session) =>
          session.spaceId === spaceId &&
          session.status === 'ACTIVE' &&
          (!session.inactivityDeadlineAt || Date.parse(session.inactivityDeadlineAt) > now),
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    for (const session of active) {
      const game = state.games.find((item) => item.spaceId === spaceId && item.id === session.gameId);
      if (!game) continue;
      return {
        gameId: game.id,
        title: game.title?.trim() || 'Mon jeu',
        type: game.type,
        attemptsUsed: session.attempts.length,
        maxAttempts: SESSION_RULES.maxAttempts,
      };
    }
    return null;
  }

  characterFor(spaceId: string): string {
    try {
      const stored = localStorage.getItem(DEMO_CHARACTER_KEY);
      if (!stored) return '';
      const choices = JSON.parse(stored) as Record<string, unknown>;
      const key = choices[spaceId];
      return typeof key === 'string' && findCharacter(key) ? key : '';
    } catch {
      return '';
    }
  }

  saveCharacter(spaceId: string, key: string): void {
    if (!findCharacter(key)) throw new Error('Personnage de démonstration inconnu.');

    try {
      const stored = localStorage.getItem(DEMO_CHARACTER_KEY);
      const choices = stored ? (JSON.parse(stored) as Record<string, unknown>) : {};
      localStorage.setItem(DEMO_CHARACTER_KEY, JSON.stringify({ ...choices, [spaceId]: key }));
    } catch {
      // Character selection remains in memory when browser storage is unavailable.
    }
  }
}
