import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly message: string;
}

/** Lightweight notifications, rendered by <ek-toast-container> in the root component. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly items = signal<readonly Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  show(message: string, tone: ToastTone = 'info', durationMs = 4000): void {
    const toast: Toast = { id: this.nextId++, tone, message };
    this.items.update((list) => [...list.slice(-3), toast]);
    if (durationMs > 0) setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 6000);
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
