import { Pipe, PipeTransform } from '@angular/core';
import {
  formatDuration,
  formatFullDateTime,
  formatNumber,
  formatPercent,
  formatRelativeDateTime,
  formatShortDate,
} from './format';

/** {{ date | ekRelativeDate }} → « Aujourd'hui, 16:20 » */
@Pipe({ name: 'ekRelativeDate' })
export class RelativeDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    return formatRelativeDateTime(value);
  }
}

/** {{ date | ekFullDate }} → « lundi 24 novembre 2026 à 16:20 » */
@Pipe({ name: 'ekFullDate' })
export class FullDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    return formatFullDateTime(value);
  }
}

/** {{ date | ekShortDate }} → « 24 nov. » */
@Pipe({ name: 'ekShortDate' })
export class ShortDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    return formatShortDate(value);
  }
}

/** {{ 1.85 | ekNumber }} → « 1,9 » ; {{ x | ekNumber: 2 }} */
@Pipe({ name: 'ekNumber' })
export class NumberFrPipe implements PipeTransform {
  transform(value: number | null | undefined, maxDecimals = 1): string {
    return formatNumber(value, maxDecimals);
  }
}

/** {{ 70 | ekPercent }} → « 70 % » (input already a percentage) */
@Pipe({ name: 'ekPercent' })
export class PercentFrPipe implements PipeTransform {
  transform(value: number | null | undefined, maxDecimals = 0): string {
    return formatPercent(value, maxDecimals);
  }
}

/** {{ startedAt | ekDuration: completedAt }} → « 2 min 05 s » */
@Pipe({ name: 'ekDuration' })
export class DurationPipe implements PipeTransform {
  transform(from: string | Date | null | undefined, to: string | Date | null | undefined): string {
    return formatDuration(from, to);
  }
}
