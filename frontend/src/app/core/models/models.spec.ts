import { parseGameContent, toCorrection, toPlayable, tokenizeSentence } from './activites.models';
import { categoriesForSpace, categoryForGameType, inactiveCategories } from './categories';
import { normalizeAccessCode, parseActivites } from './espaces.models';

describe('Activites.Api normalizers', () => {
  it('reads the PascalCase MATCHING playable (right column labelled "Left")', () => {
    const playable = toPlayable({
      gameId: 'g',
      type: 'MATCHING',
      content: {
        Left: [{ Id: 'l1', Left: 'Rouge' }],
        Right: [{ Id: 'r1', Left: 'Red' }],
      },
    });
    expect(playable).toEqual({
      type: 'MATCHING',
      left: [{ id: 'l1', label: 'Rouge' }],
      right: [{ id: 'r1', label: 'Red' }],
    });
  });

  it('reads the SENTENCE_ORDERING playable in token order', () => {
    const playable = toPlayable({
      gameId: 'g',
      type: 'SENTENCE_ORDERING',
      content: { Tokens: ['b', 'a'], Words: { a: 'Le', b: 'chat' } },
    });
    expect(playable).toEqual({
      type: 'SENTENCE_ORDERING',
      tokens: [
        { id: 'b', label: 'chat' },
        { id: 'a', label: 'Le' },
      ],
    });
  });

  it('reads the MATH playable', () => {
    expect(toPlayable({ gameId: 'g', type: 'MATH', content: { expression: '2 + 2' } })).toEqual({
      type: 'MATH',
      expression: '2 + 2',
    });
  });

  it('reads corrections of each engine', () => {
    expect(toCorrection('MATH', 4)).toEqual({ type: 'MATH', expected: 4 });
    expect(toCorrection('MATCHING', [{ Id: 'x', Left: 'Rouge', Right: 'Red' }])).toEqual({
      type: 'MATCHING',
      pairs: [{ left: 'Rouge', right: 'Red' }],
    });
    expect(toCorrection('SENTENCE_ORDERING', 'Le chat dort.')).toEqual({
      type: 'SENTENCE_ORDERING',
      sentence: 'Le chat dort.',
    });
    expect(toCorrection('MATH', null)).toBeNull();
  });

  it('parses Suivi JSON-text snapshots and GameDto objects alike', () => {
    expect(parseGameContent('MATH', '{"expression":"1 + 1"}')).toEqual({ type: 'MATH', expression: '1 + 1' });
    expect(parseGameContent('SENTENCE_ORDERING', { sentence: 'A b' })).toEqual({
      type: 'SENTENCE_ORDERING',
      sentence: 'A b',
    });
    const matching = parseGameContent('MATCHING', '{"pairs":[{"id":"1","left":"a","right":"b"}]}');
    expect(matching?.type === 'MATCHING' && matching.pairs[0]?.right).toBe('b');
  });

  it('tokenizes like SentenceOrderingEngine (punctuation stays attached)', () => {
    expect(tokenizeSentence('  Le  chat dort.  ')).toEqual(['Le', 'chat', 'dort.']);
  });
});

describe('Espaces.Api helpers', () => {
  it('normalizes access codes', () => {
    expect(normalizeAccessCode(' a7k-9p2x ')).toBe('A7K9P2');
  });

  it('parses comma-separated and array activities, ignoring unknown values', () => {
    expect(parseActivites('Maths,Association')).toEqual(['Maths', 'Association']);
    expect(parseActivites(['Dictee', 'Lecture', 'Dictee'])).toEqual(['Dictee']);
  });
});

describe('categories mapping', () => {
  it('maps every enabled Espaces activity onto its available engine', () => {
    const demo = categoriesForSpace(['Maths', 'Dictee'], 'demo');
    expect(demo.map((c) => [c.category.id, c.availability])).toEqual([
      ['maths', 'active'],
      ['dictee', 'active'],
    ]);
    const api = categoriesForSpace(['Association'], 'api');
    expect(api.map((c) => c.category.id)).toEqual(['association']);
  });

  it('lists activatable categories that are still disabled', () => {
    expect(inactiveCategories(['Maths']).map((c) => c.espacesKey)).toEqual(['Association', 'Ordonnancement', 'Dictee']);
  });

  it('finds categories from engine types', () => {
    expect(categoryForGameType('MATCHING')?.id).toBe('association');
    expect(categoryForGameType('SENTENCE_ORDERING')?.id).toBe('ordonnancement');
    expect(categoryForGameType('DICTATION')?.id).toBe('dictee');
  });
});
