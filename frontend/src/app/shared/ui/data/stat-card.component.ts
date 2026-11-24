import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon.data';

export type StatTone = 'purple' | 'green' | 'yellow' | 'blue' | 'orange' | 'red';

/** KPI tile (« Sessions terminées 20 »). */
@Component({
  selector: 'ek-stat-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="icon"><ek-icon [name]="icon()" [size]="30" [strokeWidth]="2.4" /></span>
    <span class="text">
      <span class="label">{{ label() }}</span>
      <span class="value">{{ value() }}</span>
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      --tone-bg: var(--ek-purple-50);
      --tone-fg: var(--ek-purple-600);
      --tone-border: var(--ek-purple-150);
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
      padding: 1.1rem 1.25rem;
      border: 1.5px solid var(--tone-border);
      border-radius: var(--ek-radius-lg);
      background: linear-gradient(135deg, #fff 0%, var(--tone-bg) 100%);
      box-shadow: var(--ek-shadow-sm);
    }
    :host([data-tone='green']) {
      --tone-bg: var(--ek-green-50);
      --tone-fg: var(--ek-green-600);
      --tone-border: var(--ek-green-100);
    }
    :host([data-tone='yellow']) {
      --tone-bg: var(--ek-yellow-50);
      --tone-fg: var(--ek-yellow-500);
      --tone-border: var(--ek-yellow-100);
    }
    :host([data-tone='blue']) {
      --tone-bg: var(--ek-blue-50);
      --tone-fg: var(--ek-blue-500);
      --tone-border: var(--ek-blue-100);
    }
    :host([data-tone='orange']) {
      --tone-bg: var(--ek-orange-50);
      --tone-fg: var(--ek-orange-500);
      --tone-border: var(--ek-orange-100);
    }
    :host([data-tone='red']) {
      --tone-bg: var(--ek-red-50);
      --tone-fg: var(--ek-red-500);
      --tone-border: var(--ek-red-100);
    }
    .icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 3.25rem;
      height: 3.25rem;
      border-radius: 16px;
      background: #fff;
      color: var(--tone-fg);
      box-shadow: var(--ek-shadow-xs);
    }
    .text {
      display: grid;
      min-width: 0;
    }
    .label {
      color: var(--ek-ink);
      font-family: var(--ek-font-display);
      font-weight: 600;
      font-size: 0.98rem;
    }
    .value {
      color: var(--ek-ink);
      font-family: var(--ek-font-display);
      font-weight: 650;
      font-size: clamp(1.6rem, 1.2rem + 1vw, 2.1rem);
      line-height: 1.1;
    }
    .hint {
      color: var(--ek-text-soft);
      font-size: 0.82rem;
      font-weight: 700;
    }
  `,
  host: { '[attr.data-tone]': 'tone()' },
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input<IconName>('chart');
  readonly tone = input<StatTone>('purple');
  readonly hint = input('');
}
