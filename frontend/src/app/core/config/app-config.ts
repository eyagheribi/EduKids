import { InjectionToken, Provider } from '@angular/core';

export type IntegrationMode = 'api' | 'demo';

export type ServiceName = 'comptes' | 'espaces' | 'activites' | 'suivi';

export interface AppConfig {
  readonly production: boolean;
  /** Base URL of each microservice (no trailing slash). */
  readonly services: Readonly<Record<ServiceName, string>>;
  readonly integrations: {
    /** Games, sessions and attempts (Activites.Api). */
    readonly games: IntegrationMode;
    /** Parent progress dashboard (Suivi.Api). */
    readonly progress: IntegrationMode;
  };
  readonly demo: {
    /** Artificial latency of demo gateways, so loading states stay visible. */
    readonly latencyMs: number;
  };
}

export const APP_CONFIG = new InjectionToken<AppConfig>('EDUKIDS_APP_CONFIG');

export function provideAppConfig(config: AppConfig): Provider {
  return { provide: APP_CONFIG, useValue: config };
}

/** Human readable names used in error messages and the integration status page. */
export const SERVICE_LABELS: Readonly<Record<ServiceName, string>> = {
  comptes: 'Comptes.Api',
  espaces: 'Espaces.Api',
  activites: 'Activites.Api',
  suivi: 'Suivi.Api',
};
