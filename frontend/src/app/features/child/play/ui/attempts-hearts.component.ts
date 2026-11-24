import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Remaining attempts as hearts: full hearts = attempts left, faded hearts = attempts used.
 *   <ek-play-hearts [max]="3" [used]="1" />
 */
@Component({
  selector: 'ek-play-hearts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="hearts" role="img" [attr.aria-label]="label()">
      @for (heart of hearts(); track $index) {
        <svg viewBox="0 0 24 24" class="heart" [class.is-lost]="!heart" aria-hidden="true">
          <path
            d="M12 21.2 4.6 14C2.9 12.3 2 10.7 2 8.8 2 5.9 4.3 3.6 7.2 3.6c1.9 0 3.6.9 4.8 2.5 1.2-1.6 2.9-2.5 4.8-2.5 2.9 0 5.2 2.3 5.2 5.2 0 1.9-.9 3.5-2.6 5.2Z"
          />
          @if (heart) {
            <ellipse cx="7.6" cy="8.2" rx="1.9" ry="1.3" transform="rotate(-35 7.6 8.2)" class="shine" />
          }
        </svg>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .hearts {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.45rem 0.75rem;
      border-radius: var(--ek-radius-pill);
      background: #fff;
      box-shadow: var(--ek-shadow-sm);
    }
    .heart {
      width: 1.75rem;
      height: 1.75rem;
      fill: #ff5a7a;
      stroke: #e23a5e;
      stroke-width: 1.2;
      filter: drop-shadow(0 2px 0 rgba(226, 58, 94, 0.25));
      animation: ek-pop 360ms var(--ek-ease-bounce) both;
      transition:
        fill 300ms var(--ek-ease),
        transform 300ms var(--ek-ease);
    }
    .heart.is-lost {
      fill: #ece8f5;
      stroke: #d6d0e6;
      filter: none;
      transform: scale(0.86);
      animation: lost 520ms var(--ek-ease) both;
    }
    .shine {
      fill: #fff;
      stroke: none;
      opacity: 0.7;
    }
    @keyframes lost {
      0% {
        transform: scale(1.15);
        fill: #ff5a7a;
      }
      40% {
        transform: scale(0.7) rotate(-10deg);
      }
      100% {
        transform: scale(0.86);
      }
    }
  `,
})
export class AttemptsHeartsComponent {
  readonly max = input.required<number>();
  readonly used = input.required<number>();

  protected readonly remaining = computed(() => Math.max(0, this.max() - this.used()));
  protected readonly hearts = computed(() =>
    Array.from({ length: Math.max(0, this.max()) }, (_, i) => i < this.remaining()),
  );
  protected readonly label = computed(() => {
    const left = this.remaining();
    return `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''} sur ${this.max()}`;
  });
}
