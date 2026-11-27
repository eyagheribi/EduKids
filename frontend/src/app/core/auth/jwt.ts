/** Claims issued by Comptes.Api (parent) and Espaces.Api (child). */
export interface EduKidsJwtPayload {
  readonly sub?: string;
  readonly role?: string;
  /** Child tokens only. */
  readonly espaceId?: string;
  /** Expiry, seconds since epoch. */
  readonly exp?: number;
  readonly [claim: string]: unknown;
}

/**
 * Decodes the payload of a JWT WITHOUT verifying it. Only used client-side to read the expiry and
 * routing claims; every API keeps validating the signature itself.
 */
export function decodeJwt(token: string): EduKidsJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const payload: unknown = JSON.parse(json);
    return payload && typeof payload === 'object' ? (payload as EduKidsJwtPayload) : null;
  } catch {
    return null;
  }
}

/** Expiry in milliseconds since epoch, or null when the token has no exp claim. */
export function tokenExpiry(payload: EduKidsJwtPayload | null): number | null {
  return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
}
