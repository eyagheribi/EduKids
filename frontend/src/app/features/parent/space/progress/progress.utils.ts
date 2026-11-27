// Pure helpers of the parent progress dashboard (« Résultats et progrès »).
// Kept framework-free so they can be unit tested in isolation.
import { GameType, readProp } from '../../../../core/models/activites.models';
import { CategoryTone, categoryForGameType } from '../../../../core/models/categories';
import {
  FINAL_STATUS_LABELS,
  FinalStatus,
  HistoryQuery,
  parseJsonString,
  SessionSummaryDto,
} from '../../../../core/models/suivi.models';
import { formatNumber } from '../../../../shared/pipes/format';
import { IconName } from '../../../../shared/ui/icon/icon.data';

const NBSP = ' ';

/* ───────────────────────── Categories & statuses ───────────────────────── */

/** Colour of a game type (chips, progress bars): maths green, association purple, ordering blue. */
export function gameTypeTone(type: GameType | string | null | undefined): CategoryTone {
  return categoryForGameType(type)?.tone ?? 'purple';
}

export type StatusTone = 'green' | 'red' | 'orange';

export interface StatusView {
  readonly label: string;
  readonly tone: StatusTone;
  readonly icon: IconName;
}

const STATUS_VIEWS: Readonly<Record<FinalStatus, StatusView>> = {
  SUCCESS: { label: FINAL_STATUS_LABELS.SUCCESS, tone: 'green', icon: 'check-circle' },
  FAILED: { label: FINAL_STATUS_LABELS.FAILED, tone: 'red', icon: 'x-circle' },
  UNFINISHED: { label: FINAL_STATUS_LABELS.UNFINISHED, tone: 'orange', icon: 'hourglass' },
};

export function statusView(status: FinalStatus): StatusView {
  return STATUS_VIEWS[status] ?? STATUS_VIEWS.UNFINISHED;
}

/** « 1 session » / « 12 sessions ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count, 0)}${NBSP}${count > 1 ? pluralForm : singular}`;
}

/* ───────────────────────── Scores ───────────────────────── */

export type ScoreKind = 'success' | 'partial' | 'zero' | 'unknown';

type ScoreSource = Pick<SessionSummaryDto, 'finalStatus' | 'finalScore' | 'finalMaxScore'>;

/** How a final score is displayed: green check (success), yellow star (partial), plain (zero). */
export function scoreKind(session: ScoreSource): ScoreKind {
  const max = session.finalMaxScore;
  if (max === null || max === undefined || max <= 0) return 'unknown';
  if (session.finalStatus === 'SUCCESS' || session.finalScore >= max) return 'success';
  return session.finalScore > 0 ? 'partial' : 'zero';
}

/** « 3 / 4 » (non-breaking spaces), « — » when the maximum is unknown. */
export function formatScore(score: number | null | undefined, max: number | null | undefined): string {
  if (score === null || score === undefined || max === null || max === undefined) return '—';
  return `${formatNumber(score, 2)}${NBSP}/${NBSP}${formatNumber(max, 2)}`;
}

/** Percentage (0–100, rounded) of score / max, null when unknown. */
export function scorePercent(score: number | null | undefined, max: number | null | undefined): number | null {
  if (score === null || score === undefined || max === null || max === undefined || max <= 0) return null;
  return Math.round((Math.max(0, score) / max) * 100);
}

/** « 2 / 3 » attempts. */
export function formatAttempts(used: number, max: number): string {
  return `${formatNumber(used, 0)}${NBSP}/${NBSP}${formatNumber(max, 0)}`;
}

/* ───────────────────────── History filters ───────────────────────── */

export type SortOrder = 'asc' | 'desc';

export interface HistoryFilters {
  readonly gameType: GameType | '';
  readonly finalStatus: FinalStatus | '';
  /** yyyy-mm-dd (value of <input type="date">), '' when empty. */
  readonly from: string;
  readonly to: string;
  readonly sortOrder: SortOrder;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  gameType: '',
  finalStatus: '',
  from: '',
  to: '',
  sortOrder: 'desc',
};

export const HISTORY_PAGE_SIZE = 10;

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converts the value of a date input (yyyy-mm-dd, local calendar day) into an ISO 8601 instant:
 * the start of the day (00:00:00.000 local) or its end (23:59:59.999 local). Null when invalid.
 */
export function dateInputToIso(value: string | null | undefined, edge: 'start' | 'end'): string | null {
  const match = DATE_INPUT.exec((value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date =
    edge === 'start' ? new Date(year, month, day, 0, 0, 0, 0) : new Date(year, month, day, 23, 59, 59, 999);
  // Rejects impossible days (2026-02-31 would silently roll over to March).
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date.toISOString();
}

/** French message when the date range is inverted, null otherwise. */
export function dateRangeError(filters: Pick<HistoryFilters, 'from' | 'to'>): string | null {
  const from = dateInputToIso(filters.from, 'start');
  const to = dateInputToIso(filters.to, 'end');
  if (from && to && Date.parse(from) > Date.parse(to)) {
    return 'La date de début doit précéder la date de fin.';
  }
  return null;
}

export function hasActiveFilters(filters: HistoryFilters): boolean {
  return (
    filters.gameType !== '' ||
    filters.finalStatus !== '' ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.sortOrder !== DEFAULT_HISTORY_FILTERS.sortOrder
  );
}

/** Builds the Suivi.Api history query (empty filters are omitted). */
export function filtersToQuery(filters: HistoryFilters, page: number, pageSize = HISTORY_PAGE_SIZE): HistoryQuery {
  return {
    gameType: filters.gameType || null,
    finalStatus: filters.finalStatus || null,
    from: dateInputToIso(filters.from, 'start'),
    to: dateInputToIso(filters.to, 'end'),
    sortOrder: filters.sortOrder,
    page: Math.max(1, Math.floor(page)),
    pageSize,
  };
}

/* ───────────────────────── Success-rate chart ───────────────────────── */

export interface SuccessPoint {
  /** Local calendar day (yyyy-mm-dd). */
  readonly day: string;
  /** Local midnight of that day (epoch ms). */
  readonly time: number;
  /** Cumulative success rate at the end of the day, 0–100. */
  readonly rate: number;
  /** Cumulative counts at the end of the day. */
  readonly successes: number;
  readonly total: number;
  /** Sessions completed that day. */
  readonly dayTotal: number;
  readonly daySuccesses: number;
}

function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Cumulative success rate per local day: for each day with at least one completed session, the share
 * of successful sessions among every session completed up to the end of that day.
 */
export function cumulativeSuccessSeries(
  sessions: readonly Pick<SessionSummaryDto, 'completedAt' | 'finalStatus'>[],
): SuccessPoint[] {
  const dated = sessions
    .map((s) => ({ time: Date.parse(s.completedAt), success: s.finalStatus === 'SUCCESS' }))
    .filter((s) => Number.isFinite(s.time))
    .sort((a, b) => a.time - b.time);

  const points: SuccessPoint[] = [];
  let successes = 0;
  let total = 0;
  for (const session of dated) {
    const date = new Date(session.time);
    const key = dayKey(date);
    total += 1;
    if (session.success) successes += 1;
    const last = points[points.length - 1];
    const sameDay = last?.day === key;
    const point: SuccessPoint = {
      day: key,
      time: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
      rate: Math.round((successes / total) * 1000) / 10,
      successes,
      total,
      dayTotal: (sameDay ? last.dayTotal : 0) + 1,
      daySuccesses: (sameDay ? last.daySuccesses : 0) + (session.success ? 1 : 0),
    };
    if (sameDay) points[points.length - 1] = point;
    else points.push(point);
  }
  return points;
}

const axisDayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const longDayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Axis label « 10 nov » (abbreviation without the final dot, like the mockup). */
export function formatAxisDay(time: number): string {
  return axisDayFormat.format(new Date(time)).replace(/\./g, '');
}

/** « lundi 10 novembre ». */
export function formatLongDay(time: number): string {
  return longDayFormat.format(new Date(time));
}

/* ───────────────────────── Submitted answers ───────────────────────── */

export type AnswerSummary =
  | { readonly kind: 'math'; readonly value: number }
  | { readonly kind: 'matching'; readonly count: number }
  | { readonly kind: 'sentence'; readonly count: number }
  | { readonly kind: 'unknown' };

/** Reads the JSON text of a submitted answer (Suivi stores it verbatim). */
export function summarizeAnswer(type: GameType, submittedAnswer: string | null | undefined): AnswerSummary {
  const parsed = parseJsonString(submittedAnswer);
  switch (type) {
    case 'MATH': {
      const raw = readProp(parsed, 'value');
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
      return Number.isFinite(value) ? { kind: 'math', value } : { kind: 'unknown' };
    }
    case 'MATCHING': {
      const matches = readProp(parsed, 'matches');
      return matches !== null && typeof matches === 'object' && !Array.isArray(matches)
        ? { kind: 'matching', count: Object.keys(matches).length }
        : { kind: 'unknown' };
    }
    case 'SENTENCE_ORDERING': {
      const tokens = readProp(parsed, 'tokens');
      return Array.isArray(tokens) ? { kind: 'sentence', count: tokens.length } : { kind: 'unknown' };
    }
    default:
      return { kind: 'unknown' };
  }
}

/** « 19 » · « 4 associations envoyées » · « 6 mots placés ». */
export function answerLabel(summary: AnswerSummary): string {
  switch (summary.kind) {
    case 'math':
      return formatNumber(summary.value, 6);
    case 'matching':
      return summary.count > 1
        ? `${summary.count}${NBSP}associations envoyées`
        : `${summary.count}${NBSP}association envoyée`;
    case 'sentence':
      return summary.count > 1 ? `${summary.count}${NBSP}mots placés` : `${summary.count}${NBSP}mot placé`;
    default:
      return 'Réponse illisible';
  }
}

/** Pretty-prints a JSON string (returns the raw text when it is not valid JSON). */
export function prettyJson(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
