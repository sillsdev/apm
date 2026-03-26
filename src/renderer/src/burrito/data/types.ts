export interface LocalizedString {
  [lang: string]: string;
}

export interface BurritoEntry {
  id: string;
  path: string;
  role: string;
}

export interface Alignment {
  source: string;
  target: string;
  path: string;
  description: LocalizedString;
}

export interface WrapperMeta {
  version: string;
  name: LocalizedString;
  abbreviation?: LocalizedString;
  description: LocalizedString;
  generator?: {
    name: string;
    version?: string;
  };
  dateCreated?: string;
  comments?: string;
}

export interface Contents {
  burritos: BurritoEntry[];
  alignments?: Alignment[];
}

export interface BurritoWrapper {
  format: string;
  meta: WrapperMeta;
  contents: Contents;
}

export interface BurritoMeta {
  version: string;
  category: string;
  generator: {
    softwareName: string;
    softwareVersion: string;
    userName: string;
  };
  defaultLocale: string;
  dateCreated: string;
  comments: string[];
}

export interface BurritoIdentification {
  primary?: {
    [key: string]: {
      [key: string]: {
        revision: string;
        timestamp: string;
      };
    };
  };
  name?: {
    [key: string]: string;
  };
  description?: {
    [key: string]: string;
  };
  abbreviation?: {
    [key: string]: string;
  };
}

export interface BurritoLanguage {
  tag: string;
  name: {
    [key: string]: string;
  };
}

// interface BurritoFormat {
//   compression: string;
//   trackConfiguration?: string;
//   bitRate?: number;
//   bitDepth?: number;
//   samplingRate?: number;
// }

// export interface BurritoFormats {
//   [key: string]: BurritoFormat;
// }

export interface BurritoFlavor {
  name: string;
  // performance: string[];
  // formats: BurritoFormats;
}

export interface BurritoScopes {
  [book: string]: string[];
}

export interface BurritoType {
  flavorType: {
    name: string;
    flavor: BurritoFlavor;
    currentScope: BurritoScopes;
  };
}

export interface BurritoAgency {
  id: string;
  roles: string[];
  url?: string;
  name: {
    [key: string]: string;
  };
  abbr?: {
    [key: string]: string;
  };
}

export interface BurritoTargetArea {
  code: string;
  name: {
    [key: string]: string;
  };
}

export interface BurritoLocalizedName {
  abbr: {
    [key: string]: string;
  };
  short: {
    [key: string]: string;
  };
  long: {
    [key: string]: string;
  };
}

export interface BurritoLocalizedNames {
  [key: string]: BurritoLocalizedName;
}

export interface BurritoIngredient {
  checksum: {
    md5: string;
  };
  mimeType: string;
  size?: number;
  scope?: {
    [key: string]: string[];
  };
  role?: string;
  properties?: {
    [key: string]: string;
  };
}

export interface BurritoIngredients {
  [key: string]: BurritoIngredient;
}

export interface BurritoCopyright {
  shortStatements: {
    statement: string;
    mimetype: string;
    lang: string;
  }[];
}

export interface Burrito {
  format: string;
  meta: BurritoMeta;
  idAuthorities?: {
    [key: string]: {
      id: string;
      name: { [key: string]: string };
    };
  };
  identification?: BurritoIdentification;
  languages?: BurritoLanguage[];
  type?: BurritoType;
  confidential?: boolean;
  agencies?: BurritoAgency[];
  targetAreas?: BurritoTargetArea[];
  localizedNames?: BurritoLocalizedNames;
  ingredients: BurritoIngredients;
  copyright?: BurritoCopyright;
}
