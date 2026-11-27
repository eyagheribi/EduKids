import { displayExpression, evaluateExpression, validateExpression } from './math-expression';

// Same cases as tests/Activites.Api.Tests/EngineTests.cs.
describe('evaluateExpression (MathEngine parity)', () => {
  it.each([
    ['11+111', 122],
    ['(4-7)+8-(4*0)', 5],
    ['12 / 3 + 5 * (2 - 1)', 9],
    ['-(2 + 3) * 2', -10],
    ['1.5 + 2.25', 3.75],
  ])('evaluates %s = %d', (expression, expected) => {
    expect(evaluateExpression(expression)).toBeCloseTo(expected, 6);
  });

  it.each([['10/0'], ['4++*3'], ['(5+2']])('rejects %s', (expression) => {
    expect(() => evaluateExpression(expression)).toThrow();
  });

  it('returns the backend messages', () => {
    expect(validateExpression('10/0')).toBe('La division par zéro est interdite.');
    expect(validateExpression('(5+2')).toBe('Parenthèse fermante manquante.');
    expect(validateExpression('4++*3')).toBe('Nombre attendu à la position 4.');
    expect(validateExpression('2 + 2)')).toBe('Caractère inattendu à la position 6.');
    expect(validateExpression('   ')).toBe('Expression vide ou trop longue.');
    expect(validateExpression('1'.repeat(257))).toBe('Expression vide ou trop longue.');
    expect(validateExpression('3 * (2 + 1)')).toBeNull();
  });
});

describe('displayExpression', () => {
  it('renders child-friendly operators', () => {
    expect(displayExpression('12/3+5*(2-1)')).toBe('12 ÷ 3 + 5 × (2 − 1)');
    expect(displayExpression('-(2+3)*2')).toBe('−(2 + 3) × 2');
    expect(displayExpression('1.5+2')).toBe('1,5 + 2');
  });
});
