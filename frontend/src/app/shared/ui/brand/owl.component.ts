import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let owlCounter = 0;

export type OwlMood = 'happy' | 'cheer' | 'oops' | 'think';

/**
 * « Edu », the EduKids owl mascot (vector, scalable). Used by the logo and the child screens.
 *   <ek-owl [size]="120" mood="cheer" />
 */
@Component({
  selector: 'ek-owl',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 120 120"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      <defs>
        <linearGradient [attr.id]="ids.body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#a47def" />
          <stop offset="1" stop-color="#6a3cc8" />
        </linearGradient>
        <radialGradient [attr.id]="ids.belly" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stop-color="#d8c6fb" />
          <stop offset="1" stop-color="#b597f2" />
        </radialGradient>
      </defs>

      @if (sparkles()) {
        <g stroke="#ffc93c" stroke-width="5" stroke-linecap="round">
          <line x1="88" y1="10" x2="91" y2="2" />
          <line x1="97" y1="15" x2="104" y2="10" />
          <line x1="101" y1="25" x2="109" y2="24" />
        </g>
      }

      <!-- wings -->
      @if (mood() === 'cheer') {
        <ellipse cx="17" cy="52" rx="9" ry="20" transform="rotate(-35 17 52)" [attr.fill]="fill(ids.body)" />
        <ellipse cx="103" cy="52" rx="9" ry="20" transform="rotate(35 103 52)" [attr.fill]="fill(ids.body)" />
      } @else {
        <ellipse cx="18" cy="74" rx="8" ry="17" transform="rotate(12 18 74)" fill="#5b30b3" />
        <ellipse cx="102" cy="74" rx="8" ry="17" transform="rotate(-12 102 74)" fill="#5b30b3" />
      }

      <!-- body with ear tufts -->
      <path
        d="M26 36 L28 13 L47 27 Q60 23 73 27 L92 13 L94 36 Q107 51 104 73 Q99 106 60 107 Q21 106 16 73 Q13 51 26 36 Z"
        [attr.fill]="fill(ids.body)"
      />
      <ellipse cx="60" cy="88" rx="27" ry="16" [attr.fill]="fill(ids.belly)" />
      <path d="M50 84 q3 3 6 0 M64 84 q3 3 6 0 M57 93 q3 3 6 0" stroke="#9b77ea" stroke-width="2.2" fill="none" stroke-linecap="round" />

      <!-- eyes -->
      <circle cx="42" cy="56" r="18.5" fill="#fff" />
      <circle cx="78" cy="56" r="18.5" fill="#fff" />
      @switch (mood()) {
        @case ('oops') {
          <circle cx="40" cy="61" r="9" fill="#2a0f55" />
          <circle cx="76" cy="61" r="9" fill="#2a0f55" />
          <circle cx="42.5" cy="58" r="3" fill="#fff" />
          <circle cx="78.5" cy="58" r="3" fill="#fff" />
          <path d="M29 39 Q38 33 50 34 M91 39 Q82 33 70 34" stroke="#3d1680" stroke-width="4" fill="none" stroke-linecap="round" />
        }
        @case ('think') {
          <circle cx="47" cy="51" r="9" fill="#2a0f55" />
          <circle cx="83" cy="51" r="9" fill="#2a0f55" />
          <circle cx="49.5" cy="48" r="3" fill="#fff" />
          <circle cx="85.5" cy="48" r="3" fill="#fff" />
        }
        @default {
          <circle cx="44" cy="57" r="10" fill="#2a0f55" />
          <circle cx="76" cy="57" r="10" fill="#2a0f55" />
          <circle cx="47.5" cy="53" r="3.6" fill="#fff" />
          <circle cx="79.5" cy="53" r="3.6" fill="#fff" />
          <circle cx="41" cy="61" r="1.6" fill="#fff" opacity=".8" />
          <circle cx="73" cy="61" r="1.6" fill="#fff" opacity=".8" />
        }
      }

      <!-- cheeks -->
      <ellipse cx="26" cy="74" rx="6" ry="3.4" fill="#ff9cc4" opacity=".55" />
      <ellipse cx="94" cy="74" rx="6" ry="3.4" fill="#ff9cc4" opacity=".55" />

      <!-- beak -->
      @if (mood() === 'cheer') {
        <path d="M52 72 Q60 66 68 72 Q64 84 60 85 Q56 84 52 72 Z" fill="#f7a823" />
        <path d="M55 76 Q60 80 65 76" stroke="#c9720b" stroke-width="2" fill="none" stroke-linecap="round" />
      } @else {
        <path d="M53 72 Q60 67 67 72 L60 82 Z" fill="#f7a823" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    svg {
      overflow: visible;
    }
  `,
})
export class OwlComponent {
  readonly size = input<number | string>(64);
  readonly mood = input<OwlMood>('happy');
  readonly sparkles = input(false);
  readonly label = input('');

  private readonly uid = ++owlCounter;
  protected readonly ids = { body: `ek-owl-body-${this.uid}`, belly: `ek-owl-belly-${this.uid}` };
  protected readonly fill = (id: string) => `url(#${id})`;
}
