export enum ToolSlug {
  Resource = 'resource',
  Record = 'record',
  KeyTerm = 'keyterm',
  TeamCheck = 'teamCheck',
  Discuss = 'discuss',
  Verses = 'verses',
  Transcribe = 'transcribe',
  PhraseBackTranslate = 'phraseBackTranslate',
  WholeBackTranslate = 'wholeBackTranslate',
  ConsultantCheck = 'consultantCheck',
  Paratext = 'paratext',
  Community = 'community',
  Export = 'export',
  Done = 'done',
}

/** Steps whose main UI is still valid when there is no vernacular audio yet (recording, internalization/resources). */
export function toolAllowsEmptyVernacularAudio(tool: string): boolean {
  return tool === ToolSlug.Record || tool === ToolSlug.Resource;
}
