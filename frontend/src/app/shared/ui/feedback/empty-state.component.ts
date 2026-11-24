import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon.data';

/** Friendly empty state. Project buttons as content. */
@Component({
  selector: 'ek-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge"><ek-icon [name]="icon()" [size]="30" /></span>
    <h3>{{ title() }}</h3>
    @if (text()) {
      <p>{{ text() }}</p>
    }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: 0.6rem;
      padding: 2rem 1rem;
      text-align: center;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 4.25rem;
      height: 4.25rem;
      margin-bottom: 0.25rem;
      border-radius: 22px;
      background: var(--ek-purple-50);
      color: var(--ek-purple-600);
    }
    h3 {
      font-size: 1.2rem;
    }
    p {
      max-width: 34rem;
      color: var(--ek-text-soft);
      font-weight: 600;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .actions:empty {
      display: none;
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly text = input('');
  readonly icon = input<IconName>('sparkles');
}
