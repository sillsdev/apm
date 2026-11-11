// Shape of https://bible.helloao.org/api/available_translations.json

export interface HelloAoLicense {
  attribution: 'required' | 'not-required';
  commercialUse: 'allowed' | 'not-allowed';
  derivatives: 'allowed' | 'not-allowed';
  copyleft: boolean;
  publicDomain: boolean;
}

// Translation as embedded in books, chapter and complete responses,
// which sometimes leave out license
export interface HelloAoTranslationInfo {
  id: string;
  name: string;
  website: string;
  licenseUrl: string;
  license?: HelloAoLicense;
  shortName: string;
  englishName: string;
  language: string; // ISO 639-3 code
  textDirection: 'ltr' | 'rtl';
  sha256: string;
  availableFormats: string[]; // currently only 'json'
  listOfBooksApiLink: string; // relative, e.g. /api/BSB/books.json
  completeTranslationApiLink: string;
  simpleCompleteTranslationApiLink: string;
  numberOfBooks: number;
  totalNumberOfChapters: number;
  totalNumberOfVerses: number;
  numberOfApocryphalBooks?: number;
  totalNumberOfApocryphalChapters?: number;
  totalNumberOfApocryphalVerses?: number;
  languageName: string;
  languageEnglishName: string;
}

export interface HelloAoTranslation extends HelloAoTranslationInfo {
  license: HelloAoLicense;
  licenseNotice?: string;
}

export interface HelloAoBibles {
  translations: HelloAoTranslation[];
}
