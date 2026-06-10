export interface AsrLangEntry {
  language_iso: string;
  script: string;
  method: string;
}

export interface AsrLangData {
  entries: AsrLangEntry[];
}
