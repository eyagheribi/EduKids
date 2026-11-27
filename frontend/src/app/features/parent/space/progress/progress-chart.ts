// Geometry of the hand-made « Évolution du taux de réussite » line chart (pure, unit tested).
import { formatPercent } from '../../../../shared/pipes/format';
import { formatAxisDay, SuccessPoint } from './progress.utils';

export interface ChartPadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export const CHART_PADDING: ChartPadding = { top: 46, right: 18, bottom: 34, left: 50 };

/** Horizontal breathing room between the axis and the first / last point. */
const INSET = 14;
const BUBBLE_HEIGHT = 28;

export interface ChartCoord {
  readonly x: number;
  readonly y: number;
  readonly point: SuccessPoint;
}

export interface ChartTick {
  readonly position: number;
  readonly label: string;
}

export interface ChartBubble {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Tip of the pointer (the last point). */
  readonly tipX: number;
  readonly tipY: number;
  readonly label: string;
}

export interface ChartLayout {
  readonly width: number;
  readonly height: number;
  readonly plotLeft: number;
  readonly plotRight: number;
  readonly plotTop: number;
  readonly plotBottom: number;
  readonly coords: readonly ChartCoord[];
  readonly linePath: string;
  readonly areaPath: string;
  readonly yTicks: readonly ChartTick[];
  readonly xTicks: readonly ChartTick[];
  readonly bubble: ChartBubble | null;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Picks the x labels to display so that they never overlap (first and last are always kept). */
export function pickLabelIndexes(xs: readonly number[], minGap: number): number[] {
  if (!xs.length) return [];
  if (xs.length === 1) return [0];
  const lastIndex = xs.length - 1;
  const lastX = xs[lastIndex] ?? 0;
  const picked = [0];
  for (let i = 1; i < lastIndex; i++) {
    const x = xs[i] ?? 0;
    const previous = xs[picked[picked.length - 1] ?? 0] ?? 0;
    if (x - previous >= minGap && lastX - x >= minGap) picked.push(i);
  }
  const previous = xs[picked[picked.length - 1] ?? 0] ?? 0;
  if (picked.length > 1 && lastX - previous < minGap) picked.pop();
  picked.push(lastIndex);
  return picked;
}

/**
 * Computes the SVG geometry for a series of cumulative success rates. X is proportional to time
 * (days), Y goes from 0 % (bottom) to 100 % (top).
 */
export function layoutSuccessChart(
  points: readonly SuccessPoint[],
  width: number,
  height: number,
  padding: ChartPadding = CHART_PADDING,
): ChartLayout {
  const plotLeft = padding.left;
  const plotRight = Math.max(plotLeft + 1, width - padding.right);
  const plotTop = padding.top;
  const plotBottom = Math.max(plotTop + 1, height - padding.bottom);
  const xStart = plotLeft + INSET;
  const xEnd = Math.max(xStart, plotRight - INSET);

  const t0 = points[0]?.time ?? 0;
  const t1 = points[points.length - 1]?.time ?? t0;
  const span = t1 - t0;
  const xOf = (time: number) => (span > 0 ? xStart + ((time - t0) / span) * (xEnd - xStart) : (xStart + xEnd) / 2);
  const yOf = (rate: number) => plotBottom - (Math.max(0, Math.min(100, rate)) / 100) * (plotBottom - plotTop);

  const coords: ChartCoord[] = points.map((point) => ({ x: round(xOf(point.time)), y: round(yOf(point.rate)), point }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' ');
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPath =
    first && last ? `${linePath} L${last.x} ${round(plotBottom)} L${first.x} ${round(plotBottom)} Z` : '';

  const yTicks: ChartTick[] = [0, 20, 40, 60, 80, 100].map((value) => ({
    position: round(yOf(value)),
    label: formatPercent(value),
  }));

  const minGap = Math.max(62, (xEnd - xStart) / 5.5);
  const xTicks: ChartTick[] = pickLabelIndexes(
    coords.map((c) => c.x),
    minGap,
  ).map((index) => {
    const coord = coords[index] as ChartCoord;
    return { position: coord.x, label: formatAxisDay(coord.point.time) };
  });

  let bubble: ChartBubble | null = null;
  if (last) {
    const label = formatPercent(last.point.rate);
    const bubbleWidth = Math.round(label.length * 8.6 + 22);
    const x = Math.min(Math.max(last.x - bubbleWidth / 2, plotLeft), width - bubbleWidth - 2);
    bubble = {
      x: round(x),
      y: round(Math.max(2, last.y - 14 - BUBBLE_HEIGHT)),
      width: bubbleWidth,
      height: BUBBLE_HEIGHT,
      tipX: last.x,
      tipY: last.y,
      label,
    };
  }

  return { width, height, plotLeft, plotRight, plotTop, plotBottom, coords, linePath, areaPath, yTicks, xTicks, bubble };
}

/** Index of the point closest to an x coordinate (pointer tracking). */
export function nearestIndex(coords: readonly ChartCoord[], x: number): number {
  let best = -1;
  let bestDistance = Infinity;
  coords.forEach((c, i) => {
    const distance = Math.abs(c.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}
