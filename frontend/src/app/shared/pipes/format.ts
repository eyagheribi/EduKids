// French formatting helpers (pure functions, also exposed as pipes).

const NARROW_NBSP = ' ';

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayMonthFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dayMonthYearFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fullFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** « Aujourd'hui, 16:20 » · « Hier, 18:05 » · « Demain, 09:00 » · « 21 nov., 14:02 ». */
export function formatRelativeDateTime(value: string | number | Date | null | undefined, now = new Date()): string {
  const date = toDate(value);
  if (!date) return '—';
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  const time = timeFormat.format(date);
  if (days === 0) return `Aujourd’hui, ${time}`;
  if (days === -1) return `Hier, ${time}`;
  if (days === 1) return `Demain, ${time}`;
  const day = date.getFullYear() === now.getFullYear() ? dayMonthFormat.format(date) : dayMonthYearFormat.format(date);
  return `${day}, ${time}`;
}

/** « lundi 24 novembre 2026 à 16:20 ». */
export function formatFullDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? fullFormat.format(date) : '—';
}

/** « 24 nov. » */
export function formatShortDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dayMonthFormat.format(date) : '—';
}

/** 1.8 → « 1,8 ». */
export function formatNumber(value: number | null | undefined, maxDecimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: maxDecimals }).format(value);
}

/** 70 → « 70 % » (value already in percent). */
export function formatPercent(value: number | null | undefined, maxDecimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value, maxDecimals)}${NARROW_NBSP}%`;
}

/** Duration between two dates: « 2 min 05 s », « 1 h 12 min ». */
export function formatDuration(from: string | Date | null | undefined, to: string | Date | null | undefined): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return '—';
  const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** Remaining time « 04:59 » (mm:ss) until a date. */
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
