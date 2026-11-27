/**
 * Arithmetic expression parser equivalent to Activites.Api `Parser` (MathEngine):
 * + - * / with usual precedence, left-to-right evaluation, unary +/-, parentheses,
 * decimal numbers with a dot, 256 characters max, division by zero forbidden.
 *
 * Used for the parent form preview and by the demo engine. In 'api' mode the backend remains the
 * only judge of answers.
 */
export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionError';
  }
}

export const MAX_EXPRESSION_LENGTH = 256;

export function evaluateExpression(expression: string): number {
  if (!expression || !expression.trim() || expression.length > MAX_EXPRESSION_LENGTH) {
    throw new ExpressionError('Expression vide ou trop longue.');
  }
  const parser = new Parser(expression);
  const result = parser.sum();
  parser.space();
  if (!parser.end) {
    throw new ExpressionError(`Caractère inattendu à la position ${parser.position + 1}.`);
  }
  return result;
}

/** Returns the error message, or null when the expression is valid. */
export function validateExpression(expression: string): string | null {
  try {
    evaluateExpression(expression);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Expression invalide.';
  }
}

/** Child-friendly rendering: × ÷ − and thin spaces around operators. */
export function displayExpression(expression: string): string {
  return expression
    .replace(/\s+/g, '')
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/\+/g, ' + ')
    .replace(/(?<=[\d)])-/g, ' − ')
    .replace(/-/g, '−')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .replace(/\./g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

class Parser {
  private i = 0;

  constructor(private readonly text: string) {}

  get position(): number {
    return this.i;
  }

  get end(): boolean {
    return this.i >= this.text.length;
  }

  space(): void {
    while (!this.end && /\s/.test(this.text[this.i] ?? '')) this.i++;
  }

  sum(): number {
    let value = this.product();
    for (;;) {
      this.space();
      if (this.take('+')) value = value + this.product();
      else if (this.take('-')) value = value - this.product();
      else return value;
    }
  }

  private product(): number {
    let value = this.unary();
    for (;;) {
      this.space();
      if (this.take('*')) value = value * this.unary();
      else if (this.take('/')) {
        const divisor = this.unary();
        if (divisor === 0) throw new ExpressionError('La division par zéro est interdite.');
        value = value / divisor;
      } else return value;
    }
  }

  private unary(): number {
    this.space();
    if (this.take('+')) return this.unary();
    if (this.take('-')) return -this.unary();
    if (this.take('(')) {
      const value = this.sum();
      this.space();
      if (!this.take(')')) throw new ExpressionError('Parenthèse fermante manquante.');
      return value;
    }
    return this.number();
  }

  private number(): number {
    this.space();
    const start = this.i;
    let dot = false;
    while (!this.end) {
      const c = this.text[this.i] ?? '';
      if (c >= '0' && c <= '9') {
        this.i++;
      } else if (c === '.') {
        if (dot) break;
        dot = true;
        this.i++;
      } else break;
    }
    const raw = this.text.slice(start, this.i);
    if (start === this.i || !/\d/.test(raw)) {
      throw new ExpressionError(`Nombre attendu à la position ${this.i + 1}.`);
    }
    return Number(raw);
  }

  private take(c: string): boolean {
    if (!this.end && this.text[this.i] === c) {
      this.i++;
      return true;
    }
    return false;
  }
}
