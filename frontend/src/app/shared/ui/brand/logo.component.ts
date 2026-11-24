import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OwlComponent } from './owl.component';

/**
 * EduKids logo: owl mascot + « Edu » (purple) « Kids » (green) wordmark.
 *   <ek-logo size="md" />   — wrap it in a link where navigation is needed.
 */
@Component({
  selector: 'ek-logo',
  imports: [OwlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ek-owl [size]="iconSize()" [sparkles]="sparkles()" />
    @if (!compact()) {
      <span class="wordmark" aria-hidden="true"><span class="edu">Edu</span><span class="kids">Kids</span></span>
    }
    <span class="ek-visually-hidden">EduKids</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.45em;
      font-size: var(--logo-size, 1.9rem);
      line-height: 1;
      user-select: none;
    }
    :host([data-size='sm']) {
      --logo-size: 1.45rem;
    }
    :host([data-size='lg']) {
      --logo-size: 2.4rem;
    }
    .wordmark {
      font-family: var(--ek-font-display);
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    .edu {
      color: #4a1d9b;
    }
    .kids {
      color: #34a043;
    }
  `,
  host: { '[attr.data-size]': 'size()' },
})
export class LogoComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly compact = input(false);
  readonly sparkles = input(true);

  protected iconSize(): string {
    return this.size() === 'sm' ? '1.6em' : '1.75em';
  }
}
