import {
  FETCH_BOOKS,
  BookName,
  IBookNameData,
  BookNameMap,
  BookNameMsgs,
} from './types';
import { SET_LANGUAGE, LocalizationMsgs } from '../localization/types';
import { bookCleanState } from './bookCleanState';

const makeMap = (books: BookName[]) => {
  const result: BookNameMap = {};
  books
    .filter((b: BookName) => b.short !== '')
    .forEach((b) => {
      result[b.code] = b.short;
    });
  return result;
};

const BookReducers = function (
  state = bookCleanState,
  action: BookNameMsgs | LocalizationMsgs
): IBookNameData {
  switch (action?.type) {
    case FETCH_BOOKS:
      return {
        ...state,
        loaded: true,
        suggestions: action.payload.data
          .filter((b: BookName) => b.short !== '')
          .map((b: BookName) => {
            return { value: b.code, label: b.short };
          }),
        map: makeMap(action.payload.data),
        bookData: action.payload.data,
      };
    case SET_LANGUAGE:
      return {
        ...state,
        loaded: false,
      };
    default:
      return state;
  }
};

export default BookReducers;
