import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { formatCountdown } from '../../../../shared/pipes/format';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

/** Remaining time under which the countdown turns orange. */
export const COUNTDOWN_URGENT_MS = 60_000;

/** Text announced to screen readers — changes once per minute only. */
export function countdownAnnouncement(msRemaining: number): string {
  if (msRemaining <= 0) return 'Le temps est écoulé.';
  if (msRemaining <= COUNTDOWN_URGENT_MS) return 'Il te reste moins d’une minute pour répondre.';
  const minutes = Math.ceil(msRemaining / 60_000);
  return `Il te reste ${minutes} minutes pour répondre.`;
}

/**
 * Friendly inactivity countdown (SessionDto.inactivityDeadlineAt): « Il te reste 04:12 pour répondre ».
 * Emits `expired` once when the deadline is reached.
 */
@Component({
  selector: 'ek-play-countdown',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="countdown" [class.is-urgent]="urgent()" aria-hidden="true">
      <ek-icon name="timer" [size]="20" />
      <span>Il te reste <strong class="time">{{ time() }}</strong> pour répondre</span>
    </p>
    <span class="ek-visually-hidden" aria-live="polite">{{ announcement() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .countdown {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.95rem 0.45rem 0.75rem;
      border: 1.5px solid var(--ek-purple-150);
      border-radius: var(--ek-radius-pill);
      background: #fff;
      color: var(--ek-purple-800);
      font-family: var(--ek-font-display);
      font-weight: 500;
      font-size: 1rem;
      box-shadow: var(--ek-shadow-xs);
      transition:
        background var(--ek-duration) var(--ek-ease),
        color var(--ek-duration) var(--ek-ease),
        border-color var(--ek-duration) var(--ek-ease);
    }
    .time {
      font-weight: 650;
      font-variant-numeric: tabular-nums;
    }
    .is-urgent {
      border-color: var(--ek-orange-100);
      background: var(--ek-orange-50);
      color: var(--ek-orange-700);
      ek-icon {
        animation: ek-wiggle 1s ease-in-out infinite;
      }
    }
  `,
})
export class InactivityCountdownComponent {
  /** ISO date of SessionDto.inactivityDeadlineAt. */
  readonly deadline = input.required<string>();
  readonly expired = output<void>();

  private readonly now = signal(Date.now());
  private emitted = '';

  protected readonly remaining = computed(() => {
    const end = Date.parse(this.deadline());
    return Number.isNaN(end) ? 0 : end - this.now();
  });
  protected readonly time = computed(() => formatCountdown(this.remaining()));
  protected readonly urgent = computed(() => this.remaining() <= COUNTDOWN_URGENT_MS);
  protected readonly announcement = computed(() => countdownAnnouncement(this.remaining()));

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    effect(() => {
      const deadline = this.deadline();
      if (this.remaining() <= 0 && this.emitted !== deadline) {
        this.emitted = deadline;
        this.expired.emit();
      }
    });
  }
}
