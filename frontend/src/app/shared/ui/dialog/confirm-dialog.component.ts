import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DialogShellComponent } from './dialog-shell.component';
import { IconName } from '../icon/icon.data';

export interface ConfirmDialogData {
  readonly title: string;
  readonly message: string;
  /** Optional second paragraph (consequences). */
  readonly detail?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: 'default' | 'danger';
  readonly icon?: IconName;
}

@Component({
  selector: 'ek-confirm-dialog',
  imports: [DialogShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ek-dialog-shell
      [title]="data.title"
      [icon]="data.icon ?? (data.tone === 'danger' ? 'trash' : 'help')"
      [tone]="data.tone ?? 'default'"
    >
      <p class="message">{{ data.message }}</p>
      @if (data.detail) {
        <p class="detail">{{ data.detail }}</p>
      }
      <div footer>
        <button type="button" class="ek-btn ek-btn--outline" (click)="ref.close(false)" cdkFocusInitial>
          {{ data.cancelLabel ?? 'Annuler' }}
        </button>
        <button
          type="button"
          class="ek-btn"
          [class.ek-btn--danger]="data.tone === 'danger'"
          (click)="ref.close(true)"
        >
          {{ data.confirmLabel ?? 'Confirmer' }}
        </button>
      </div>
    </ek-dialog-shell>
  `,
  styles: `
    .message {
      color: var(--ek-ink);
      font-weight: 700;
      font-size: 1.05rem;
    }
    .detail {
      margin-top: 0.5rem;
      color: var(--ek-text-soft);
      font-weight: 600;
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
