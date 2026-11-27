import { TestBed } from '@angular/core/testing';
import { decodeJwt } from './jwt';
import { SessionService } from './session.service';
import { childToken, fakeJwt, parentToken } from '../testing/jwt-factory';

describe('decodeJwt', () => {
  it('reads base64url payloads with UTF-8 characters', () => {
    const token = fakeJwt({ sub: 'x', nom: 'Éloïse' });
    expect(decodeJwt(token)?.['nom']).toBe('Éloïse');
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('a.%%%.c')).toBeNull();
  });
});

describe('SessionService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('stores a parent session from a Comptes.Api token', () => {
    const service = TestBed.inject(SessionService);
    const session = service.startParentSession(parentToken(), ' parent@test.fr ');
    expect(session.userId).toBe('parent-1');
    expect(session.email).toBe('parent@test.fr');
    expect(service.isParentAuthenticated()).toBe(true);
    expect(service.tokenFor('parent')).toBe(session.token);
    expect(JSON.parse(localStorage.getItem('edukids.session.parent') ?? '{}').userId).toBe('parent-1');
  });

  it('rejects a child token used as parent token', () => {
    const service = TestBed.inject(SessionService);
    expect(() => service.startParentSession(childToken(), 'x@y.z')).toThrow();
  });

  it('stores a child session with the espaceId claim', () => {
    const service = TestBed.inject(SessionService);
    const session = service.startChildSession(childToken(3600, 'abc'), 'Adam');
    expect(session.spaceId).toBe('abc');
    expect(service.isChildAuthenticated()).toBe(true);
    expect(service.isParentAuthenticated()).toBe(false);
  });

  it('ends expired sessions and remembers the reason', () => {
    const service = TestBed.inject(SessionService);
    service.startParentSession(parentToken(5), 'p@test.fr'); // expires within the skew window
    expect(service.tokenFor('parent')).toBeNull();
    expect(service.consumeEndReason('parent')).toBe('expired');
    expect(service.consumeEndReason('parent')).toBeNull();
  });

  it('drops an expired stored session at startup', () => {
    localStorage.setItem(
      'edukids.session.child',
      JSON.stringify({ token: 'x', spaceId: 's', nomEnfant: 'A', expiresAt: Date.now() - 1000 }),
    );
    const service = TestBed.inject(SessionService);
    expect(service.child()).toBeNull();
    expect(service.consumeEndReason('child')).toBe('expired');
  });

  it('keeps parent and child sessions independent', () => {
    const service = TestBed.inject(SessionService);
    service.startParentSession(parentToken(), 'p@test.fr');
    service.startChildSession(childToken(), 'Adam');
    service.end('child');
    expect(service.isParentAuthenticated()).toBe(true);
    expect(service.isChildAuthenticated()).toBe(false);
  });
});
