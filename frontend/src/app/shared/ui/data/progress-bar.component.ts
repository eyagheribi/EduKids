import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Rounded progress bar. `value` is a percentage (0–100). */
@Component({
  selector: 'ek-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    class="ek-progress"
    [class.ek-progress--purple]="tone() === 'purple'"
    [class.ek-progress--blue]="tone() === 'blue'"
    [class.ek-progress--yellow]="tone() === 'yellow'"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    [attr.aria-valuenow]="clamped()"
    [attr.aria-label]="label() || null"
  >
    <div class="ek-progress__bar" [style.width.%]="clamped()"></div>
  </div>`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class ProgressBarComponent {
  readonly value = input(0);
  readonly tone = input<'green' | 'purple' | 'blue' | 'yellow'>('green');
  readonly label = input('');

  protected readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.value() || 0))));
}
