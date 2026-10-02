import { JSONParse } from './jsonParse';

interface JsonParamResults {
  getParam: (label: string, params: string | undefined) => unknown;
  setParam: (
    label: string,
    value: unknown,
    params: string | undefined
  ) => string | undefined;
  willSetParam: (
    label: string,
    value: unknown,
    params: string | undefined
  ) => boolean;
}

export const useJsonParams = (): JsonParamResults => {
  const getParam = (label: string, params: string | undefined): unknown => {
    const jsonParse = JSONParse(params);
    const json = jsonParse as Record<string, unknown>;
    if (json[label] !== undefined) {
      if (typeof json[label] === 'string' && json[label] !== '') {
        const tmp = JSONParse(json[label]);
        //because of a bug in setParam that went out with the beta...handle this
        if (typeof tmp === 'string' && json[label] !== '') {
          return JSONParse(tmp);
        } else return tmp;
      } else return json[label];
    }
    return undefined;
  };

  const setParam = (
    label: string,
    value: unknown,
    params: string | undefined
  ): string | undefined => {
    const jsonParse = JSONParse(params);
    const json = jsonParse as Record<string, unknown>;

    if (value !== undefined) {
      const tmp = JSON.stringify(value);
      if (tmp !== json[label]) {
        json[label] = value;
      }
    } else if ((json[label] ?? '') !== '') {
      delete json[label];
    }
    return JSON.stringify(json);
  };

  const willSetParam = (
    label: string,
    value: unknown,
    params: string | undefined
  ): boolean => {
    if (value !== undefined) {
      const tmp = JSON.stringify(value);
      const curVal = JSON.stringify(getParam(label, params));
      if (tmp !== curVal) {
        return true;
      }
    } else {
      const jsonParse = JSONParse(params);
      const json = jsonParse as Record<string, unknown>;
      if ((json[label] ?? '') !== '') {
        return true;
      }
    }
    return false;
  };
  return { getParam, setParam, willSetParam };
};
