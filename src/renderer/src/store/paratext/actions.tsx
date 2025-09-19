import Axios, { AxiosError } from 'axios';
import { API_CONFIG } from '../../../api-variable';
import path from 'path-browserify';
import {
  Passage,
  ActivityStates,
  IIntegrationStrings,
  MediaFileD,
} from '../../model';
import {
  USERNAME_PENDING,
  USERNAME_SUCCESS,
  USERNAME_ERROR,
  COUNT_PENDING,
  COUNT_SUCCESS,
  COUNT_ERROR,
  PROJECTS_PENDING,
  PROJECTS_SUCCESS,
  PROJECTS_ERROR,
  SYNC_PENDING,
  SYNC_SUCCESS,
  SYNC_ERROR,
  TEXT_PENDING,
  TEXT_ERROR,
  TEXT_SUCCESS,
  CANPUBLISH_PENDING,
  CANPUBLISH_SUCCESS,
  CANPUBLISH_ERROR,
} from './types';
import { ParatextProject } from '../../model/paratextProject';
import { pendingStatus, errStatus, errorStatus } from '../AxiosStatus';
import { findRecord, getMediaInPlans, related } from '../../crud';
import {
  fileJson,
  infoMsg,
  logError,
  Severity,
  refMatch,
  axiosError,
} from '../../utils';
import { getLocalParatextText } from '../../business/localParatext';
import MemorySource from '@orbit/memory';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { PassageTypeEnum } from '../../model/passageType';
import { Paratext } from '../../assets/brands';
import bugsnagClient from 'auth/bugsnagClient';
import { Dispatch } from 'redux';
const ipc = window?.electron;

export const resetUserName = () => (dispatch: Dispatch) => {
  dispatch({
    payload: undefined,
    type: USERNAME_PENDING,
  });
};
export const resetParatextText = () => async (dispatch: Dispatch) => {
  dispatch({
    payload: undefined,
    type: TEXT_PENDING,
  });
};
export const getParatextText =
  (
    token: string,
    passageId: number,
    artifactId: string | null,
    errorReporter: typeof bugsnagClient,
    pendingmsg: string
  ) =>
  async (dispatch: Dispatch) => {
    dispatch({
      payload: pendingStatus(pendingmsg),
      type: TEXT_PENDING,
    });
    try {
      let url =
        API_CONFIG.host + '/api/paratext/passage/' + passageId.toString();
      if (artifactId) url += `/${artifactId}`;
      const response = await Axios.get(url, {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      });
      dispatch({ payload: response.data, type: TEXT_SUCCESS });
    } catch (errResponse: unknown) {
      const err = errResponse as AxiosError;
      const msg: string = err.response?.data?.toString() ?? err.message;
      if (!msg.includes('no range') && !msg.includes('401'))
        logError(
          Severity.error,
          errorReporter,
          infoMsg(err, Paratext + ' Text failed')
        );
      dispatch({ payload: errStatus(err), type: TEXT_ERROR });
    }
  };
export const getParatextTextLocal =
  (
    ptPath: string,
    passage: Passage,
    ptProjName: string,
    errorReporter: typeof bugsnagClient,
    pendingmsg: string
  ) =>
  (dispatch: Dispatch) => {
    dispatch({
      payload: pendingStatus(pendingmsg),
      type: TEXT_PENDING,
    });
    try {
      localProjects(ptPath, undefined, ptProjName).then((pt) => {
        if (pt && pt.length > 0) {
          getLocalParatextText(
            passage,
            (pt[0] as ParatextProject).ShortName
          ).then((response) =>
            dispatch({ payload: response, type: TEXT_SUCCESS })
          );
        } else
          dispatch({
            payload: errorStatus(undefined, 'No Local Project' + ptProjName),
            type: TEXT_ERROR,
          });
      });
    } catch (errResponse: unknown) {
      const err = errResponse as AxiosError;
      if (err.message !== 'no range')
        logError(
          Severity.error,
          errorReporter,
          infoMsg(err, Paratext + ' Text failed')
        );
      dispatch({ payload: errStatus(err), type: TEXT_ERROR });
    }
  };

export const getUserName =
  (token: string, errorReporter: typeof bugsnagClient, pendingmsg: string) =>
  async (dispatch: Dispatch) => {
    dispatch({
      payload: pendingStatus(pendingmsg),
      type: USERNAME_PENDING,
    });
    let numTries = 5;
    let success = false;
    let lasterr: AxiosError | null = null;
    while (numTries > 0 && !success) {
      try {
        const response = await Axios.get(
          API_CONFIG.host + '/api/paratext/username',
          {
            headers: {
              Authorization: 'Bearer ' + token,
            },
          }
        );
        dispatch({ payload: response.data, type: USERNAME_SUCCESS });
        success = true;
      } catch (err: unknown) {
        lasterr = err as AxiosError;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      numTries--;
    }
    if (!success) {
      logError(Severity.info, errorReporter, 'Username failed');
      dispatch({
        payload:
          lasterr !== null
            ? errStatus(lasterr)
            : errorStatus(-1, 'unknown username error'),
        type: USERNAME_ERROR,
      });
    }
  };

export const getCanPublish =
  (token: string, errorReporter: typeof bugsnagClient, pendingmsg: string) =>
  async (dispatch: Dispatch): Promise<void> => {
    dispatch({
      payload: pendingStatus(pendingmsg),
      type: CANPUBLISH_PENDING,
    });
    try {
      const response = await Axios.get(
        API_CONFIG.host + '/api/paratext/canpublish',
        {
          headers: {
            Authorization: 'Bearer ' + token,
          },
        }
      );
      dispatch({ payload: response.data, type: CANPUBLISH_SUCCESS });
    } catch (err: unknown) {
      logError(Severity.info, errorReporter, 'CanPublish failed');
      dispatch({
        payload: errStatus(err as AxiosError),
        type: CANPUBLISH_ERROR,
      });
    }
  };

export const resetCanPublish = () => (dispatch: Dispatch) => {
  dispatch({
    payload: undefined,
    type: CANPUBLISH_PENDING,
  });
};

export const resetProjects = () => (dispatch: Dispatch) => {
  dispatch({
    payload: undefined,
    type: PROJECTS_PENDING,
  });
};

export const getProjects =
  (
    token: string,
    pendingmsg: string,
    errorReporter: typeof bugsnagClient,
    languageTag?: string
  ) =>
  (dispatch: Dispatch) => {
    dispatch({
      payload: pendingStatus(pendingmsg),
      type: PROJECTS_PENDING,
    });
    let url = API_CONFIG.host + '/api/paratext/projects';
    if (languageTag) url += '/' + languageTag;
    Axios.get(url, {
      headers: {
        Authorization: 'Bearer ' + token,
      },
    })
      .then((response) => {
        const pt: ParatextProject[] = [];
        const data = response.data;
        for (let ix = 0; ix < data?.length; ix++) {
          const o: ParatextProject = {
            Name: data[ix].name,
            ShortName: data[ix].shortName,
            ParatextId: data[ix].paratextId,
            LanguageName: data[ix].languageName,
            LanguageTag: data[ix].languageTag,
            CurrentUserRole: data[ix].currentUserRole,
            ProjectType: data[ix].projectType,
            BaseProject: data[ix].baseProject,
            IsConnectable: data[ix].isConnectable,
          };
          pt.push(o);
        }
        dispatch({ payload: pt, type: PROJECTS_SUCCESS });
      })
      .catch((err) => {
        logError(
          Severity.error,
          errorReporter,
          infoMsg(err, 'Projects failed')
        );
        dispatch({ payload: errStatus(err), type: PROJECTS_ERROR });
      });
  };

type ScriptureTextType = { [key: string]: { _text: string } };

const localProjects = async (
  ptPath: string,
  languageTag?: string,
  projName?: string
): Promise<ParatextProject[]> => {
  if (ptPath === '') return [];
  let pt: ParatextProject[] = [];
  let fileList = await ipc?.readDir(ptPath);
  fileList = fileList.filter(
    (n: string) => n.indexOf('.') === -1 && n[0] !== '_'
  );
  for (const n of fileList) {
    const settingsPath = path.join(ptPath, n, 'Settings.xml');
    const settingsJson = await fileJson(settingsPath);
    if (settingsJson) {
      const setting = settingsJson.ScriptureText as ScriptureTextType;
      const langIso = setting.LanguageIsoCode?._text
        .replace(/::?:?/g, '-')
        .replace(/-$/, '');
      pt.push({
        ParatextId: setting.Guid?._text,
        Name: setting.FullName?._text,
        ShortName: setting.Name?._text,
        LanguageName: setting.Language?._text,
        LanguageTag: langIso,
        CurrentUserRole: setting.Editable?._text === 'T' ? 'pt_translator' : '',
        IsConnectable: setting.Editable?._text === 'T',
        ProjectType: setting.TranslationInfo?._text.split(':')[0],
        BaseProject: setting.TranslationInfo?._text.split(':')[2],
      } as ParatextProject);
    }
  }
  if (projName) {
    pt = pt.filter((p) => p.Name === projName);
  }
  if (languageTag) {
    pt = pt.filter(
      (p) =>
        p.LanguageTag === languageTag ||
        (p.BaseProject !== '' &&
          pt.find((b) => b.ParatextId === p.BaseProject)?.LanguageTag ===
            languageTag)
    );
  }
  return pt;
};

export const getLocalProjects =
  (
    ptPath: string,
    pendingmsg: string,
    projIds: {
      Name: string;
      Id: string;
    }[],
    languageTag?: string
  ) =>
  (dispatch: Dispatch) => {
    dispatch({
      payload: pendingStatus(pendingmsg),
      type: PROJECTS_PENDING,
    });
    if (ptPath === '') return;
    localProjects(ptPath, languageTag).then((pts) =>
      dispatch({ payload: pts, type: PROJECTS_SUCCESS })
    );
  };

export const resetCount = () => (dispatch: Dispatch) => {
  dispatch({
    payload: undefined,
    type: COUNT_PENDING,
  });
};
//not used
export const getCount =
  (
    token: string,
    kind: string,
    id: number,
    errorReporter: typeof bugsnagClient,
    pendingmsg: string
  ) =>
  (dispatch: Dispatch) => {
    dispatch({
      payload: pendingStatus(pendingmsg),
      type: COUNT_PENDING,
    });
    const path =
      API_CONFIG.host + '/api/paratext/' + kind + '/' + id + '/count';
    Axios.get(path, {
      headers: {
        Authorization: 'Bearer ' + token,
      },
    })
      .then((response) => {
        dispatch({ payload: response.data, type: COUNT_SUCCESS });
      })
      .catch((err) => {
        logError(Severity.error, errorReporter, infoMsg(err, 'Count failed'));
        dispatch({ payload: errStatus(err), type: COUNT_ERROR });
      });
  };

export const getLocalCount =
  (
    mediafiles: MediaFileD[],
    plan: string,
    memory: MemorySource,
    errorReporter: typeof bugsnagClient,
    t: IIntegrationStrings,
    artifactId: string | null,
    passageId: string | undefined
  ) =>
  (dispatch: Dispatch) => {
    dispatch({
      payload: pendingStatus(t.countPending),
      type: COUNT_PENDING,
    });
    const media = plan
      ? getMediaInPlans([plan], mediafiles, artifactId, true)
      : [];
    let ready = media.filter(
      (m) =>
        m.attributes?.transcriptionstate === ActivityStates.Approved &&
        Boolean(related(m, 'passage'))
    );
    if (passageId)
      ready = ready.filter((m) => related(m, 'passage') === passageId);

    // remove those that are notes
    ready = ready.filter((m) => {
      const passage = findRecord(
        memory,
        'passage',
        related(m, 'passage')
      ) as Passage;
      const ref = passage?.attributes?.reference ?? 'Err';
      return passageTypeFromRef(ref, false) !== PassageTypeEnum.NOTE;
    });

    const refMissing = ready.filter((m) => {
      const passage = findRecord(
        memory,
        'passage',
        related(m, 'passage')
      ) as Passage;
      const ref = passage?.attributes?.reference ?? 'Err';
      return !refMatch(ref) || !passage?.attributes?.book;
    });
    if (refMissing.length > 0) {
      const err = errorStatus(
        101,
        t.invalidReferences.replace('{0}', `${refMissing.length}`)
      );
      logError(Severity.error, errorReporter, axiosError(err));
      dispatch({
        type: COUNT_ERROR,
        payload: err,
      });
    } else dispatch({ payload: ready.length, type: COUNT_SUCCESS });
  };

export const resetSync = () => (dispatch: Dispatch) => {
  dispatch({ payload: undefined, type: SYNC_PENDING });
};

export const syncPassage =
  (
    token: string,
    passageId: number,
    typeId: number, //0 for vernacular?
    errorReporter: typeof bugsnagClient,
    pendingmsg: string,
    successmsg: string
  ) =>
  (dispatch: Dispatch) => {
    dispatch({ payload: pendingStatus(pendingmsg), type: SYNC_PENDING });

    Axios.post(
      `${API_CONFIG.host}/api/paratext/passage/${passageId}/${typeId}`,
      null,
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      }
    )
      .then(() => {
        dispatch({ payload: successmsg, type: SYNC_SUCCESS });
      })
      .catch((err) => {
        logError(Severity.error, errorReporter, infoMsg(err, 'Sync Failed'));
        dispatch({ payload: errStatus(err), type: SYNC_ERROR });
      });
  };

export const syncProject =
  (
    token: string,
    projectId: number,
    typeId: number, //0 for vernacular?
    errorReporter: typeof bugsnagClient,
    pendingmsg: string,
    successmsg: string
  ) =>
  (dispatch: Dispatch) => {
    dispatch({ payload: pendingStatus(pendingmsg), type: SYNC_PENDING });

    Axios.post(
      `${API_CONFIG.host}/api/paratext/project/${projectId}/${typeId}`,
      null,
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      }
    )
      .then(() => {
        dispatch({ payload: successmsg, type: SYNC_SUCCESS });
      })
      .catch((err) => {
        logError(Severity.error, errorReporter, infoMsg(err, 'Sync Failed'));
        dispatch({ payload: errStatus(err), type: SYNC_ERROR });
      });
  };
