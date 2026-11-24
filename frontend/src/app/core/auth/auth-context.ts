import { HttpContext, HttpContextToken } from '@angular/common/http';
import { ServiceName } from '../config/app-config';

/** Which signed-in user a request acts for. Parent and child sessions are independent. */
export type Audience = 'parent' | 'child';

/** Bearer token to attach (none by default). */
export const AUTH_AUDIENCE = new HttpContextToken<Audience | null>(() => null);

/**
 * When true, a 401 on this request means the session is no longer valid (expired/revoked token)
 * and the user is signed out. Only set for services that actually validate EduKids JWTs
 * (Comptes.Api, Espaces.Api).
 */
export const SESSION_BOUND = new HttpContextToken<boolean>(() => false);

/** Service that owns the request, used to build meaningful error messages. */
export const TARGET_SERVICE = new HttpContextToken<ServiceName | null>(() => null);

export interface RequestContextOptions {
  readonly service: ServiceName;
  readonly audience?: Audience | null;
  readonly sessionBound?: boolean;
}

export function requestContext(options: RequestContextOptions): HttpContext {
  return new HttpContext()
    .set(TARGET_SERVICE, options.service)
    .set(AUTH_AUDIENCE, options.audience ?? null)
    .set(SESSION_BOUND, options.sessionBound ?? false);
}
