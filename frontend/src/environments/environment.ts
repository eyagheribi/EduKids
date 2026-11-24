import { AppConfig } from '../app/core/config/app-config';

/**
 * Central configuration of the EduKids microservice URLs.
 *
 * In development the URLs are relative: `ng serve` forwards each `/gateway/<service>` prefix to the
 * matching ASP.NET Core service (see proxy.conf.json). This also avoids CORS, which none of the
 * services enable. In production, expose the same prefixes through a reverse proxy / API gateway or
 * replace them with absolute URLs.
 *
 * Integration modes:
 * - `api`  — the gateway calls the real microservice.
 * - `demo` — a local, clearly labelled demonstration gateway is used because the service cannot yet
 *            authenticate EduKids users (see frontend/docs/RAPPORT-INTEGRATION.md).
 */
export const environment: AppConfig = {
  production: false,
  services: {
    comptes: '/gateway/comptes',
    espaces: '/gateway/espaces',
    activites: '/gateway/activites',
    suivi: '/gateway/suivi',
  },
  integrations: {
    // Activites.Api only accepts a Postman-only development header and denies everything in
    // production: it does not validate EduKids JWTs yet.
    games: 'demo',
    // Suivi.Api has the same limitation (development header restricted to one hard-coded space).
    progress: 'demo',
  },
  demo: {
    latencyMs: 280,
  },
};
