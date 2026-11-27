import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The three little strokes that decorate titles in the mockups. */
@Component({
  selector: 'ek-sparkles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 40 40" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <g [attr.stroke]="color() === 'yellow' ? '#ffc93c' : '#4cbf5f'" stroke-width="5" stroke-linecap="round">
        <line x1="8" y1="18" x2="5" y2="5" />
        <line x1="18" y1="22" x2="27" y2="12" />
        <line x1="21" y1="32" x2="34" y2="31" />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class SparklesComponent {
  readonly size = input<number | string>(34);
  readonly color = input<'green' | 'yellow'>('green');
}
