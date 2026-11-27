import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ApiError, errorMessage } from '../../../core/api/api-error';
import { IconComponent } from '../icon/icon.component';

/** Error block with an optional « Réessayer » action. Accepts an ApiError, Error or string. */
@Component({
  selector: 'ek-error-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ek-alert ek-alert--error" role="alert">
      <ek-icon [name]="network() ? 'cloud-off' : 'alert'" [size]="22" />
      <div class="body">
        <strong>{{ title() }}</strong>
        <p>{{ message() }}</p>
        @for (detail of details(); track detail) {
          <p class="detail">{{ detail }}</p>
        }
      </div>
      @if (retryable()) {
        <button type="button" class="ek-btn ek-btn--outline ek-btn--sm" (click)="retry.emit()">
          <ek-icon name="refresh" [size]="16" /> Réessayer
        </button>
      }
    </div>
  `,
  styles: `
    .ek-alert {
      align-items: center;
    }
    .body {
      flex: 1;
      display: grid;
      gap: 0.15rem;
    }
    .detail {
      font-size: 0.88rem;
      opacity: 0.85;
    }
  `,
})
export class ErrorStateComponent {
  readonly error = input<unknown>(null);
  readonly title = input('Oups, un problème est survenu');
  readonly retryable = input(true);
  readonly retry = output<void>();

  protected readonly message = computed(() => errorMessage(this.error()));
  protected readonly details = computed(() => {
    const e = this.error();
    return e instanceof ApiError ? e.details : [];
  });
  protected readonly network = computed(() => {
    const e = this.error();
    return e instanceof ApiError && e.isNetworkError;
  });
}
