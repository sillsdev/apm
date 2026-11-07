export enum ToolSlug {
  Resource = 'resource',
  Prompt = 'prompt',
  Record = 'record',
  KeyTerm = 'keyterm',
  TeamCheck = 'teamCheck',
  Discuss = 'discuss',
  Verses = 'verses',
  Transcribe = 'transcribe',
  PhraseBackTranslate = 'phraseBackTranslate',
  CarefulSpeech = 'carefulSpeech',
  WholeBackTranslate = 'wholeBackTranslate',
  ConsultantCheck = 'consultantCheck',
  Paratext = 'paratext',
  Community = 'community',
  Export = 'export',
  Done = 'done',
}

/** Capabilities that vary by workflow tool. One place to extend when adding a tool. */
type ToolSupport = {
  /** Main UI is valid with no vernacular audio yet. */
  emptyVernacularAudio?: true;
  /** Workflow step editor shows a settings dialog. */
  hasSettingsDialog?: true;
  /** Settings dialog is the shared markdown instructions editor. */
  markdownSettings?: true;
  /** Desktop: passage chooser on the page background (no Paper). */
  chooserNoPaper?: true;
  /** Renders PassageDetailDiscuss (step markdown instructions). */
  stepInstructions?: true;
  /** Desktop: content in the shared Paper with the discussion panel. */
  paper?: true;
  /** Paper content must clip to the pane (player/editor sized steps). */
  clipPaperContent?: true;
};

const toolSupport: Record<ToolSlug, ToolSupport> = {
  [ToolSlug.Resource]: {
    emptyVernacularAudio: true,
    chooserNoPaper: true,
  },
  [ToolSlug.Prompt]: { emptyVernacularAudio: true },
  [ToolSlug.Record]: {
    emptyVernacularAudio: true,
    hasSettingsDialog: true,
    paper: true,
    clipPaperContent: true,
  },
  [ToolSlug.KeyTerm]: { paper: true },
  [ToolSlug.TeamCheck]: { paper: true },
  [ToolSlug.Discuss]: {
    hasSettingsDialog: true,
    markdownSettings: true,
    stepInstructions: true,
    paper: true,
  },
  [ToolSlug.Verses]: { paper: true, clipPaperContent: true },
  [ToolSlug.Transcribe]: {
    hasSettingsDialog: true,
    paper: true,
    clipPaperContent: true,
  },
  [ToolSlug.PhraseBackTranslate]: {
    hasSettingsDialog: true,
    paper: true,
    clipPaperContent: true,
  },
  [ToolSlug.CarefulSpeech]: { paper: true, clipPaperContent: true },
  [ToolSlug.WholeBackTranslate]: {},
  [ToolSlug.ConsultantCheck]: { paper: true, clipPaperContent: true },
  [ToolSlug.Paratext]: {
    hasSettingsDialog: true,
    chooserNoPaper: true,
  },
  [ToolSlug.Community]: {},
  [ToolSlug.Export]: { chooserNoPaper: true },
  [ToolSlug.Done]: {
    emptyVernacularAudio: true,
    hasSettingsDialog: true,
    markdownSettings: true,
    chooserNoPaper: true,
    stepInstructions: true,
  },
};

function support(tool: string | undefined | null): ToolSupport {
  if (!tool || !(tool in toolSupport)) return {};
  return toolSupport[tool as ToolSlug];
}

export function toolAllowsEmptyVernacularAudio(tool: string): boolean {
  return Boolean(support(tool).emptyVernacularAudio);
}

export function toolHasSettingsDialog(tool: string): boolean {
  return Boolean(support(tool).hasSettingsDialog);
}

export function toolHasMarkdownSettings(tool: string): boolean {
  return Boolean(support(tool).markdownSettings);
}

export function toolShowsChooserNoPaper(tool: string | undefined): boolean {
  return Boolean(support(tool).chooserNoPaper);
}

export function toolShowsStepInstructions(tool: string | undefined): boolean {
  return Boolean(support(tool).stepInstructions);
}

export function toolShowsStepPaper(tool: string | undefined): boolean {
  return Boolean(support(tool).paper);
}

export function toolClipsPaperContent(tool: string | undefined): boolean {
  return Boolean(support(tool).clipPaperContent);
}
