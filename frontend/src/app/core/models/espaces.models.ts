// Contracts of Espaces.Api (src/Espaces.Api/Controllers). JSON is camelCase.

/** Activity categories accepted by Espaces.Api (EspacesController.TypesValides). */
export type EspacesActivite = 'Maths' | 'Association' | 'Dictee';

export const ESPACES_ACTIVITES: readonly EspacesActivite[] = ['Maths', 'Association', 'Dictee'];

export function isEspacesActivite(value: string): value is EspacesActivite {
  return (ESPACES_ACTIVITES as readonly string[]).includes(value);
}

/** POST /espaces body (CreerEspaceDto). At least one activity is required. */
export interface CreerEspaceRequest {
  readonly nomEnfant: string;
  readonly activites: readonly EspacesActivite[];
}

/** POST /espaces → 200. */
export interface EspaceCreeResponse {
  readonly id: string;
  readonly nomEnfant: string;
  readonly codeAcces: string;
  readonly activites: readonly string[];
}

/** GET /espaces → item. Activities are a comma separated string and the avatar is not included. */
export interface EspaceListItemResponse {
  readonly id: string;
  readonly nomEnfant: string;
  readonly codeAcces: string;
  readonly typesActivites: string;
}

/** GET /espaces/{id} → 200 (404 when the space belongs to another parent). */
export interface EspaceDetailResponse {
  readonly id: string;
  readonly nomEnfant: string;
  readonly codeAcces: string;
  readonly avatar: string;
  readonly personnagePrefere: string;
  readonly activites: readonly string[];
}

/** PUT /espaces/{id} body (ModifierEspaceDto) — every field is optional. */
export interface ModifierEspaceRequest {
  readonly nomEnfant?: string | null;
  readonly avatar?: string | null;
  readonly activites?: readonly EspacesActivite[] | null;
}

/** PUT /espaces/{id} → 200. */
export interface EspaceModifieResponse {
  readonly id: string;
  readonly nomEnfant: string;
  readonly avatar: string;
  readonly activites: readonly string[];
}

/** POST /acces/code body (CodeDto). */
export interface AccesCodeRequest {
  readonly code: string;
}

/** POST /acces/code → 200 { token, nomEnfant } (JWT 4 h, claims sub, role=Enfant, espaceId); 401 "Code invalide.". */
export interface AccesCodeResponse {
  readonly token: string;
  readonly nomEnfant: string;
}

/** GET /mon-espace (child token). The space id is only available in the JWT claim `espaceId`. */
export interface MonEspaceResponse {
  readonly nomEnfant: string;
  readonly avatar: string;
  readonly personnagePrefere: string;
  readonly activites: readonly string[];
}

/** PUT /mon-espace/personnage body (PersonnageDto) → { personnagePrefere }. */
export interface PersonnageRequest {
  readonly personnage: string;
}

export interface PersonnageResponse {
  readonly personnagePrefere: string;
}

/** Normalized child space used by the UI. */
export interface ChildSpace {
  readonly id: string;
  readonly nomEnfant: string;
  readonly codeAcces: string;
  /** Avatar key chosen by the parent ('' when never set). */
  readonly avatar: string;
  /** Favourite character chosen by the child ('' when never set). */
  readonly personnagePrefere: string;
  readonly activites: readonly EspacesActivite[];
}

/** Normalized space of the signed-in child. */
export interface ChildOwnSpace {
  readonly spaceId: string;
  readonly nomEnfant: string;
  readonly avatar: string;
  readonly personnagePrefere: string;
  readonly activites: readonly EspacesActivite[];
}

/** Access codes: 6 characters from ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (EspacesController.GenererCode). */
export const ACCESS_CODE_LENGTH = 6;
export const ACCESS_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function normalizeAccessCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, ACCESS_CODE_LENGTH);
}

/** Splits/filters the activity values returned by the API, ignoring unknown entries. */
export function parseActivites(values: readonly string[] | string | null | undefined): EspacesActivite[] {
  const list = typeof values === 'string' ? values.split(',') : (values ?? []);
  const result: EspacesActivite[] = [];
  for (const raw of list) {
    const value = raw.trim();
    if (isEspacesActivite(value) && !result.includes(value)) {
      result.push(value);
    }
  }
  return result;
}
