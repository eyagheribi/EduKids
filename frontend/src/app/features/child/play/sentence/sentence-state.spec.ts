import {
  bankTokens,
  EMPTY_SENTENCE,
  isSentenceComplete,
  placeToken,
  returnToken,
  shiftToken,
  toSentenceAnswer,
} from './sentence-state';

describe('sentence ordering state', () => {
  it('moves tokens between the bank and the phrase without collapsing repeated words', () => {
    let state = placeToken(EMPTY_SENTENCE, 'word-1');
    state = placeToken(state, 'word-2');
    state = placeToken(state, 'word-3');

    expect(state.placed).toEqual(['word-1', 'word-2', 'word-3']);
    expect(bankTokens(state, ['word-1', 'word-2', 'word-3'])).toEqual([]);
    expect(placeToken(state, 'word-2')).toBe(state);
    expect(returnToken(state, 'word-2').placed).toEqual(['word-1', 'word-3']);
  });

  it('reorders placed ids while preserving the original ids', () => {
    const state = { placed: ['first', 'repeat-a', 'repeat-b'] };

    expect(shiftToken(state, 'repeat-b', -1).placed).toEqual(['first', 'repeat-b', 'repeat-a']);
    expect(shiftToken(state, 'first', -1)).toBe(state);
  });

  it('requires all unique token ids before producing a backend answer', () => {
    const tokenIds = ['first', 'repeat-a', 'repeat-b'];
    let state = placeToken(EMPTY_SENTENCE, tokenIds[0]!);
    state = placeToken(state, tokenIds[1]!);
    expect(isSentenceComplete(state, tokenIds)).toBe(false);

    state = placeToken(state, tokenIds[2]!);
    expect(isSentenceComplete(state, tokenIds)).toBe(true);
    expect(toSentenceAnswer(state)).toEqual({ tokens: tokenIds });
  });
});
