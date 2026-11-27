import { inject, Injectable } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(ToastService);

  /** Copies text and confirms with a toast. Returns false when the browser refused. */
  copy(text: string, successMessage = 'Copié dans le presse-papiers !'): boolean {
    const ok = this.clipboard.copy(text);
    if (ok) this.toast.success(successMessage);
    else this.toast.error('Impossible de copier automatiquement. Sélectionnez le texte pour le copier.');
    return ok;
  }
}
