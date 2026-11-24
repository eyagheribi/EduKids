import { inject, Injectable, Type } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

/**
 * Opens EduKids-styled dialogs (CDK Dialog: focus trap, Escape, backdrop, aria-modal).
 * Dialog components should wrap their content in <ek-dialog-shell>.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);

  open<R = unknown, D = unknown, C = unknown>(component: Type<C>, data?: D): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      data,
      backdropClass: 'ek-dialog-backdrop',
      panelClass: 'ek-dialog-panel',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaModal: true,
    });
  }

  /** Resolves true when the user confirms. */
  async confirm(data: ConfirmDialogData): Promise<boolean> {
    const ref = this.open<boolean, ConfirmDialogData>(ConfirmDialogComponent, data);
    return (await firstValueFrom(ref.closed)) === true;
  }
}
