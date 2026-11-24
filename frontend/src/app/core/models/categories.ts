// Game categories shown in the UI and how they map onto the two backends.
//
//  UI category      | Espaces.Api activity | Activites.Api engine | Status
//  -----------------+----------------------+----------------------+-------------------------------
//  maths            | Maths                | MATH                 | complete
//  association      | Association          | MATCHING             | complete
//  ordonnancement   | — (not accepted)     | SENTENCE_ORDERING    | engine only: cannot be activated
//  dictee           | Dictee               | — (no engine)        | activation only: static demo
import { IntegrationMode } from '../config/app-config';
import { GameType } from './activites.models';
import { EspacesActivite } from './espaces.models';

export type CategoryId = 'maths' | 'association' | 'ordonnancement' | 'dictee';

export type CategoryTone = 'green' | 'purple' | 'blue' | 'yellow';

export interface CategoryDef {
  readonly id: CategoryId;
  /** Parent-facing name. */
  readonly label: string;
  /** Child-facing short name. */
  readonly childLabel: string;
  readonly description: string;
  readonly childDescription: string;
  /** Value stored by Espaces.Api, null when Espaces.Api cannot activate it. */
  readonly espacesKey: EspacesActivite | null;
  /** Engine in Activites.Api, null when no engine exists. */
  readonly gameType: GameType | null;
  readonly tone: CategoryTone;
}

export const CATEGORIES: readonly CategoryDef[] = [
  {
    id: 'maths',
    label: 'Mathématiques',
    childLabel: 'Calcul',
    description: 'Des expressions à calculer : additions, soustractions, multiplications, divisions et parenthèses.',
    childDescription: 'Calcule le résultat !',
    espacesKey: 'Maths',
    gameType: 'MATH',
    tone: 'green',
  },
  {
    id: 'association',
    label: 'Association',
    childLabel: 'Associe',
    description: 'Des paires à relier : un mot et sa traduction, une image et son nom, une question et sa réponse…',
    childDescription: 'Relie chaque élément à son partenaire !',
    espacesKey: 'Association',
    gameType: 'MATCHING',
    tone: 'purple',
  },
  {
    id: 'ordonnancement',
    label: 'Ordonnancement de mots',
    childLabel: 'Phrases',
    description: 'Une phrase mélangée que l’enfant remet dans le bon ordre, mot par mot.',
    childDescription: 'Remets les mots dans le bon ordre !',
    espacesKey: 'Ordonnancement',
    gameType: 'SENTENCE_ORDERING',
    tone: 'blue',
  },
  {
    id: 'dictee',
    label: 'Dictée',
    childLabel: 'Dictée',
    description: 'Écouter une phrase et l’écrire.',
    childDescription: 'Écoute et écris !',
    espacesKey: 'Dictee',
    gameType: 'DICTATION',
    tone: 'yellow',
  },
];

export function getCategory(id: string | null | undefined): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function categoryForGameType(type: GameType | string | null | undefined): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.gameType === type);
}

export function categoryForEspacesKey(key: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.espacesKey === key);
}

/** Categories the parent can activate through Espaces.Api. */
export const ACTIVATABLE_CATEGORIES: readonly CategoryDef[] = CATEGORIES.filter((c) => c.espacesKey !== null);

/** How a category is available for a given space. */
export type CategoryAvailability =
  /** Activated in Espaces.Api and backed by an engine. */
  | 'active'
  /** Activated in Espaces.Api but no engine exists (Dictée): static demonstration only. */
  | 'no-engine'
  /** Engine exists but Espaces.Api cannot activate it: shown only while games run in demo mode. */
  | 'demo-only';

export interface SpaceCategory {
  readonly category: CategoryDef;
  readonly availability: CategoryAvailability;
}

/**
 * Categories to display for a space, in catalogue order.
 * SENTENCE_ORDERING cannot be activated in Espaces.Api; it is only listed while the games gateway
 * runs in demo mode, and is always flagged as such.
 */
export function categoriesForSpace(
  activites: readonly EspacesActivite[],
  gamesMode: IntegrationMode,
): SpaceCategory[] {
  const result: SpaceCategory[] = [];
  for (const category of CATEGORIES) {
    if (category.espacesKey === null) {
      if (gamesMode === 'demo' && category.gameType) {
        result.push({ category, availability: 'demo-only' });
      }
      continue;
    }
    if (!activites.includes(category.espacesKey)) continue;
    result.push({ category, availability: category.gameType ? 'active' : 'no-engine' });
  }
  return result;
}

/** Activatable categories that are not yet enabled for a space. */
export function inactiveCategories(activites: readonly EspacesActivite[]): CategoryDef[] {
  return ACTIVATABLE_CATEGORIES.filter((c) => c.espacesKey && !activites.includes(c.espacesKey));
}

export const GAME_TYPE_LABELS: Readonly<Record<GameType, string>> = {
  MATH: 'Mathématiques',
  MATCHING: 'Association',
  SENTENCE_ORDERING: 'Ordonnancement de mots',
  DICTATION: 'Dictée',
};
