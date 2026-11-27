import { formatAvailabilityCountdown, resolveCategoryGameState } from './child-category.page';

describe('child category game state', () => {
  it('keeps the backend availability authoritative and distinguishes resumable and successful sessions', () => {
    expect(resolveCategoryGameState({ available: true, nextAvailableAt: null }, null)).toBe('available');
    expect(resolveCategoryGameState({ available: true, nextAvailableAt: null }, { status: 'ACTIVE' })).toBe(
      'in-progress',
    );
    expect(resolveCategoryGameState({ available: true, nextAvailableAt: null }, { status: 'SUCCESS' })).toBe('won');
    expect(
      resolveCategoryGameState(
        { available: false, nextAvailableAt: '2026-04-04T12:00:00Z' },
        { status: 'SUCCESS' },
      ),
    ).toBe('blocked');
  });

  it('formats the actual availability date and omits invalid or expired countdowns', () => {
    const now = Date.parse('2026-04-03T12:00:00Z');
    expect(formatAvailabilityCountdown('2026-04-04T11:45:00Z', now)).toBe('Disponible dans 23 h 45 min');
    expect(formatAvailabilityCountdown('2026-04-03T12:45:00Z', now)).toBe('Disponible dans 45 min');
    expect(formatAvailabilityCountdown('2026-04-03T11:59:00Z', now)).toBe('');
    expect(formatAvailabilityCountdown(null, now)).toBe('');
  });
});
