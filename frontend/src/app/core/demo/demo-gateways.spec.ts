import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api-error';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { readProp, SessionDto } from '../models/activites.models';
import { DemoGamesGateway } from './demo-games.gateway';
import { DemoProgressGateway } from './demo-progress.gateway';
import { DemoStore } from './demo-store';

const config: AppConfig = {
  production: false,
  services: { comptes: '', espaces: '', activites: '', suivi: '' },
  integrations: { games: 'demo', progress: 'demo' },
  demo: { latencyMs: 0 },
};

const SPACE = 'space-1';

describe('Demo gateways (Activites/Suivi rules)', () => {
  let games: DemoGamesGateway;
  let progress: DemoProgressGateway;
  let store: DemoStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: APP_CONFIG, useValue: config }] });
    games = TestBed.inject(DemoGamesGateway);
    progress = TestBed.inject(DemoProgressGateway);
    store = TestBed.inject(DemoStore);
  });

  const createMath = (expression = '2 + 2') =>
    firstValueFrom(games.createGame(SPACE, { type: 'MATH', title: 'Calcul', content: { expression } }));
  const submit = (session: SessionDto, value: number, key: string) =>
    firstValueFrom(games.submitAttempt(SPACE, session.id, { idempotencyKey: key, answer: { value } }));

  it('validates content with the backend messages', async () => {
    await expect(createMath('4++*3')).rejects.toMatchObject({ status: 400, message: 'Nombre attendu à la position 4.' });
    await expect(
      firstValueFrom(
        games.createGame(SPACE, { type: 'MATCHING', title: null, content: { pairs: [{ left: 'a', right: 'b' }] } }),
      ),
    ).rejects.toMatchObject({ message: 'Un jeu MATCHING doit contenir au moins deux paires.' });
  });

  it('succeeds on a correct answer and records the completion for Suivi', async () => {
    const game = await createMath();
    const session = await firstValueFrom(games.startSession(SPACE, game.id));
    expect(session.status).toBe('ACTIVE');
    expect(readProp(session.game?.content, 'expression')).toBe('2 + 2');

    const attempt = await submit(session, 4, 'k1');
    expect(attempt).toMatchObject({ correct: true, score: 1, maxScore: 1, status: 'SUCCESS', correction: null });

    const summary = await firstValueFrom(progress.summary(SPACE));
    expect(summary).toMatchObject({ totalSessions: 1, successfulSessions: 1, successRate: 100, averageNormalizedScore: 1 });
  });

  it('fails after three wrong answers, reveals the correction and blocks replay 24 h', async () => {
    const game = await createMath();
    const session = await firstValueFrom(games.startSession(SPACE, game.id));
    const first = await submit(session, 5, 'a');
    expect(first).toMatchObject({ status: 'ACTIVE', attemptsRemaining: 2, correction: null });

    const afterFirst = await firstValueFrom(games.getSession(SPACE, session.id));
    expect(afterFirst.inactivityDeadlineAt).not.toBeNull();

    await submit(session, 5, 'b');
    const last = await submit(session, 5, 'c');
    expect(last).toMatchObject({ status: 'FAILED', attemptsRemaining: 0, correction: 4 });
    expect(Date.parse(last.nextAvailableAt ?? '') - Date.parse(last.submittedAt)).toBe(24 * 3_600_000);

    await expect(firstValueFrom(games.startSession(SPACE, game.id))).rejects.toMatchObject({ status: 409 });
    const availability = await firstValueFrom(games.availability(SPACE, game.id, 'child'));
    expect(availability.available).toBe(false);
  });

  it('is idempotent per IdempotencyKey', async () => {
    const game = await createMath();
    const session = await firstValueFrom(games.startSession(SPACE, game.id));
    const a = await submit(session, 5, 'same');
    const b = await submit(session, 5, 'same');
    expect(b).toEqual(a);
    expect((await firstValueFrom(games.getSession(SPACE, session.id))).attemptsUsed).toBe(1);
  });

  it('resumes the active session instead of creating a new one', async () => {
    const game = await createMath();
    const a = await firstValueFrom(games.startSession(SPACE, game.id));
    const b = await firstValueFrom(games.startSession(SPACE, game.id));
    expect(b.id).toBe(a.id);
  });

  it('turns an inactive session into UNFINISHED after its deadline', async () => {
    const game = await createMath();
    const session = await firstValueFrom(games.startSession(SPACE, game.id));
    await submit(session, 9, 'wrong');
    store.write((s) => {
      const target = s.sessions.find((x) => x.id === session.id);
      if (target) target.inactivityDeadlineAt = new Date(Date.now() - 1000).toISOString();
    });
    const expired = await firstValueFrom(games.getSession(SPACE, session.id));
    expect(expired.status).toBe('UNFINISHED');
    expect(expired.game).toBeNull();
    await expect(submit(session, 4, 'late')).rejects.toMatchObject({ status: 409, message: 'Cette session est terminée.' });
    const history = await firstValueFrom(progress.history(SPACE, { finalStatus: 'UNFINISHED' }));
    expect(history.totalCount).toBe(1);
  });

  it('scores MATCHING pairs and SENTENCE_ORDERING like the engines', async () => {
    const matching = await firstValueFrom(
      games.createGame(SPACE, {
        type: 'MATCHING',
        title: 'Couleurs',
        content: { pairs: [{ left: 'Rouge', right: 'Red' }, { left: 'Bleu', right: 'Blue' }] },
      }),
    );
    const ms = await firstValueFrom(games.startSession(SPACE, matching.id));
    const left = readProp(ms.game?.content, 'Left') as { Id: string; Left: string }[];
    const right = readProp(ms.game?.content, 'Right') as { Id: string; Left: string }[];
    expect(left).toHaveLength(2);
    await expect(
      firstValueFrom(games.submitAttempt(SPACE, ms.id, { idempotencyKey: 'm1', answer: { matches: {} } })),
    ).rejects.toMatchObject({ message: 'Soumettez une association pour chaque paire.' });

    // Deliberately wrong: pair every left item with the same-index right item, then check score bounds.
    const wrong = await firstValueFrom(
      games.submitAttempt(SPACE, ms.id, {
        idempotencyKey: 'm2',
        answer: { matches: { [left[0]!.Id]: right[0]!.Id, [left[1]!.Id]: right[1]!.Id } },
      }),
    );
    expect(wrong.maxScore).toBe(2);
    expect([0, 2]).toContain(wrong.score);

    const sentence = await firstValueFrom(
      games.createGame(SPACE, { type: 'SENTENCE_ORDERING', title: null, content: { sentence: 'Le chat dort.' } }),
    );
    const ss = await firstValueFrom(games.startSession(SPACE, sentence.id));
    const tokens = readProp(ss.game?.content, 'Tokens') as string[];
    const result = await firstValueFrom(
      games.submitAttempt(SPACE, ss.id, { idempotencyKey: 's1', answer: { tokens } }),
    );
    // The shuffled order is never the correct one: full-length wrong answer scores n - 1.
    expect(result).toMatchObject({ correct: false, score: 2, maxScore: 3 });
  });

  it('refuses to delete a game that was already played', async () => {
    const game = await createMath();
    const session = await firstValueFrom(games.startSession(SPACE, game.id));
    await expect(firstValueFrom(games.deleteGame(SPACE, game.id))).rejects.toMatchObject({
      status: 409,
      message: 'Le jeu possède une session active.',
    });
    await submit(session, 4, 'ok');
    const error = await firstValueFrom(games.deleteGame(SPACE, game.id)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);

    const fresh = await createMath('1 + 1');
    await firstValueFrom(games.deleteGame(SPACE, fresh.id));
    await expect(firstValueFrom(games.getGame(SPACE, fresh.id, 'parent'))).rejects.toMatchObject({ status: 404 });
  });
});
