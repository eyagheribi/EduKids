import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ICONS, IconName } from './icon.data';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Stroke icon (Lucide set). Decorative by default; pass `label` to expose it to assistive tech.
 *   <ek-icon name="gamepad" [size]="22" />
 */
@Component({
  selector: 'ek-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    #svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
    [attr.width]="size()"
    [attr.height]="size()"
    [attr.stroke-width]="strokeWidth()"
    [attr.role]="label() ? 'img' : null"
    [attr.aria-label]="label() || null"
    [attr.aria-hidden]="label() ? null : 'true'"
  ></svg>`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
      vertical-align: middle;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<number | string>(20);
  readonly strokeWidth = input<number>(2.2);
  readonly label = input<string>('');

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      const element = this.svg().nativeElement;
      const nodes = ICONS[this.name()] ?? [];
      while (element.firstChild) element.removeChild(element.firstChild);
      for (const [tag, attributes] of nodes) {
        const child = this.document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attributes)) child.setAttribute(key, String(value));
        element.appendChild(child);
      }
    });
  }
}
