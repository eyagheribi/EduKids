import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { formatPercent } from '../../../../shared/pipes/format';
import { layoutSuccessChart, nearestIndex } from './progress-chart';
import { formatAxisDay, formatLongDay, plural, SuccessPoint } from './progress.utils';

let chartCounter = 0;

/**
 * Responsive SVG line chart of the cumulative success rate per day (no chart library).
 * The SVG is drawn at the real pixel width of its container (ResizeObserver) so texts never scale.
 * Accessible: role="img" + summary, and a visually hidden data table.
 */
@Component({
  selector: 'ek-success-rate-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './success-rate-chart.component.html',
  styleUrl: './success-rate-chart.component.scss',
})
export class SuccessRateChartComponent {
  readonly points = input.required<readonly SuccessPoint[]>();

  private readonly plot = viewChild.required<ElementRef<HTMLElement>>('plot');
  private readonly width = signal(0);
  protected readonly height = signal(250);
  protected readonly active = signal<number | null>(null);
  protected readonly gradientId = `ek-success-area-${++chartCounter}`;

  protected readonly layout = computed(() => {
    const width = this.width();
    return width > 0 ? layoutSuccessChart(this.points(), width, this.height()) : null;
  });

  protected readonly activeCoord = computed(() => {
    const index = this.active();
    return index === null ? null : (this.layout()?.coords[index] ?? null);
  });

  protected readonly summary = computed(() => {
    const points = this.points();
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return 'Aucune donnée.';
    const best = points.reduce((a, b) => (b.rate > a.rate ? b : a), first);
    return (
      `Évolution du taux de réussite cumulé : ${formatPercent(first.rate)} le ${formatAxisDay(first.time)}, ` +
      `${formatPercent(last.rate)} le ${formatAxisDay(last.time)} ` +
      `(maximum ${formatPercent(best.rate)}, ${plural(last.total, 'session')} sur ${plural(points.length, 'jour')}).`
    );
  });

  protected readonly formatPercent = formatPercent;
  protected readonly formatLongDay = formatLongDay;
  protected readonly formatAxisDay = formatAxisDay;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.plot().nativeElement;
      const measure = () => {
        const width = Math.round(element.clientWidth);
        this.width.set(width);
        this.height.set(width < 480 ? 220 : 250);
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => measure());
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected onPointerMove(event: PointerEvent): void {
    const layout = this.layout();
    if (!layout) return;
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const index = nearestIndex(layout.coords, event.clientX - rect.left);
    this.active.set(index >= 0 ? index : null);
  }

  protected onPointerLeave(): void {
    this.active.set(null);
  }
}
