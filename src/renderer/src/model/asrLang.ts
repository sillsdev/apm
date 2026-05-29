export interface AsrLang {
  iso: string;
  name: string;
}

export interface AsrLangEntry {
  language_iso: string;
  script: string;
  method: string;
}

export interface AsrLangData {
  languages: AsrLang[];
  entries: AsrLangEntry[];
}
