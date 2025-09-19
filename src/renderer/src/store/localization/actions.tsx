import Axios from 'axios';
import { FETCH_LOCALIZATION, LocalizationMsgs, SET_LANGUAGE } from './types';
import { appPath } from '../../utils';
import exportStrings from './exported-strings-name.json';
import { Dispatch } from 'redux';
const { stringsName } = exportStrings;

export const fetchLocalization = () => (dispatch: Dispatch) => {
  Axios.get(appPath() + '/localization/' + stringsName).then((strings) => {
    dispatch({
      payload: strings,
      type: FETCH_LOCALIZATION,
    });
  });
};

export const setLanguage = (lang: string): LocalizationMsgs => {
  return {
    payload: lang,
    type: SET_LANGUAGE,
  };
};
