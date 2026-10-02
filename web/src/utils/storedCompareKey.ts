import { PassageD, SectionD } from '../model';
import { LocalKey, localUserKey } from './localUserKey';

export const storedCompareKey = (
  passage: PassageD,
  section: SectionD
): {
  removeStoredKeys: () => void;
  saveKey: (id: string) => void;
  removeKey: (value?: string) => void;
  storeKey: (keyType?: string) => string;
  SecSlug: string;
} => {
  const storeKey = (keyType?: string): string =>
    `${localUserKey(LocalKey.compare)}_${
      keyType ?? passage?.attributes?.sequencenum ?? 0
    }`;

  const SecSlug = 'secId';

  const removeKey = (value?: string): void => {
    let n = 1;
    while (n < 999) {
      const res = localStorage.getItem(storeKey(n.toString()));
      if (!res) break;
      if (!value || res === value) {
        localStorage.removeItem(storeKey(n.toString()));
      }
      n += 1;
    }
  };

  const removeStoredKeys = (): void => {
    const secId = localStorage.getItem(storeKey(SecSlug));
    if (secId !== section.id) {
      localStorage.setItem(storeKey(SecSlug), section.id);
      removeKey();
    }
  };

  const saveKey = (id: string): void => {
    localStorage.setItem(storeKey(), id);
  };

  return { removeStoredKeys, saveKey, removeKey, storeKey, SecSlug };
};
