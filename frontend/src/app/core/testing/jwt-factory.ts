/** Builds an unsigned JWT for tests (the frontend never verifies signatures). */
export function fakeJwt(payload: Record<string, unknown>): string {
  // Real JWT payloads are UTF-8 then base64url encoded.
  const encode = (value: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

export function parentToken(expInSeconds = 3600, sub = 'parent-1'): string {
  return fakeJwt({ sub, role: 'Parent', exp: Math.floor(Date.now() / 1000) + expInSeconds });
}

export function childToken(expInSeconds = 3600, espaceId = 'space-1'): string {
  return fakeJwt({ sub: espaceId, role: 'Enfant', espaceId, exp: Math.floor(Date.now() / 1000) + expInSeconds });
}
