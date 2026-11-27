import {
  applyKeypadKey,
  MATH_MAX_DIGITS,
  normalizeMathInput,
  parseMathAnswer,
  toMathAnswer,
} from './math-answer';

describe('math answer input', () => {
  it('normalizes keyboard input and keeps only one leading sign and decimal separator', () => {
    expect(normalizeMathInput('−3.5')).toBe('-3,5');
    expect(normalizeMathInput('1,2,3')).toBe('1,23');
    expect(normalizeMathInput('5-3')).toBe('53');
    expect(normalizeMathInput('1a2')).toBe('12');
  });

  it('accepts decimals and negative values while rejecting incomplete input', () => {
    expect(parseMathAnswer('-3,5')).toBe(-3.5);
    expect(parseMathAnswer('.25')).toBe(0.25);
    expect(parseMathAnswer('3,')).toBeNull();
    expect(parseMathAnswer('-')).toBeNull();
    expect(toMathAnswer('12')).toEqual({ value: 12 });
  });

  it('supports keypad sign, decimal, backspace, clear-by-backspace and digit limits', () => {
    expect(applyKeypadKey('', '-')).toBe('-');
    expect(applyKeypadKey('-', '4')).toBe('-4');
    expect(applyKeypadKey('3', ',')).toBe('3,');
    expect(applyKeypadKey('3,5', ',')).toBe('3,5');
    expect(applyKeypadKey('3,5', 'back')).toBe('3,');
    expect(applyKeypadKey('123', '-')).toBe('-123');
    expect(applyKeypadKey('1'.repeat(MATH_MAX_DIGITS), '9')).toBe('1'.repeat(MATH_MAX_DIGITS));
  });
});
