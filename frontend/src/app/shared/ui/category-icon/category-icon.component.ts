import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CategoryId } from '../../../core/models/categories';

let categoryIconCounter = 0;

/**
 * Illustrated category icon (vector), in the style of the mockups.
 *   <ek-category-icon category="maths" [size]="72" />
 */
@Component({
  selector: 'ek-category-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="ids.purple" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#a47def" />
          <stop offset="1" stop-color="#7444d6" />
        </linearGradient>
        <linearGradient [attr.id]="ids.green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7ad48a" />
          <stop offset="1" stop-color="#36a64d" />
        </linearGradient>
      </defs>
      @switch (category()) {
        @case ('maths') {
          <g [attr.fill]="url(ids.purple)">
            <rect x="6" y="6" width="24" height="24" rx="6" />
            <rect x="34" y="6" width="24" height="24" rx="6" />
            <rect x="6" y="34" width="24" height="24" rx="6" />
            <rect x="34" y="34" width="24" height="24" rx="6" />
          </g>
          <g stroke="#fff" stroke-width="3.6" stroke-linecap="round">
            <path d="M18 12 V24 M12 18 H24" />
            <path d="M41 13 L51 23 M51 13 L41 23" />
            <path d="M13 41 L23 51 M23 41 L13 51" />
            <path d="M40 43 H52 M40 49 H52" />
          </g>
          <rect x="6" y="6" width="24" height="7" rx="3.5" fill="#fff" opacity=".18" />
        }
        @case ('association') {
          <g transform="rotate(-8 32 32)">
            <!-- green piece (raised), with a top knob -->
            <g [attr.fill]="url(ids.green)" transform="translate(0 -5)">
              <rect x="33" y="18" width="25" height="28" rx="6" />
              <circle cx="45.5" cy="17" r="6" />
            </g>
            <!-- purple piece, knob plugged into the green one -->
            <g [attr.fill]="url(ids.purple)" stroke="#fff" stroke-width="1.6">
              <rect x="6" y="20" width="27" height="30" rx="6" />
              <circle cx="33.5" cy="33" r="6.5" />
              <circle cx="19.5" cy="51" r="6" />
            </g>
            <rect x="7.6" y="21.6" width="23.8" height="26.8" rx="5" [attr.fill]="url(ids.purple)" />
            <circle cx="14" cy="27" r="2.6" fill="#fff" opacity=".35" />
          </g>
        }
        @case ('ordonnancement') {
          <rect x="4" y="34" width="26" height="26" rx="6" fill="#ffc93c" />
          <rect x="34" y="34" width="26" height="26" rx="6" fill="#4f9cf5" />
          <rect x="19" y="5" width="26" height="26" rx="6" [attr.fill]="url(ids.purple)" />
          <g font-family="Fredoka Variable, Nunito Variable, sans-serif" font-weight="700" font-size="17" fill="#fff" text-anchor="middle">
            <text x="32" y="24">A</text>
            <text x="17" y="53">B</text>
            <text x="47" y="53">C</text>
          </g>
        }
        @case ('dictee') {
          <path d="M6 16 Q19 10 31 16 V54 Q19 48 6 54 Z" [attr.fill]="url(ids.purple)" />
          <path d="M33 16 Q45 10 58 16 V54 Q45 48 33 54 Z" fill="#a47def" />
          <path d="M10 22 Q19 18 27 22 M10 29 Q19 25 27 29 M10 36 Q19 32 27 36" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".85" />
          <g transform="rotate(38 46 34)">
            <rect x="42" y="12" width="9" height="34" rx="2" fill="#ffc93c" />
            <rect x="42" y="12" width="9" height="6" rx="2" fill="#ff9cc4" />
            <path d="M42 46 L46.5 55 L51 46 Z" fill="#fbd2b4" />
            <path d="M45 51 L46.5 55 L48 51 Z" fill="#2a0f55" />
          </g>
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      flex: none;
    }
    svg {
      overflow: visible;
      filter: drop-shadow(0 4px 6px rgba(72, 40, 150, 0.16));
    }
  `,
})
export class CategoryIconComponent {
  readonly category = input.required<CategoryId>();
  readonly size = input<number | string>(56);

  private readonly uid = ++categoryIconCounter;
  protected readonly ids = { purple: `ek-cat-p-${this.uid}`, green: `ek-cat-g-${this.uid}` };
  protected url(id: string): string {
    return `url(#${id})`;
  }
}
