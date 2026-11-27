import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LOGIN_ROUTES } from './auth.interceptor';
import { SessionService } from './session.service';

/** Protects the parent area. Redirects to the parent login, remembering the target URL. */
export const parentGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (session.ensureValid('parent')) return true;
  return router.createUrlTree([LOGIN_ROUTES.parent], { queryParams: { retour: state.url } });
};

/** Protects the child area. */
export const childGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (session.ensureValid('child')) return true;
  return router.createUrlTree([LOGIN_ROUTES.child]);
};

/** Parent login/register pages: an already signed-in parent goes straight to the dashboard. */
export const parentGuestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.ensureValid('parent') ? router.createUrlTree(['/parent/accueil']) : true;
};

/** Child code page: an already signed-in child goes straight to the child home. */
export const childGuestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.ensureValid('child') ? router.createUrlTree(['/enfant']) : true;
};
