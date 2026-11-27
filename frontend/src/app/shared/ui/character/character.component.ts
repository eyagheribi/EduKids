import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OwlComponent } from '../brand/owl.component';
import { findCharacter } from './characters';

/**
 * Favourite character of the child (vector). Unknown keys fall back to the owl.
 *   <ek-character key="renard" [size]="96" [framed]="true" />
 */
@Component({
  selector: 'ek-character',
  imports: [OwlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="frame" [class.is-framed]="framed()" [style.background]="framed() ? bg() : null" [style.padding.px]="framed() ? framePadding() : null">
      @switch (resolvedKey()) {
        @case ('renard') {
          <svg viewBox="0 0 120 120" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
            <path d="M22 18 L48 40 L30 58 Z" fill="#e8742a" />
            <path d="M98 18 L72 40 L90 58 Z" fill="#e8742a" />
            <path d="M28 27 L42 40 L32 50 Z" fill="#2a0f55" opacity=".85" />
            <path d="M92 27 L78 40 L88 50 Z" fill="#2a0f55" opacity=".85" />
            <path d="M18 60 Q20 30 60 28 Q100 30 102 60 Q100 92 60 104 Q20 92 18 60 Z" fill="#f08a24" />
            <path d="M18 62 Q34 70 46 84 Q52 96 60 104 Q20 92 18 62 Z" fill="#fff" />
            <path d="M102 62 Q86 70 74 84 Q68 96 60 104 Q100 92 102 62 Z" fill="#fff" />
            <ellipse cx="44" cy="60" rx="5" ry="6.5" fill="#2a0f55" />
            <ellipse cx="76" cy="60" rx="5" ry="6.5" fill="#2a0f55" />
            <circle cx="45.8" cy="57.6" r="1.8" fill="#fff" />
            <circle cx="77.8" cy="57.6" r="1.8" fill="#fff" />
            <ellipse cx="60" cy="86" rx="6" ry="4.4" fill="#2a0f55" />
            <path d="M52 92 Q60 98 68 92" stroke="#2a0f55" stroke-width="2.6" fill="none" stroke-linecap="round" />
            <ellipse cx="34" cy="74" rx="6" ry="3.4" fill="#ff9cc4" opacity=".6" />
            <ellipse cx="86" cy="74" rx="6" ry="3.4" fill="#ff9cc4" opacity=".6" />
          </svg>
        }
        @case ('panda') {
          <svg viewBox="0 0 120 120" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
            <circle cx="28" cy="30" r="14" fill="#2b2433" />
            <circle cx="92" cy="30" r="14" fill="#2b2433" />
            <circle cx="60" cy="64" r="44" fill="#fff" stroke="#e7e3ef" stroke-width="2" />
            <ellipse cx="42" cy="60" rx="12" ry="14" transform="rotate(-25 42 60)" fill="#2b2433" />
            <ellipse cx="78" cy="60" rx="12" ry="14" transform="rotate(25 78 60)" fill="#2b2433" />
            <circle cx="44" cy="60" r="5.2" fill="#fff" />
            <circle cx="76" cy="60" r="5.2" fill="#fff" />
            <circle cx="45" cy="61" r="3" fill="#2b2433" />
            <circle cx="75" cy="61" r="3" fill="#2b2433" />
            <ellipse cx="60" cy="78" rx="7" ry="5" fill="#2b2433" />
            <path d="M52 86 Q60 93 68 86" stroke="#2b2433" stroke-width="2.6" fill="none" stroke-linecap="round" />
            <ellipse cx="32" cy="80" rx="6" ry="3.4" fill="#ff9cc4" opacity=".6" />
            <ellipse cx="88" cy="80" rx="6" ry="3.4" fill="#ff9cc4" opacity=".6" />
          </svg>
        }
        @case ('dino') {
          <svg viewBox="0 0 120 120" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
            <path d="M40 22 L48 8 L56 20 L64 6 L72 20 L80 10 L84 26 Z" fill="#ffc93c" />
            <path d="M16 70 Q14 26 60 22 Q104 24 104 66 Q104 104 60 106 Q16 104 16 70 Z" fill="#55c06a" />
            <ellipse cx="60" cy="84" rx="30" ry="18" fill="#b9e8c3" />
            <circle cx="42" cy="56" r="11" fill="#fff" />
            <circle cx="78" cy="56" r="11" fill="#fff" />
            <circle cx="44" cy="57" r="6" fill="#2a0f55" />
            <circle cx="76" cy="57" r="6" fill="#2a0f55" />
            <circle cx="46" cy="54.6" r="2.2" fill="#fff" />
            <circle cx="78" cy="54.6" r="2.2" fill="#fff" />
            <circle cx="52" cy="78" r="2.2" fill="#2b8c3f" />
            <circle cx="68" cy="78" r="2.2" fill="#2b8c3f" />
            <path d="M44 88 Q60 98 76 88" stroke="#217033" stroke-width="3" fill="none" stroke-linecap="round" />
            <path d="M50 90 L53 95 L56 91 M64 91 L67 95 L70 90" stroke="#fff" stroke-width="2.4" fill="#fff" stroke-linejoin="round" />
          </svg>
        }
        @case ('lapin') {
          <svg viewBox="0 0 120 120" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
            <ellipse cx="42" cy="26" rx="10" ry="24" transform="rotate(-10 42 26)" fill="#fff" stroke="#efe3ea" stroke-width="2" />
            <ellipse cx="78" cy="26" rx="10" ry="24" transform="rotate(10 78 26)" fill="#fff" stroke="#efe3ea" stroke-width="2" />
            <ellipse cx="42" cy="28" rx="5" ry="16" transform="rotate(-10 42 28)" fill="#ffb3cf" />
            <ellipse cx="78" cy="28" rx="5" ry="16" transform="rotate(10 78 28)" fill="#ffb3cf" />
            <circle cx="60" cy="72" r="38" fill="#fff" stroke="#efe3ea" stroke-width="2" />
            <ellipse cx="46" cy="68" rx="5" ry="6.2" fill="#2a0f55" />
            <ellipse cx="74" cy="68" rx="5" ry="6.2" fill="#2a0f55" />
            <circle cx="47.6" cy="65.6" r="1.8" fill="#fff" />
            <circle cx="75.6" cy="65.6" r="1.8" fill="#fff" />
            <path d="M56 80 L64 80 L60 85 Z" fill="#ff7aa8" />
            <path d="M60 85 Q55 92 50 89 M60 85 Q65 92 70 89" stroke="#2a0f55" stroke-width="2.4" fill="none" stroke-linecap="round" />
            <ellipse cx="36" cy="82" rx="6.5" ry="3.6" fill="#ff9cc4" opacity=".6" />
            <ellipse cx="84" cy="82" rx="6.5" ry="3.6" fill="#ff9cc4" opacity=".6" />
          </svg>
        }
        @case ('robot') {
          <svg viewBox="0 0 120 120" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
            <line x1="60" y1="10" x2="60" y2="28" stroke="#6c6589" stroke-width="4" stroke-linecap="round" />
            <circle cx="60" cy="10" r="6" fill="#e5484d" />
            <rect x="12" y="50" width="10" height="26" rx="5" fill="#4f9cf5" />
            <rect x="98" y="50" width="10" height="26" rx="5" fill="#4f9cf5" />
            <rect x="20" y="28" width="80" height="74" rx="22" fill="#b5d6fd" />
            <rect x="30" y="40" width="60" height="40" rx="14" fill="#2a0f55" />
            <circle cx="46" cy="58" r="7" fill="#55c06a" />
            <circle cx="74" cy="58" r="7" fill="#55c06a" />
            <circle cx="48" cy="56" r="2.2" fill="#fff" />
            <circle cx="76" cy="56" r="2.2" fill="#fff" />
            <path d="M48 70 Q60 76 72 70" stroke="#55c06a" stroke-width="3" fill="none" stroke-linecap="round" />
            <rect x="42" y="88" width="36" height="6" rx="3" fill="#4f9cf5" />
          </svg>
        }
        @default {
          <ek-owl [size]="size()" />
        }
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    .frame {
      display: inline-grid;
      place-items: center;
    }
    .frame.is-framed {
      border-radius: 50%;
    }
  `,
})
export class CharacterComponent {
  readonly key = input<string | null | undefined>('hibou');
  readonly size = input<number | string>(96);
  readonly framed = input(false);

  protected readonly resolvedKey = computed(() => findCharacter(this.key())?.key ?? 'hibou');
  protected readonly bg = computed(() => findCharacter(this.key())?.bg ?? '#efe7fe');
  protected readonly framePadding = computed(() => {
    const size = Number.parseFloat(String(this.size()));
    return Number.isFinite(size) ? Math.round(size * 0.14) : 10;
  });
}
