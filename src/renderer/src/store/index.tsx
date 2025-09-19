import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
  type Store,
  type AnyAction,
} from 'redux';
import bookReducer from './book/reducers';
import localizationReducer from './localization/reducers';
import orbitReducer from './orbit/reducers';
import uploadReducer from './upload/reducers';
import paratextReducer from './paratext/reducers';
import exportReducer from './importexport/reducers';
import authReducer from './auth/reducers';
import convertBlobReducer from './convertBlob/reducers';

import { composeWithDevTools } from '@redux-devtools/extension';
import { thunk, ThunkMiddleware } from 'redux-thunk';

const appReducer = combineReducers({
  strings: localizationReducer,
  books: bookReducer,
  orbit: orbitReducer,
  upload: uploadReducer,
  paratext: paratextReducer,
  importexport: exportReducer,
  auth: authReducer,
  convertBlob: convertBlobReducer,
});

export type AppState = ReturnType<typeof appReducer>;
export type AppAction = AnyAction;
export type AppStore = Store<AppState, AppAction>;
export type AppDispatch = AppStore['dispatch'];

export default function configureStore(): AppStore {
  const middleWareEnhancer = applyMiddleware(
    thunk as unknown as ThunkMiddleware<AppState, AppAction, unknown>
  );
  // Disambiguate overload by providing explicit undefined preloaded state
  const store = createStore(
    appReducer,
    undefined,
    composeWithDevTools(middleWareEnhancer)
  );
  return store;
}
/* eslint-disable react-refresh/only-export-components */
export * from './book/actions';
export * from './localization/actions';
export * from './orbit/actions';
export * from './upload/actions';
export * from './paratext/actions';
export * from './importexport/actions';
export * from './auth/actions';
export * from './convertBlob/actions';
