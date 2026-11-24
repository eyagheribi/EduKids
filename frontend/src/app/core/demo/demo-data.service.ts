import { inject, Injectable } from '@angular/core';
import { GameType, SESSION_RULES, tokenizeSentence } from '../models/activites.models';
import { EspacesActivite } from '../models/espaces.models';
import { FinalStatus } from '../models/suivi.models';
import { uuid } from '../../shared/utils/ids';
import { evaluateExpression } from '../../shared/utils/math-expression';
import { normalizeContent } from './demo-engines';
import { DemoCompletedSession, DemoGame, DemoStore } from './demo-store';

interface SeedGame {
  readonly type: GameType;
  readonly title: string;
  readonly content: unknown;
}

const SEED_GAMES: readonly SeedGame[] = [
  { type: 'MATH', title: 'Les additions', content: { expression: '12 + 7' } },
  { type: 'MATH', title: 'Calcul malin', content: { expression: '4 * (3 + 2)' } },
  {
    type: 'MATCHING',
    title: 'Les couleurs en anglais',
    content: {
      pairs: [
        { left: 'Rouge', right: 'Red' },
        { left: 'Bleu', right: 'Blue' },
        { left: 'Vert', right: 'Green' },
        { left: 'Jaune', right: 'Yellow' },
      ],
    },
  },
  {
    type: 'MATCHING',
    title: 'Les animaux et leurs petits',
    content: {
      pairs: [
        { left: 'Chat', right: 'Chaton' },
        { left: 'Chien', right: 'Chiot' },
        { left: 'Vache', right: 'Veau' },
      ],
    },
  },
  { type: 'SENTENCE_ORDERING', title: 'Ma première phrase', content: { sentence: 'Le chat dort sur le canapé.' } },
];

const TYPE_TO_ACTIVITE: Readonly<Record<GameType, EspacesActivite | null>> = {
  MATH: 'Maths',
  MATCHING: 'Association',
  SENTENCE_ORDERING: null, // cannot be activated in Espaces.Api: always available in demo mode
};

// ─────────────────────────────────────────────────────────────────────────────
// DEMONSTRATION ONLY — explicit, user-triggered helpers for the demo gateways.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly store = inject(DemoStore);

  /** Number of demo records of a space (games + completed sessions). */
  count(spaceId: string): { games: number; sessions: number } {
    const state = this.store.read();
    return {
      games: state.games.filter((g) => g.spaceId === spaceId).length,
      sessions: state.completed.filter((c) => c.spaceId === spaceId).length,
    };
  }

  /**
   * Generates sample games (for the activated categories) and ~3 weeks of completed sessions so the
   * progress dashboard can be explored. Everything is flagged `seeded` and stays in this browser.
   */
  seed(spaceId: string, activites: readonly EspacesActivite[]): void {
    const allowed = SEED_GAMES.filter((g) => {
      const key = TYPE_TO_ACTIVITE[g.type];
      return key === null || activites.includes(key);
    });
    if (!allowed.length) return;

    const now = Date.now();
    const games: DemoGame[] = allowed.map((g, i) => {
      const created = new Date(now - (24 - i) * 24 * 3_600_000).toISOString();
      return {
        id: uuid(),
        spaceId,
        type: g.type,
        title: g.title,
        content: normalizeContent(g.type, g.content),
        createdAt: created,
        updatedAt: created,
        seeded: true,
      };
    });

    // Deterministic pattern: success rate improves over time.
    const statuses: FinalStatus[] = [
      'FAILED', 'SUCCESS', 'UNFINISHED', 'SUCCESS', 'FAILED', 'SUCCESS', 'SUCCESS', 'FAILED',
      'SUCCESS', 'SUCCESS', 'UNFINISHED', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'FAILED', 'SUCCESS',
      'SUCCESS', 'SUCCESS',
    ];
    const completed: DemoCompletedSession[] = statuses.map((status, i) => {
      const game = games[i % games.length] as DemoGame;
      const dayOffset = 20 - Math.round((i * 20) / statuses.length);
      const startedAt = now - dayOffset * 24 * 3_600_000 - ((i * 37) % 300) * 60_000 - 2 * 3_600_000;
      return this.fakeSession(game, status, startedAt, i);
    });

    this.store.write((s) => {
      s.games.push(...games);
      s.completed.push(...completed);
    });
  }

  /** Removes demo games, sessions and progress of one space (or of every space). */
  clear(spaceId?: string): void {
    this.store.clear(spaceId);
  }

  /** Lifts demo cooldowns (FAILED / UNFINISHED) so games can be replayed immediately. */
  liftCooldowns(spaceId?: string): number {
    return this.store.write((s) => {
      let lifted = 0;
      for (const session of s.sessions) {
        if ((!spaceId || session.spaceId === spaceId) && session.nextAvailableAt) {
          session.nextAvailableAt = new Date(Date.now() - 1000).toISOString();
          lifted++;
        }
      }
      return lifted;
    });
  }

  private fakeSession(game: DemoGame, status: FinalStatus, startedAt: number, index: number): DemoCompletedSession {
    const maxScore = maxScoreOf(game);
    const attemptsUsed = status === 'SUCCESS' ? 1 + (index % 3) : status === 'FAILED' ? SESSION_RULES.maxAttempts : 1 + (index % 2);
    const attempts = Array.from({ length: attemptsUsed }, (_, n) => {
      const last = n === attemptsUsed - 1;
      const correct = status === 'SUCCESS' && last;
      const score = correct ? maxScore : Math.max(0, maxScore - 1 - ((index + n) % Math.max(1, maxScore)));
      return {
        attemptId: uuid(),
        attemptNumber: n + 1,
        submittedAnswer: JSON.stringify(fakeAnswer(game, correct, n)),
        correct,
        score,
        maxScore,
        submittedAt: new Date(startedAt + (n + 1) * 70_000).toISOString(),
      };
    });
    const lastAttempt = attempts[attempts.length - 1];
    const completedAt =
      status === 'UNFINISHED'
        ? startedAt + attemptsUsed * 70_000 + SESSION_RULES.inactivityTimeoutMinutes * 60_000
        : startedAt + attemptsUsed * 70_000;
    return {
      sessionId: uuid(),
      gameId: game.id,
      spaceId: game.spaceId,
      gameType: game.type,
      gameTitle: game.title,
      finalStatus: status,
      attemptsUsed,
      maxAttempts: SESSION_RULES.maxAttempts,
      finalScore: lastAttempt?.score ?? 0,
      finalMaxScore: maxScore,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      nextAvailableAt:
        status === 'SUCCESS'
          ? null
          : new Date(completedAt + SESSION_RULES.failureCooldownHours * 3_600_000).toISOString(),
      gameContentSnapshot: JSON.stringify(game.content),
      attempts,
      seeded: true,
    };
  }
}

function maxScoreOf(game: DemoGame): number {
  const content = game.content as { pairs?: unknown[]; sentence?: string };
  if (game.type === 'MATCHING') return content.pairs?.length ?? 2;
  if (game.type === 'SENTENCE_ORDERING') return tokenizeSentence(content.sentence ?? '').length;
  return 1;
}

function fakeAnswer(game: DemoGame, correct: boolean, n: number): unknown {
  const content = game.content as { expression?: string; pairs?: { id: string }[]; sentence?: string };
  switch (game.type) {
    case 'MATH': {
      const expected = evaluateExpression(content.expression ?? '0');
      return { value: correct ? expected : expected + (n % 2 === 0 ? 1 : -2) };
    }
    case 'MATCHING':
      // Session tokens are random per session in Activites.Api, so identifiers are opaque.
      return { matches: Object.fromEntries((content.pairs ?? []).map(() => [uuid(), uuid()])) };
    case 'SENTENCE_ORDERING':
      return { tokens: tokenizeSentence(content.sentence ?? '').map(() => uuid()) };
  }
}
