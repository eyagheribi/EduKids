// MATH answer field: the child types « 12 », « 3,5 », « -4 » (or « 3.5 », « −4 ») with the keyboard or
// the on-screen keypad. The text is kept in a canonical form ('-' and ',') and only turned into
// { value: number } when it is a complete number. The backend decides whether it is right.
import { MathAnswer } from '../../../../core/models/activites.models';

/** Digits accepted in the answer (without sign and separator). */
export const MATH_MAX_DIGITS = 10;

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | '-' | 'back';

const DIGIT = /^\d$/;

/**
 * Canonical text of the field: optional leading '-', digits, at most one ','.
 * « 3.5 » → « 3,5 » · « −4 » → « -4 » · « 1a2 » → « 12 » · « 5-3 » → « 53 ».
 */
export function normalizeMathInput(raw: string): string {
  let text = raw
    .replace(/[−–—]/g, '-')
    .replace(/\./g, ',')
    .replace(/[^\d,-]/g, '');
  const negative = text.startsWith('-');
  text = text.replace(/-/g, '');
  const comma = text.indexOf(',');
  if (comma >= 0) text = text.slice(0, comma + 1) + text.slice(comma + 1).replace(/,/g, '');
  let digits = 0;
  let limited = '';
  for (const char of text) {
    if (DIGIT.test(char)) {
      if (digits >= MATH_MAX_DIGITS) continue;
      digits++;
    }
    limited += char;
  }
  return (negative ? '-' : '') + limited;
}

/** Number typed by the child, or null while it is not a valid number (« », « - », « , »…). */
export function parseMathAnswer(text: string): number | null {
  const canonical = normalizeMathInput(text.trim());
  if (canonical !== text.trim().replace(/[−–—]/g, '-').replace(/\./g, ',')) return null;
  if (!/^-?(\d+(,\d*)?|,\d+)$/.test(canonical)) return null;
  const value = Number(canonical.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** Builds the request body, or null when the field does not hold a number. */
export function toMathAnswer(text: string): MathAnswer | null {
  const value = parseMathAnswer(text);
  return value === null ? null : { value };
}

/** Applies an on-screen keypad key to the canonical text. */
export function applyKeypadKey(text: string, key: KeypadKey): string {
  const current = normalizeMathInput(text);
  const negative = current.startsWith('-');
  const body = negative ? current.slice(1) : current;
  switch (key) {
    case 'back':
      return current.slice(0, -1);
    case '-':
      return negative ? body : `-${body}`;
    case ',':
      if (body.includes(',')) return current;
      return `${negative ? '-' : ''}${body === '' ? '0' : body},`;
    default: {
      // « 0 » followed by a digit becomes that digit (no « 05 »).
      const next = body === '0' ? key : body + key;
      return normalizeMathInput(`${negative ? '-' : ''}${next}`);
    }
  }
}

/** Text shown to the child: typographic minus. */
export function displayMathInput(text: string): string {
  return text.replace(/-/g, '−');
}

/** Words read by screen readers for an expression already passed through displayExpression(). */
export function speakExpression(display: string): string {
  return display
    .replace(/×/g, ' fois ')
    .replace(/÷/g, ' divisé par ')
    .replace(/−/g, ' moins ')
    .replace(/\+/g, ' plus ')
    .replace(/\(/g, ' parenthèse ouvrante ')
    .replace(/\)/g, ' parenthèse fermante ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
