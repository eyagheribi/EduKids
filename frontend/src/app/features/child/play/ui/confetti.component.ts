import { ChangeDetectionStrategy, Component } from '@angular/core';

const COLORS = ['#8b5ce6', '#55c06a', '#ffc93c', '#4f9cf5', '#ff7aa8', '#f08a24', '#c4a9f6'];

interface Piece {
  readonly left: number;
  readonly delay: number;
  readonly duration: number;
  readonly color: string;
  readonly drift: string;
  readonly spin: string;
  readonly width: number;
  readonly height: number;
  readonly round: boolean;
}

function pieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const size = 7 + Math.random() * 7;
    const round = i % 4 === 0;
    return {
      left: Math.random() * 100,
      delay: Math.random() * 1.6,
      duration: 2.6 + Math.random() * 2.2,
      color: COLORS[i % COLORS.length] ?? '#8b5ce6',
      drift: `${Math.round((Math.random() - 0.5) * 160)}px`,
      spin: `${Math.round(360 + Math.random() * 540) * (Math.random() > 0.5 ? 1 : -1)}deg`,
      width: round ? size : size * 0.6,
      height: round ? size : size * 1.5,
      round,
    };
  });
}

/** Pure CSS confetti burst (decorative, hidden when the user prefers reduced motion). */
@Component({
  selector: 'ek-play-confetti',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (piece of pieces; track $index) {
      <i
        [class.round]="piece.round"
        [style.left.%]="piece.left"
        [style.width.px]="piece.width"
        [style.height.px]="piece.height"
        [style.background]="piece.color"
        [style.animation-delay.s]="piece.delay"
        [style.animation-duration.s]="piece.duration"
        [style.--drift]="piece.drift"
        [style.--spin]="piece.spin"
      ></i>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 5;
      overflow: hidden;
      pointer-events: none;
    }
    i {
      position: absolute;
      top: 0;
      border-radius: 3px;
      opacity: 0;
      animation-name: ek-confetti-fall;
      animation-timing-function: cubic-bezier(0.25, 0.6, 0.5, 1);
      animation-iteration-count: 2;
      animation-fill-mode: both;
    }
    .round {
      border-radius: 50%;
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        display: none;
      }
    }
  `,
  host: { 'aria-hidden': 'true' },
})
export class ConfettiComponent {
  protected readonly pieces = pieces(56);
}
