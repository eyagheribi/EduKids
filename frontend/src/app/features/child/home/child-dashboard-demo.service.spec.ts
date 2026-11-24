import { TestBed } from '@angular/core/testing';
import { APP_CONFIG, AppConfig } from '../../../core/config/app-config';
import { DemoStore } from '../../../core/demo/demo-store';
import { ChildDashboardDemoService } from './child-dashboard-demo.service';

const config: AppConfig = {
  production: false,
  services: { comptes: '', espaces: '', activites: '', suivi: '' },
  integrations: { games: 'demo', progress: 'demo' },
  demo: { latencyMs: 0 },
};

describe('ChildDashboardDemoService', () => {
  let service: ChildDashboardDemoService;
  let store: DemoStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: APP_CONFIG, useValue: config }] });
    service = TestBed.inject(ChildDashboardDemoService);
    store = TestBed.inject(DemoStore);
  });

  it('only returns a resumable session for its own space', () => {
    store.write((state) => {
      state.games.push({
        id: 'game-1',
        spaceId: 'space-1',
        type: 'MATH',
        title: 'Calcul amusant',
        content: { expression: '2 + 2' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      state.sessions.push({
        id: 'session-1',
        spaceId: 'space-1',
        gameId: 'game-1',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        completedAt: null,
        nextAvailableAt: null,
        inactivityDeadlineAt: null,
        gameTitleSnapshot: 'Calcul amusant',
        gameTypeSnapshot: 'MATH',
        contentSnapshot: '{}',
        play: {},
        attempts: [],
        idempotency: {},
      });
    });

    expect(service.resumableGameFor('space-1')).toMatchObject({
      gameId: 'game-1',
      title: 'Calcul amusant',
      type: 'MATH',
    });
    expect(service.resumableGameFor('space-2')).toBeNull();
  });

  it('does not offer an active session after its inactivity deadline', () => {
    store.write((state) => {
      state.games.push({
        id: 'game-1',
        spaceId: 'space-1',
        type: 'MATH',
        title: 'Calcul amusant',
        content: { expression: '2 + 2' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      state.sessions.push({
        id: 'session-1',
        spaceId: 'space-1',
        gameId: 'game-1',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        completedAt: null,
        nextAvailableAt: null,
        inactivityDeadlineAt: new Date(Date.now() - 1_000).toISOString(),
        gameTitleSnapshot: 'Calcul amusant',
        gameTypeSnapshot: 'MATH',
        contentSnapshot: '{}',
        play: {},
        attempts: [],
        idempotency: {},
      });
    });

    expect(service.resumableGameFor('space-1')).toBeNull();
  });
});
