import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { toApiError } from '../api/api-error';
import { ApiError } from '../api/api-error';
import { AUTH_AUDIENCE, SESSION_BOUND, TARGET_SERVICE } from './auth-context';
import { SessionService } from './session.service';

export const LOGIN_ROUTES = {
  parent: '/parent/connexion',
  child: '/enfant/connexion',
} as const;

/**
 * Attaches the bearer token of the requested audience, ends the session when a session-bound
 * service answers 401, and converts every HTTP error into an ApiError (French message).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const audience = req.context.get(AUTH_AUDIENCE);
  const service = req.context.get(TARGET_SERVICE);
  const sessionBound = req.context.get(SESSION_BOUND);

  let request = req;
  if (audience) {
    const token = session.tokenFor(audience);
    if (!token) {
      void router.navigateByUrl(`${LOGIN_ROUTES[audience]}?session=expiree`);
      return throwError(() => new ApiError('Votre session a expiré. Veuillez vous reconnecter.', 401, service));
    }
    request = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (audience && sessionBound && error instanceof HttpErrorResponse && error.status === 401) {
        session.end(audience, 'expired');
        void router.navigateByUrl(`${LOGIN_ROUTES[audience]}?session=expiree`);
        return throwError(
          () => new ApiError('Votre session a expiré. Veuillez vous reconnecter.', 401, service),
        );
      }
      return throwError(() => toApiError(error, service));
    }),
  );
};
