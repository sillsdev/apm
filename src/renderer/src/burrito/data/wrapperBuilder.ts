import {
  Alignment,
  BurritoEntry,
  BurritoWrapper,
  Contents,
  WrapperMeta,
} from 'burrito/data/types';

interface RequiredParams {
  name: string;
  description: string;
}

interface OptionalParams {
  version?: string;
  abbreviation?: string;
  dateCreated?: string;
  comments?: string;
  genName?: string;
  genVersion?: string;
  burritos?: BurritoEntry[];
  alignments?: Alignment[];
}

type WrapperParams = RequiredParams & OptionalParams;

/**
 * Creates a burrito wrapper object with the specified parameters
 * @param params - The parameters for the wrapper
 * @returns The burrito wrapper object
 */
export function wrapperBuilder({
  version,
  name,
  abbreviation,
  description,
  dateCreated = new Date().toISOString().split('T')[0],
  comments = '',
  genName,
  genVersion,
  burritos = [],
  alignments = [],
}: WrapperParams): BurritoWrapper {
  const meta = {
    version: version || '0.0.1',
    name: {
      en: name,
    },
    description: {
      en: description,
    },
    dateCreated: dateCreated || new Date().toISOString().split('T')[0],
  } as WrapperMeta;
  if (abbreviation) {
    meta.abbreviation = { en: abbreviation };
  }
  if (genName) {
    meta.generator = { name: genName };
    if (genVersion) {
      meta.generator.version = genVersion;
    }
  }
  if (comments) {
    meta.comments = comments;
  }

  const contents = {} as Contents;
  if (burritos.length > 0) {
    contents.burritos = burritos;
  }
  if (alignments.length > 0) {
    contents.alignments = alignments;
  }

  return {
    format: 'scripture burrito wrapper',
    meta,
    contents,
  };
}
