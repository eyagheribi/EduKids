import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { ScoreKind } from './progress.utils';

/** Score pill of the mockup: « 1 / 1 ✓ » (success), « 3 / 4 ★ » (partial), « 0 / 1 », « — ». */
@Component({
  selector: 'ek-score-chip',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    {{ score() }}
    @switch (kind()) {
      @case ('success') {
        <span class="badge" aria-hidden="true"><ek-icon name="check" [size]="12" [strokeWidth]="3.6" /></span>
      }
      @case ('partial') {
        <span class="badge" aria-hidden="true"><ek-icon name="star" [size]="11" [strokeWidth]="3" /></span>
      }
    }
  `,
  styles: `
    :host {
      --score-bg: #f4f3f8;
      --score-fg: var(--ek-text);
      --score-border: #e6e3ef;
      --score-badge: var(--ek-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.22rem 0.3rem 0.22rem 0.75rem;
      border: 1.5px solid var(--score-border);
      border-radius: var(--ek-radius-pill);
      background: var(--score-bg);
      color: var(--score-fg);
      font-family: var(--ek-font-display);
      font-size: 0.98rem;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
    }
    :host([data-kind='success']) {
      --score-bg: var(--ek-green-50);
      --score-fg: var(--ek-green-700);
      --score-border: var(--ek-green-200);
      --score-badge: var(--ek-green-500);
    }
    :host([data-kind='partial']) {
      --score-bg: var(--ek-yellow-50);
      --score-fg: #8a5a00;
      --score-border: var(--ek-yellow-200);
      --score-badge: var(--ek-yellow-500);
    }
    :host([data-kind='zero']) {
      --score-bg: var(--ek-red-50);
      --score-fg: var(--ek-red-600);
      --score-border: var(--ek-red-100);
    }
    :host([data-kind='zero']),
    :host([data-kind='unknown']) {
      padding-right: 0.75rem;
    }
    :host([data-small]) {
      font-size: 0.85rem;
      padding-block: 0.12rem;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 1.3rem;
      height: 1.3rem;
      border-radius: 50%;
      background: var(--score-badge);
      color: #fff;
    }
  `,
  host: { '[attr.data-kind]': 'kind()', '[attr.data-small]': 'small() ? "" : null' },
})
export class ScoreChipComponent {
  readonly score = input.required<string>();
  readonly kind = input.required<ScoreKind>();
  readonly small = input(false);
}
