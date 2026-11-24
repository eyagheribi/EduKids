import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError, errorMessage, toApiError } from '../../../core/api/api-error';
import { GamesGateway } from '../../../core/gateways/games.gateway';
import {
  AttemptDto,
  Correction,
  GameAnswer,
  GameType,
  Playable,
  SessionDto,
  toPlayable,
} from '../../../core/models/activites.models';
import { CategoryId, GAME_TYPE_LABELS } from '../../../core/models/categories';
import { ChildDashboardDemoService } from '../home/child-dashboard-demo.service';
import { ChildContext } from '../child-context';
import { CategoryIconComponent } from '../../../shared/ui/category-icon/category-icon.component';
import { CharacterComponent } from '../../../shared/ui/character/character.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IllustrationComponent } from '../../../shared/ui/illustration/illustration.component';
import { LogoComponent } from '../../../shared/ui/brand/logo.component';
import { InactivityCountdownComponent } from './ui/inactivity-countdown.component';
import { PlayEndComponent } from './ui/play-end.component';
import {
  applyKeypadKey,
  normalizeMathInput,
  toMathAnswer,
  type KeypadKey,
} from './math/math-answer';
import {
  EMPTY_MATCHING,
  isMatchingComplete,
  pairColor as colorForPair,
  pairOf,
  tapItem,
  toMatchingAnswer,
  type MatchSide,
  type MatchingState,
} from './matching/matching-state';
import {
  AttemptFeedback,
  attemptsLeft,
  endScreenForSession,
  outcomeOfAttempt,
  PlayScreen,
  submitErrorAction,
  unavailableUntil,
} from './play-model';
import { uuid } from '../../../shared/utils/ids';

interface GameNavigationState {
  readonly gameTitle?: unknown;
  readonly gameType?: unknown;
}

interface PendingAttempt {
  readonly idempotencyKey: string;
  readonly answer: GameAnswer;
}

@Component({
  selector: 'ek-game-player-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    CategoryIconComponent,
    CharacterComponent,
    IconComponent,
    IllustrationComponent,
    LogoComponent,
    InactivityCountdownComponent,
    PlayEndComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-player.page.html',
  styleUrl: './game-player.page.scss',
})
export class GamePlayerPage {
  protected readonly ctx = inject(ChildContext);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly gateway = inject(GamesGateway);
  private readonly demoRewards = inject(ChildDashboardDemoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gameId = this.route.snapshot.paramMap.get('gameId') ?? '';
  private readonly navigationState = this.location.getState() as GameNavigationState | null;
  private pendingAttempt: PendingAttempt | null = null;

  protected readonly session = signal<SessionDto | null>(null);
  protected readonly screen = signal<PlayScreen>({ kind: 'loading' });
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly answer = signal<GameAnswer | null>(null);
  protected readonly feedback = signal<AttemptFeedback | null>(null);
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly retryPending = signal(false);
  protected readonly starsAwardedThisSession = signal(false);
  protected readonly mathAnswer = signal('');
  protected readonly textAnswer = signal('');
  protected readonly matchingState = signal<MatchingState>(EMPTY_MATCHING);
  protected readonly orderedIds = signal<readonly string[]>([]);

  protected readonly playable = computed(() => toPlayable(this.session()?.game));
  protected readonly orderedTokens = computed(() => {
    const game = this.playable();
    if (game?.type !== 'SENTENCE_ORDERING') return [];
    const byId = new Map(game.tokens.map((token) => [token.id, token]));
    return this.orderedIds()
      .map((id) => byId.get(id))
      .filter((token): token is NonNullable<typeof token> => !!token);
  });
  protected readonly orderedSentence = computed(() => this.orderedTokens().map((token) => token.label).join(' '));
  protected readonly titleFromRoute = signal(
    typeof this.navigationState?.gameTitle === 'string' ? this.navigationState.gameTitle.trim() : '',
  );
  protected readonly gameTypeFromRoute = signal<GameType | null>(
    this.isGameType(this.navigationState?.gameType) ? this.navigationState.gameType : null,
  );
  protected readonly categoryLabel = computed(() => {
    const type = this.playable()?.type ?? this.gameTypeFromRoute();
    return type ? GAME_TYPE_LABELS[type] : 'Jeux éducatifs';
  });
  protected readonly categoryId = computed<CategoryId | null>(() => {
    const type = this.playable()?.type ?? this.gameTypeFromRoute();
    if (type === 'MATH') return 'maths';
    if (type === 'MATCHING') return 'association';
    if (type === 'SENTENCE_ORDERING') return 'ordonnancement';
    if (type === 'DICTATION') return 'dictee';
    return null;
  });
  protected readonly title = computed(
    () => this.titleFromRoute() || this.categoryLabel(),
  );
  protected readonly demoStars = computed(() =>
    this.gateway.mode === 'demo' && this.ctx.spaceId()
      ? this.demoRewards.rewardGoalFor(this.ctx.spaceId())
      : null,
  );
  protected readonly remainingAttempts = computed(() => attemptsLeft(this.session()));
  protected readonly attemptSlots = computed(() =>
    Array.from({ length: this.session()?.maxAttempts ?? 0 }, (_, index) => index),
  );
  protected readonly nextAvailableAt = computed(() => {
    const screen = this.screen();
    return screen.kind === 'failed' || screen.kind === 'unfinished' || screen.kind === 'unavailable'
      ? screen.nextAvailableAt
      : null;
  });
  protected readonly scoreText = computed(() => {
    const screen = this.screen();
    return screen.kind === 'success' && screen.score !== null && screen.maxScore !== null
      ? `${screen.score} / ${screen.maxScore}`
      : null;
  });
  protected readonly correctionText = computed(() => {
    const screen = this.screen();
    return screen.kind === 'failed' ? this.formatCorrection(screen.correction) : '';
  });
  protected readonly mathKeypad: readonly { readonly key: KeypadKey; readonly label: string; readonly ariaLabel: string }[] = [
    { key: '1', label: '1', ariaLabel: 'Un' },
    { key: '2', label: '2', ariaLabel: 'Deux' },
    { key: '3', label: '3', ariaLabel: 'Trois' },
    { key: '4', label: '4', ariaLabel: 'Quatre' },
    { key: '5', label: '5', ariaLabel: 'Cinq' },
    { key: '6', label: '6', ariaLabel: 'Six' },
    { key: '7', label: '7', ariaLabel: 'Sept' },
    { key: '8', label: '8', ariaLabel: 'Huit' },
    { key: '9', label: '9', ariaLabel: 'Neuf' },
    { key: '-', label: '±', ariaLabel: 'Changer le signe' },
    { key: '0', label: '0', ariaLabel: 'Zéro' },
    { key: ',', label: ',', ariaLabel: 'Virgule décimale' },
  ];

  constructor() {
    this.startOrResume();
  }

  protected setAnswer(answer: GameAnswer | null): void {
    this.answer.set(answer);
    if (!this.pendingAttempt) this.errorMessage.set('');
  }

  protected onMathInput(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    this.setMathAnswer(normalizeMathInput(input.value));
    input.value = this.mathAnswer();
  }

  protected onMathKey(key: KeypadKey): void {
    this.setMathAnswer(applyKeypadKey(this.mathAnswer(), key));
  }

  protected clearMathAnswer(): void {
    this.setMathAnswer('');
  }

  private setMathAnswer(value: string): void {
    this.mathAnswer.set(value);
    this.setAnswer(toMathAnswer(value));
  }

  protected onTextAnswer(value: string): void {
    this.textAnswer.set(value);
    const text = value.trim();
    this.setAnswer(text ? { text } : null);
  }

  protected matchPair(side: MatchSide, id: string) {
    return pairOf(this.matchingState(), side, id) ?? null;
  }

  protected pairColor(slot: number) {
    return colorForPair(slot);
  }

  protected tapMatch(side: MatchSide, id: string): void {
    const next = tapItem(this.matchingState(), side, id);
    this.matchingState.set(next);
    const game = this.playable();
    this.setAnswer(
      game?.type === 'MATCHING' && isMatchingComplete(next, game.left.map((item) => item.id))
        ? toMatchingAnswer(next)
        : null,
    );
  }

  protected resetMatches(): void {
    this.matchingState.set(EMPTY_MATCHING);
    this.setAnswer(null);
  }

  protected moveToken(id: string): void {
    this.orderedIds.update((ids) => {
      const index = ids.indexOf(id);
      return index < 0 ? ids : [...ids.slice(index + 1), ...ids.slice(0, index + 1)];
    });
    const game = this.playable();
    if (game?.type === 'SENTENCE_ORDERING') this.setAnswer({ tokens: [...this.orderedIds()] });
  }

  protected resetOrder(): void {
    const game = this.playable();
    if (game?.type !== 'SENTENCE_ORDERING') return;
    this.orderedIds.set(game.tokens.map((token) => token.id));
    this.setAnswer({ tokens: [...this.orderedIds()] });
  }

  protected retryStart(): void {
    this.startOrResume();
  }

  protected replay(): void {
    this.startOrResume();
  }

  protected submitAnswer(): void {
    const session = this.session();
    const game = this.playable();
    if (!session || !game || this.busy() || this.screen().kind !== 'playing') return;

    if (!this.pendingAttempt) {
      const answer = this.answer();
      if (!answer) {
        this.errorMessage.set('Complète ta réponse avant de la valider.');
        return;
      }
      this.pendingAttempt = { idempotencyKey: uuid(), answer };
    }

    this.busy.set(true);
    this.errorMessage.set('');
    this.gateway
      .submitAttempt(this.ctx.spaceId(), session.id, this.pendingAttempt)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (attempt) => this.handleAttempt(game, session, attempt),
        error: (error: unknown) => this.handleSubmitError(error, session),
      });
  }

  protected refreshSession(): void {
    const session = this.session();
    if (!session || this.busy()) return;
    this.busy.set(true);
    this.statusMessage.set('On vérifie ta partie…');
    this.gateway
      .getSession(this.ctx.spaceId(), session.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.statusMessage.set('');
          this.updateSession(updated);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.statusMessage.set('');
          this.errorMessage.set(`Impossible de vérifier l’état de la partie : ${errorMessage(error)}`);
        },
      });
  }

  protected onCountdownExpired(): void {
    this.refreshSession();
  }

  protected retryPendingAttempt(): void {
    this.submitAnswer();
  }

  protected speak(sentence: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.statusMessage.set('La lecture audio n’est pas disponible dans ce navigateur.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  }

  private startOrResume(): void {
    if (!this.gameId || !this.ctx.spaceId()) {
      this.loading.set(false);
      this.screen.set({ kind: 'missing' });
      return;
    }

    this.loading.set(true);
    this.busy.set(false);
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.session.set(null);
    this.answer.set(null);
    this.mathAnswer.set('');
    this.textAnswer.set('');
    this.matchingState.set(EMPTY_MATCHING);
    this.orderedIds.set([]);
    this.feedback.set(null);
    this.pendingAttempt = null;
    this.retryPending.set(false);
    this.starsAwardedThisSession.set(false);
    this.screen.set({ kind: 'loading' });
    this.gateway
      .startSession(this.ctx.spaceId(), this.gameId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.loading.set(false);
          this.updateSession(session);
          if (session.game?.type) this.gameTypeFromRoute.set(session.game.type);
          if (session.status === 'ACTIVE' && session.game) {
            const game = toPlayable(session.game);
            if (!game) {
              this.screen.set({ kind: 'error', error: 'Le contenu de ce jeu ne peut pas être affiché.' });
              return;
            }
            if (game.type === 'SENTENCE_ORDERING') {
              const ids = game.tokens.map((token) => token.id);
              this.orderedIds.set(ids);
              this.setAnswer({ tokens: ids });
            }
            this.screen.set({ kind: 'playing' });
            return;
          }
          this.screen.set(endScreenForSession(session) ?? { kind: 'error', error: 'La session n’est pas disponible.' });
        },
        error: (error: unknown) => this.handleStartError(error),
      });
  }

  private handleStartError(error: unknown): void {
    this.loading.set(false);
    const apiError = toApiError(error, 'activites');
    if (apiError.isNotFound) {
      this.screen.set({ kind: 'missing' });
      return;
    }
    if (apiError.isConflict) {
      this.checkAvailability(apiError);
      return;
    }
    this.errorMessage.set(apiError.message);
    this.screen.set({ kind: 'error', error: apiError });
  }

  private checkAvailability(startError: ApiError): void {
    this.busy.set(true);
    this.gateway
      .availability(this.ctx.spaceId(), this.gameId, 'child')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (availability) => {
          this.busy.set(false);
          if (!availability.available) {
            this.screen.set({
              kind: 'unavailable',
              nextAvailableAt: availability.nextAvailableAt ?? unavailableUntil(startError.message),
            });
            return;
          }
          this.errorMessage.set(startError.message);
          this.screen.set({ kind: 'error', error: startError });
        },
        error: (availabilityError: unknown) => {
          this.busy.set(false);
          this.errorMessage.set(
            `${startError.message} La disponibilité n’a pas pu être vérifiée : ${errorMessage(availabilityError)}`,
          );
          this.screen.set({ kind: 'error', error: availabilityError });
        },
      });
  }

  private handleAttempt(game: Playable, session: SessionDto, attempt: AttemptDto): void {
    this.pendingAttempt = null;
    this.retryPending.set(false);
    this.feedback.set(null);
    this.session.set({
      ...session,
      status: attempt.status,
      attemptsUsed: attempt.number,
      nextAvailableAt: attempt.nextAvailableAt,
      inactivityDeadlineAt: attempt.status === 'ACTIVE' ? session.inactivityDeadlineAt : null,
    });
    const outcome = outcomeOfAttempt(game.type, attempt);
    if (outcome.kind === 'retry') {
      this.feedback.set(outcome.feedback);
      this.errorMessage.set('');
      this.busy.set(true);
      this.gateway
        .getSession(this.ctx.spaceId(), session.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.busy.set(false);
            this.updateSession(updated);
          },
          error: (error: unknown) => {
            this.busy.set(false);
            this.errorMessage.set(`Ta réponse a été reçue, mais le délai n’a pas pu être vérifié : ${errorMessage(error)}`);
          },
        });
      return;
    }

    this.busy.set(false);
    this.screen.set(outcome.screen);
    if (outcome.screen.kind === 'success' && this.gateway.mode === 'demo') {
      this.starsAwardedThisSession.set(
        this.demoRewards.awardSuccessfulSession(this.ctx.spaceId(), session.id),
      );
    }
  }

  private handleSubmitError(error: unknown, session: SessionDto): void {
    const action = submitErrorAction(error);
    if (action === 'retry-same-key') {
      this.busy.set(false);
      this.retryPending.set(true);
      this.errorMessage.set(
        `La réponse n’a pas pu être confirmée. Réessaie l’envoi sans modifier ta réponse : ${errorMessage(error)}`,
      );
      return;
    }

    this.pendingAttempt = null;
    this.retryPending.set(false);
    if (action === 'refresh-session') {
      this.busy.set(true);
      this.gateway
        .getSession(this.ctx.spaceId(), session.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.busy.set(false);
            this.errorMessage.set('La partie a changé. Voici son état actuel.');
            this.updateSession(updated);
          },
          error: (refreshError: unknown) => {
            this.busy.set(false);
            this.errorMessage.set(
              `La partie doit être actualisée, mais sa lecture a échoué : ${errorMessage(refreshError)}`,
            );
          },
        });
      return;
    }

    this.busy.set(false);
    this.errorMessage.set(errorMessage(error));
  }

  private updateSession(session: SessionDto): void {
    this.session.set(session);
    if (session.game?.type) this.gameTypeFromRoute.set(session.game.type);
    const ended = endScreenForSession(session);
    if (ended) this.screen.set(ended);
    else if (session.status === 'ACTIVE' && session.game) this.screen.set({ kind: 'playing' });
  }

  private formatCorrection(correction: Correction | null): string {
    if (!correction) return '';
    switch (correction.type) {
      case 'MATH':
        return `Le résultat attendu était ${correction.expected}.`;
      case 'MATCHING':
        return `Les associations attendues : ${correction.pairs.map((pair) => `${pair.left} → ${pair.right}`).join(' · ')}`;
      case 'SENTENCE_ORDERING':
        return `La phrase correcte : ${correction.sentence}`;
      case 'DICTATION':
        return `La phrase attendue : ${correction.sentence}`;
    }
  }

  private isGameType(value: unknown): value is GameType {
    return value === 'MATH' || value === 'MATCHING' || value === 'SENTENCE_ORDERING' || value === 'DICTATION';
  }
}
