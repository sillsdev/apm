import { BookName } from './types';
import { OptionType } from '../../model';

export const bookCleanState = {
  loaded: false,
  suggestions: Array<OptionType>(),
  bookData: Array<BookName>(),
  map: {},
};
