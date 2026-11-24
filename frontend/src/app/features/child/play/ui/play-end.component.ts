import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { OwlComponent, OwlMood } from '../../../../shared/ui/brand/owl.component';
import { SparklesComponent } from '../../../../shared/ui/decor/sparkles.component';
import { ConfettiComponent } from './confetti.component';

export type PlayEndTone = 'success' | 'failed' | 'unfinished' | 'rest' | 'missing';

/**
 * Full-card end screen of the player (success, gentle failure, time out, cooldown, missing game).
 * Body as content, buttons in an element marked `actions`. The title receives focus when shown so
 * screen readers announce the result.
 */
@Component({
  selector: 'ek-play-end',
  imports: [OwlComponent, SparklesComponent, ConfettiComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tone() === 'success') {
      <ek-play-confetti />
    }
    <section class="end" [attr.aria-labelledby]="headingId">
      <div class="art" aria-hidden="true">
        <span class="dot dot--1"></span>
        <span class="dot dot--2"></span>
        <span class="dot dot--3"></span>
        <span class="halo">
          <ek-owl [size]="132" [mood]="mood()" [sparkles]="tone() === 'success'" />
        </span>
      </div>
      <div class="content">
        <h1 class="title" [id]="headingId" tabindex="-1" #headingElement>
          {{ heading() }}
          @if (tone() === 'success') {
            <ek-sparkles class="title__sparkles" [size]="38" />
          }
        </h1>
        <div class="body"><ng-content /></div>
        <div class="actions"><ng-content select="[actions]" /></div>
      </div>
    </section>
  `,
  styleUrl: './play-end.component.scss',
  host: { '[attr.data-tone]': 'tone()' },
})
export class PlayEndComponent {
  readonly tone = input.required<PlayEndTone>();
  readonly mood = input<OwlMood>('happy');
  readonly heading = input.required<string>();

  private static counter = 0;
  protected readonly headingId = `ek-play-end-${++PlayEndComponent.counter}`;
  private readonly headingRef = viewChild.required<ElementRef<HTMLElement>>('headingElement');

  constructor() {
    afterNextRender(() => this.headingRef().nativeElement.focus({ preventScroll: false }));
  }
}
