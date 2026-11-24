import { inject, Provider } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';
import { ActivitesHttpGateway } from '../api/activites-http.gateway';
import { SuiviHttpGateway } from '../api/suivi-http.gateway';
import { DemoGamesGateway } from '../demo/demo-games.gateway';
import { DemoProgressGateway } from '../demo/demo-progress.gateway';
import { GamesGateway } from './games.gateway';
import { ProgressGateway } from './progress.gateway';

/** Selects each gateway adapter from environment.integrations. */
export function provideGateways(): Provider[] {
  return [
    {
      provide: GamesGateway,
      useFactory: () =>
        inject(APP_CONFIG).integrations.games === 'api' ? inject(ActivitesHttpGateway) : inject(DemoGamesGateway),
    },
    {
      provide: ProgressGateway,
      useFactory: () =>
        inject(APP_CONFIG).integrations.progress === 'api' ? inject(SuiviHttpGateway) : inject(DemoProgressGateway),
    },
  ];
}
