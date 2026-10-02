import { IState } from '../model/state';

interface IStringsSelectorProps {
  layout: string;
}

/*
 * Return a fresh, prototype-preserving snapshot whenever the
 * (source, language) pair changes, so the reference changes exactly when the
 * displayed strings change. We cache one snapshot per layout so the reference
 * stays stable between renders for the same language -- important because some
 * consumers call useSelector without shallowEqual and would otherwise re-render
 * on every dispatch.
 */
interface ICacheEntry {
  source: any;
  lang: string;
  value: any;
}
const snapshotCache = new Map<string, ICacheEntry>();

export const localStrings = (state: IState, props: IStringsSelectorProps) => {
  const source = state.strings[props.layout];
  const lang = state.strings.lang || 'en';

  const cached = snapshotCache.get(props.layout);
  if (cached && cached.source === source && cached.lang === lang) {
    return cached.value;
  }

  // Keep the shared instance in sync with the current language for any code
  // that reads it directly, then snapshot it into a new object that keeps the
  // LocalizedStrings prototype (so getString/formatString still work) but has a
  // new identity so consumers re-render when the language changes.
  source.setLanguage(lang);
  const value = Object.create(
    Object.getPrototypeOf(source),
    Object.getOwnPropertyDescriptors(source)
  );
  // Enumerable lang so useSelector(..., shallowEqual) sees a change even when
  // LocalizedStrings getters on the old snapshot already return the new language
  // (setLanguage mutates the shared source that accessors close over).
  Object.defineProperty(value, 'lang', {
    value: lang,
    enumerable: true,
    configurable: true,
  });

  snapshotCache.set(props.layout, { source, lang, value });
  return value;
};

export default localStrings;
