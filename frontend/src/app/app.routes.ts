import { Routes } from '@angular/router';
import { childGuard, childGuestGuard, parentGuard, parentGuestGuard } from './core/auth/guards';

/**
 * Route map (French URLs). Every page is lazy-loaded.
 *
 *  /                                   accueil (Je suis un parent / un enfant)
 *  /aide                               aide
 *  /parent/connexion | /parent/inscription
 *  /enfant/connexion                   code d'accès à 6 caractères
 *  /parent/…                           espace parent (parentGuard)
 *  /enfant/…                           espace enfant (childGuard)
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'EduKids — Bienvenue',
    loadComponent: () => import('./features/public/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'aide',
    title: 'Aide — EduKids',
    loadComponent: () => import('./features/public/help/help.page').then((m) => m.HelpPage),
  },
  {
    path: 'parent/connexion',
    title: 'Connexion parent — EduKids',
    canActivate: [parentGuestGuard],
    loadComponent: () => import('./features/auth/parent-login/parent-login.page').then((m) => m.ParentLoginPage),
  },
  {
    path: 'parent/inscription',
    title: 'Inscription parent — EduKids',
    canActivate: [parentGuestGuard],
    loadComponent: () =>
      import('./features/auth/parent-register/parent-register.page').then((m) => m.ParentRegisterPage),
  },
  {
    path: 'enfant/connexion',
    title: 'Entre ton code — EduKids',
    canActivate: [childGuestGuard],
    loadComponent: () => import('./features/auth/child-login/child-login.page').then((m) => m.ChildLoginPage),
  },
  {
    path: 'parent',
    canActivate: [parentGuard],
    loadComponent: () =>
      import('./features/parent/layout/parent-shell.component').then((m) => m.ParentShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'accueil' },
      {
        path: 'accueil',
        title: 'Tableau de bord — EduKids',
        loadComponent: () => import('./features/parent/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        // ?creer=1 opens the creation form directly.
        path: 'enfants',
        title: 'Mes espaces enfants — EduKids',
        loadComponent: () => import('./features/parent/spaces/spaces.page').then((m) => m.SpacesPage),
      },
      {
        path: 'enfants/:spaceId/cree',
        title: 'Espace créé — EduKids',
        loadComponent: () =>
          import('./features/parent/spaces/space-created.page').then((m) => m.SpaceCreatedPage),
      },
      {
        path: 'enfants/:spaceId',
        loadComponent: () =>
          import('./features/parent/space/space-shell.component').then((m) => m.SpaceShellComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'jeux' },
          {
            path: 'jeux',
            title: 'Gestion des jeux — EduKids',
            loadComponent: () =>
              import('./features/parent/space/games/games-tab.page').then((m) => m.GamesTabPage),
          },
          {
            path: 'jeux/:categoryId',
            title: 'Jeux de la catégorie — EduKids',
            loadComponent: () =>
              import('./features/parent/space/games/category-games.page').then((m) => m.CategoryGamesPage),
          },
          {
            path: 'jeux/:categoryId/nouveau',
            title: 'Nouveau jeu — EduKids',
            loadComponent: () =>
              import('./features/parent/space/games/game-editor.page').then((m) => m.GameEditorPage),
          },
          {
            path: 'jeux/:categoryId/:gameId/modifier',
            title: 'Modifier le jeu — EduKids',
            loadComponent: () =>
              import('./features/parent/space/games/game-editor.page').then((m) => m.GameEditorPage),
          },
          {
            path: 'progres',
            title: 'Résultats et progrès — EduKids',
            loadComponent: () =>
              import('./features/parent/space/progress/progress-tab.page').then((m) => m.ProgressTabPage),
          },
          {
            path: 'progres/sessions/:sessionId',
            title: 'Détail de la session — EduKids',
            loadComponent: () =>
              import('./features/parent/space/progress/session-detail.page').then((m) => m.SessionDetailPage),
          },
        ],
      },
      {
        path: 'jeux',
        title: 'Jeux éducatifs — EduKids',
        loadComponent: () =>
          import('./features/parent/games-overview/games-overview.page').then((m) => m.GamesOverviewPage),
      },
      {
        path: 'progres',
        title: 'Suivi des progrès — EduKids',
        loadComponent: () =>
          import('./features/parent/progress-overview/progress-overview.page').then((m) => m.ProgressOverviewPage),
      },
      {
        path: 'parametres',
        title: 'Paramètres — EduKids',
        loadComponent: () => import('./features/parent/settings/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
  {
    path: 'enfant',
    canActivate: [childGuard],
    loadComponent: () => import('./features/child/layout/child-shell.component').then((m) => m.ChildShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Mon espace — EduKids',
        loadComponent: () => import('./features/child/home/child-home.page').then((m) => m.ChildHomePage),
      },
      {
        path: 'personnage',
        title: 'Mon personnage — EduKids',
        loadComponent: () =>
          import('./features/child/character/character-picker.page').then((m) => m.CharacterPickerPage),
      },
      {
        path: 'categories/:categoryId',
        title: 'Mes jeux — EduKids',
        loadComponent: () =>
          import('./features/child/category/child-category.page').then((m) => m.ChildCategoryPage),
      },
      {
        path: 'jouer/:gameId',
        title: 'Je joue ! — EduKids',
        loadComponent: () => import('./features/child/play/game-player.page').then((m) => m.GamePlayerPage),
      },
      {
        path: 'dictee',
        pathMatch: 'full',
        redirectTo: 'categories/dictee',
      },
    ],
  },
  {
    path: '**',
    title: 'Page introuvable — EduKids',
    loadComponent: () => import('./features/public/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
