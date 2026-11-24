import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Illustrations extracted from the /design mockups (public/illustrations, transparent WebP). */
export const ILLUSTRATIONS = {
  'parent-child-laptop': { width: 674, height: 351, alt: 'Une maman et son enfant devant un ordinateur EduKids' },
  'parent-child-tablet': { width: 375, height: 259, alt: 'Une maman et son enfant jouant sur une tablette EduKids' },
  'parent-child-small': { width: 336, height: 223, alt: 'Une maman accompagne son enfant sur EduKids' },
  'child-headphones': { width: 270, height: 243, alt: 'Un enfant avec un casque joue sur une tablette' },
  'child-tablet': { width: 230, height: 209, alt: 'Un enfant souriant tient une tablette EduKids' },
  'child-laptop': { width: 340, height: 306, alt: 'Un enfant apprend sur un ordinateur portable' },
  'plant-books': { width: 177, height: 121, alt: '' },
  medal: { width: 67, height: 85, alt: 'Une médaille' },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

/**
 *   <ek-illustration name="child-laptop" [width]="320" />
 * `decorative` (default true) hides it from assistive technologies.
 */
@Component({
  selector: 'ek-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img
    [src]="'illustrations/' + name() + '.webp'"
    [attr.width]="meta().width"
    [attr.height]="meta().height"
    [alt]="decorative() ? '' : meta().alt"
    [attr.loading]="eager() ? 'eager' : 'lazy'"
    decoding="async"
    draggable="false"
  />`,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
    img {
      display: block;
      width: 100%;
      height: auto;
      user-select: none;
    }
  `,
  host: { '[style.width]': 'cssWidth()' },
})
export class IllustrationComponent {
  readonly name = input.required<IllustrationName>();
  /** Rendered width (px number or CSS length). Height follows the aspect ratio. */
  readonly width = input<number | string | null>(null);
  readonly decorative = input(true);
  readonly eager = input(false);

  protected readonly meta = computed(() => ILLUSTRATIONS[this.name()]);
  protected readonly cssWidth = computed(() => {
    const w = this.width();
    if (w === null) return null;
    return typeof w === 'number' ? `${w}px` : w;
  });
}
