import { ITag } from '../model';

const sortedOpts = (tags: ITag) =>
  Object.keys(tags)
    .map((k) => k) // no empty keys
    .sort();

export const filteredOptions = (tags: ITag) =>
  sortedOpts(tags).filter((tag) => tags[tag]);
