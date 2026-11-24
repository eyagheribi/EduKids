import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'ek-toast-container',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="toast" [attr.data-tone]="toast.tone" [attr.role]="toast.tone === 'error' ? 'alert' : 'status'">
        <ek-icon
          [name]="toast.tone === 'success' ? 'check-circle' : toast.tone === 'error' ? 'x-circle' : toast.tone === 'warning' ? 'alert' : 'info'"
          [size]="22"
        />
        <span class="message">{{ toast.message }}</span>
        <button type="button" class="ek-icon-btn" (click)="toasts.dismiss(toast.id)" aria-label="Fermer la notification">
          <ek-icon name="x" [size]="18" />
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      right: max(16px, env(safe-area-inset-right));
      bottom: max(16px, env(safe-area-inset-bottom));
      z-index: 1100;
      display: grid;
      gap: 0.6rem;
      width: min(400px, calc(100vw - 32px));
      pointer-events: none;
    }
    .toast {
      --tone: var(--ek-purple-600);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 0.6rem 0.75rem 1rem;
      border: 1.5px solid var(--ek-border);
      border-left: 5px solid var(--tone);
      border-radius: var(--ek-radius);
      background: #fff;
      color: var(--ek-ink);
      font-weight: 700;
      box-shadow: var(--ek-shadow-lg);
      pointer-events: auto;
      animation: ek-fade-up 240ms var(--ek-ease) both;
    }
    .toast > ek-icon {
      color: var(--tone);
    }
    .toast[data-tone='success'] {
      --tone: var(--ek-green-500);
    }
    .toast[data-tone='error'] {
      --tone: var(--ek-red-500);
    }
    .toast[data-tone='warning'] {
      --tone: var(--ek-yellow-500);
    }
    .message {
      flex: 1;
    }
  `,
  host: { 'aria-live': 'polite' },
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);
}
