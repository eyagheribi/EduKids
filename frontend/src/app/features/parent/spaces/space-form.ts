// Shared rules of the child space forms (creation page, edit dialog, « Ajouter une catégorie »).
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ACTIVATABLE_CATEGORIES, CategoryDef, CategoryId, CategoryTone } from '../../../core/models/categories';
import { EspacesActivite } from '../../../core/models/espaces.models';

/** Maximum length of a child name (UI rule; Espaces.Api only requires a non-blank value). */
export const CHILD_NAME_MAX_LENGTH = 40;

/** Short taglines displayed on the category tiles. */
export const CATEGORY_TAGLINES: Readonly<Record<CategoryId, string>> = {
  maths: 'Des calculs à résoudre',
  association: 'Des paires à relier',
  ordonnancement: 'Des phrases à remettre en ordre',
  dictee: 'Écouter et écrire',
};

/** `.ek-chip` modifier matching a category tone. */
export function chipToneClass(tone: CategoryTone): string {
  switch (tone) {
    case 'green':
      return 'ek-chip--green';
    case 'blue':
      return 'ek-chip--blue';
    case 'yellow':
      return 'ek-chip--yellow';
    default:
      return '';
  }
}

/** Activated categories of a space, in catalogue order. */
export function activatedCategories(activites: readonly EspacesActivite[]): CategoryDef[] {
  return ACTIVATABLE_CATEGORIES.filter((c) => c.espacesKey !== null && activites.includes(c.espacesKey));
}

/** Deduplicates and orders activities like the catalogue (Maths, Association, Dictee). */
export function sortActivites(activites: readonly EspacesActivite[]): EspacesActivite[] {
  const result: EspacesActivite[] = [];
  for (const category of ACTIVATABLE_CATEGORIES) {
    const key = category.espacesKey;
    if (key && activites.includes(key) && !result.includes(key)) result.push(key);
  }
  return result;
}

/** Current activities ∪ newly selected ones (used by « Ajouter une catégorie »). */
export function unionActivites(
  current: readonly EspacesActivite[],
  added: readonly EspacesActivite[],
): EspacesActivite[] {
  return sortActivites([...current, ...added]);
}

/** Adds or removes one activity. */
export function toggleActivite(list: readonly EspacesActivite[], key: EspacesActivite): EspacesActivite[] {
  return list.includes(key) ? list.filter((k) => k !== key) : sortActivites([...list, key]);
}

/** Activities present in `before` but missing from `after`. */
export function removedActivites(
  before: readonly EspacesActivite[],
  after: readonly EspacesActivite[],
): EspacesActivite[] {
  return before.filter((k) => !after.includes(k));
}

/** Child name: required once trimmed, at most CHILD_NAME_MAX_LENGTH characters. */
export const childNameValidator: ValidatorFn = (control: AbstractControl<string>): ValidationErrors | null => {
  const value = (control.value ?? '').trim();
  if (!value) return { required: true };
  if (value.length > CHILD_NAME_MAX_LENGTH) {
    return { maxlength: { requiredLength: CHILD_NAME_MAX_LENGTH, actualLength: value.length } };
  }
  return null;
};

/** At least one activity must be selected. */
export const atLeastOneActivite: ValidatorFn = (
  control: AbstractControl<readonly EspacesActivite[]>,
): ValidationErrors | null => ((control.value ?? []).length ? null : { required: true });

export function childNameError(control: AbstractControl): string | null {
  if (control.hasError('required')) return 'Indiquez le prénom ou le nom de l’enfant.';
  if (control.hasError('maxlength')) return `Le nom ne peut pas dépasser ${CHILD_NAME_MAX_LENGTH} caractères.`;
  return null;
}

export const ACTIVITES_REQUIRED_MESSAGE = 'Choisissez au moins une catégorie de jeux.';
