import { DestroyRef, inject, InjectionToken, Provider, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { SpaceContext } from '../space-context';

/**
 * Independent asynchronous block (summary, statistics, chart, history…): each one has its own
 * loading / error / data state so a failing request never hides the others.
 * Must be created in an injection context (field initializer).
 */
export class AsyncBlock<T> {
  readonly data = signal<T | null>(null);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);

  private subscription: Subscription | null = null;
  private source: (() => Observable<T>) | null = null;

  constructor(destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => this.cancel());
  }

  /** Starts (or restarts) the request. Previous data stays visible while reloading. */
  load(source: () => Observable<T>, options: { keepData?: boolean } = {}): void {
    this.cancel();
    this.source = source;
    if (options.keepData === false) this.data.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.subscription = source().subscribe({
      next: (value) => {
        this.data.set(value);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  retry(): void {
    if (this.source) this.load(this.source);
  }

  private cancel(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }
}

export function asyncBlock<T>(): AsyncBlock<T> {
  return new AsyncBlock<T>(inject(DestroyRef));
}

/** The SpaceContext used by the progress pages, and whether this feature owns it. */
export interface ProgressSpace {
  readonly context: SpaceContext;
  /** True when no space shell provided a context: the page must load the space itself. */
  readonly owned: boolean;
}

export const PROGRESS_SPACE = new InjectionToken<ProgressSpace>('EDUKIDS_PROGRESS_SPACE');

/**
 * Uses the SpaceContext provided by SpaceShellComponent. When the pages are rendered without it
 * (shell not provided yet), a private context is created so the pages still work on their own.
 */
export function provideProgressSpace(): Provider {
  return {
    provide: PROGRESS_SPACE,
    useFactory: (): ProgressSpace => {
      const shared = inject(SpaceContext, { optional: true });
      return shared ? { context: shared, owned: false } : { context: new SpaceContext(), owned: true };
    },
  };
}
