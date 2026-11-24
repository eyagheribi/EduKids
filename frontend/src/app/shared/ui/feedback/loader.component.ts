import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Loading indicator (three bouncing dots) with an accessible label. */
@Component({
  selector: 'ek-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    @if (label()) {
      <span class="label">{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: var(--loader-padding, 2rem);
      color: var(--ek-text-soft);
      font-weight: 700;
    }
    :host([inline]) {
      --loader-padding: 0;
      flex-direction: row;
    }
    .dots {
      display: inline-flex;
      gap: 0.4rem;
    }
    i {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
      background: var(--ek-purple-500);
      animation: ek-bounce-dot 1.2s infinite ease-in-out both;
    }
    i:nth-child(2) {
      background: var(--ek-green-500);
      animation-delay: 0.15s;
    }
    i:nth-child(3) {
      background: var(--ek-yellow-400);
      animation-delay: 0.3s;
    }
  `,
  host: { role: 'status', '[attr.aria-label]': 'label() || "Chargement"' },
})
export class LoaderComponent {
  readonly label = input('Chargement…');
}
