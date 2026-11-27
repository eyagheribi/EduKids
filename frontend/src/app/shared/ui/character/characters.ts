export interface CharacterDef {
  /** Value stored in Espaces.Api (EspaceEnfant.PersonnagePrefere). */
  readonly key: string;
  readonly name: string;
  readonly tagline: string;
  readonly bg: string;
}

export const CHARACTERS: readonly CharacterDef[] = [
  { key: 'hibou', name: 'Edu le hibou', tagline: 'Toujours curieux', bg: '#efe7fe' },
  { key: 'renard', name: 'Roxy la renarde', tagline: 'Rusée et rapide', bg: '#ffe5cc' },
  { key: 'panda', name: 'Pako le panda', tagline: 'Calme et patient', bg: '#e6f7e9' },
  { key: 'dino', name: 'Dino le dinosaure', tagline: 'Fort et courageux', bg: '#dcf4e1' },
  { key: 'lapin', name: 'Lili la lapine', tagline: 'Pleine d’énergie', bg: '#fde7f1' },
  { key: 'robot', name: 'Bip le robot', tagline: 'Adore les calculs', bg: '#d8eaff' },
];

export function findCharacter(key: string | null | undefined): CharacterDef | undefined {
  return CHARACTERS.find((c) => c.key === key);
}
