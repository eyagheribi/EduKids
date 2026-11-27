import { hashString } from '../../utils/ids';

export type HairStyle = 'curly' | 'short' | 'bob' | 'pigtails' | 'bun' | 'spiky';
export type Accessory = 'none' | 'bow' | 'glasses' | 'cap' | 'headband';

export interface AvatarDef {
  /** Value stored in Espaces.Api (EspaceEnfant.Avatar). */
  readonly key: string;
  readonly label: string;
  readonly bg: string;
  readonly skin: string;
  readonly hair: string;
  readonly hairStyle: HairStyle;
  readonly accessory: Accessory;
  readonly accent: string;
  readonly shirt: string;
}

export const AVATARS: readonly AvatarDef[] = [
  { key: 'enfant-boucles', label: 'Bouclettes', bg: '#dcf4e1', skin: '#fbd2b4', hair: '#4b2a4f', hairStyle: 'curly', accessory: 'none', accent: '#7444d6', shirt: '#7fb8f0' },
  { key: 'enfant-noeud', label: 'Petit nœud', bg: '#ece3fd', skin: '#f8cdb0', hair: '#3a1d47', hairStyle: 'bob', accessory: 'bow', accent: '#8b5ce6', shirt: '#f59ac1' },
  { key: 'enfant-lunettes', label: 'Lunettes', bg: '#fff0c6', skin: '#f6c7a3', hair: '#3b2433', hairStyle: 'short', accessory: 'glasses', accent: '#2a0f55', shirt: '#f08a24' },
  { key: 'enfant-couettes', label: 'Couettes', bg: '#d8eaff', skin: '#fbd6bd', hair: '#c4622d', hairStyle: 'pigtails', accessory: 'none', accent: '#ffc93c', shirt: '#55c06a' },
  { key: 'enfant-chignon', label: 'Chignon', bg: '#ffe5cc', skin: '#c98a63', hair: '#2e1a1a', hairStyle: 'bun', accessory: 'none', accent: '#e5484d', shirt: '#a47def' },
  { key: 'enfant-epis', label: 'Épis', bg: '#e6f7e9', skin: '#f9d3b6', hair: '#e2a93b', hairStyle: 'spiky', accessory: 'none', accent: '#2f82ea', shirt: '#2f82ea' },
  { key: 'enfant-casquette', label: 'Casquette', bg: '#efe7fe', skin: '#dba27c', hair: '#3b2433', hairStyle: 'short', accessory: 'cap', accent: '#2f82ea', shirt: '#ffc93c' },
  { key: 'enfant-bandeau', label: 'Bandeau', bg: '#dcf4e1', skin: '#8d5a3b', hair: '#1f1418', hairStyle: 'bob', accessory: 'headband', accent: '#ffc93c', shirt: '#e5484d' },
];

export function findAvatar(key: string | null | undefined): AvatarDef | undefined {
  return AVATARS.find((a) => a.key === key);
}

/** Avatar to display: the chosen one, else a stable default derived from a seed (space id). */
export function resolveAvatar(key: string | null | undefined, seed: string): AvatarDef {
  return findAvatar(key) ?? (AVATARS[hashString(seed || 'edukids') % AVATARS.length] as AvatarDef);
}
