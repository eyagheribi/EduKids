import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SparklesComponent } from '../decor/sparkles.component';

/**
 * Parent page title block (« Espace Parent » eyebrow, big title with sparkles, subtitle).
 * Project actions with <div actions>…</div>.
 */
@Component({
  selector: 'ek-page-header',
  imports: [SparklesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text">
      @if (eyebrow()) {
        <span class="ek-eyebrow">{{ eyebrow() }}</span>
      }
      <h1>
        {{ title() }}
        @if (sparkles()) {
          <ek-sparkles class="spark" [size]="30" />
        }
      </h1>
      @if (subtitle()) {
        <p class="subtitle">{{ subtitle() }}</p>
      }
    </div>
    <div class="actions"><ng-content select="[actions]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
    }
    .text {
      display: grid;
      gap: 0.35rem;
      justify-items: start;
      min-width: 0;
    }
    h1 {
      display: inline-flex;
      align-items: flex-start;
      gap: 0.25rem;
      font-size: clamp(1.7rem, 1.2rem + 1.6vw, 2.35rem);
    }
    .spark {
      margin-top: -0.6rem;
    }
    .subtitle {
      color: var(--ek-text-soft);
      font-weight: 600;
      font-size: 1.02rem;
    }
    .actions:empty {
      display: none;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
  readonly sparkles = input(true);
}
