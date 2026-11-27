import {
  EMPTY_MATCHING,
  isMatchingComplete,
  pairOf,
  tapItem,
  toMatchingAnswer,
} from './matching-state';

describe('matching game state', () => {
  it('creates a pair by selecting one item in each column', () => {
    const selected = tapItem(EMPTY_MATCHING, 'left', 'left-a');
    const paired = tapItem(selected, 'right', 'right-b');

    expect(paired.selected).toBeNull();
    expect(pairOf(paired, 'left', 'left-a')).toEqual({ left: 'left-a', right: 'right-b', slot: 1 });
    expect(pairOf(paired, 'right', 'right-b')).toEqual({ left: 'left-a', right: 'right-b', slot: 1 });
  });

  it('allows links to be removed and reuses their color slot', () => {
    let state = tapItem(EMPTY_MATCHING, 'left', 'left-a');
    state = tapItem(state, 'right', 'right-a');
    state = tapItem(state, 'left', 'left-b');
    state = tapItem(state, 'right', 'right-b');
    state = tapItem(state, 'right', 'right-a');

    expect(state.pairs).toEqual([{ left: 'left-b', right: 'right-b', slot: 2 }]);
    state = tapItem(state, 'left', 'left-b');
    expect(state.pairs).toEqual([]);
    state = tapItem(state, 'left', 'left-a');
    state = tapItem(state, 'right', 'right-a');
    expect(state.pairs[0]?.slot).toBe(1);
  });

  it('requires every left item and emits the chosen id mapping', () => {
    let state = tapItem(EMPTY_MATCHING, 'left', 'left-a');
    state = tapItem(state, 'right', 'right-a');
    expect(isMatchingComplete(state, ['left-a', 'left-b'])).toBe(false);

    state = tapItem(state, 'left', 'left-b');
    state = tapItem(state, 'right', 'right-b');
    expect(isMatchingComplete(state, ['left-a', 'left-b'])).toBe(true);
    expect(toMatchingAnswer(state)).toEqual({ matches: { 'left-a': 'right-a', 'left-b': 'right-b' } });
  });
});
