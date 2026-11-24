import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ClipboardService } from '../../../core/services/clipboard.service';
import { IconComponent } from '../icon/icon.component';

/** « Code d'accès : A7K9P2 [copier] » pill. */
@Component({
  selector: 'ek-access-code',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ek-icon name="link" [size]="22" class="lead" />
    <span class="label">Code d’accès :</span>
    <span class="code ek-code" [attr.aria-label]="spelled()">{{ code() }}</span>
    <button
      type="button"
      class="ek-icon-btn"
      (click)="copy()"
      [attr.aria-label]="'Copier le code d’accès ' + code()"
      title="Copier le code"
    >
      <ek-icon name="copy" [size]="20" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-self: start;
      width: max-content;
      max-width: 100%;
      gap: 0.55rem;
      padding: 0.35rem 0.4rem 0.35rem 1rem;
      border: 2px solid var(--ek-green-300);
      border-radius: var(--ek-radius-pill);
      background: var(--ek-green-50);
      color: var(--ek-ink);
      box-shadow: 0 3px 0 var(--ek-green-100);
    }
    :host([data-size='lg']) {
      padding: 0.6rem 0.6rem 0.6rem 1.25rem;
      .code {
        font-size: 2rem;
      }
    }
    .lead {
      color: var(--ek-green-700);
    }
    .label {
      font-family: var(--ek-font-display);
      font-weight: 600;
      white-space: nowrap;
    }
    .code {
      font-size: 1.45rem;
      letter-spacing: 0.08em;
    }
    .ek-icon-btn {
      color: var(--ek-ink);
    }
    @media (max-width: 480px) {
      .label {
        display: none;
      }
    }
  `,
  host: { '[attr.data-size]': 'size()' },
})
export class AccessCodeComponent {
  readonly code = input.required<string>();
  readonly size = input<'md' | 'lg'>('md');
  private readonly clipboard = inject(ClipboardService);

  protected copy(): void {
    this.clipboard.copy(this.code(), `Code ${this.code()} copié !`);
  }

  protected spelled(): string {
    return `Code d’accès ${this.code().split('').join(' ')}`;
  }
}
