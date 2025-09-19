import { ISharedStrings } from '../model';
import { IAxiosStatus } from '../store/AxiosStatus';
import { addPt } from './addPt';

const myPt = (s: string): string => addPt(s, '{Pt}');

const translateParatextReferenceError = (
  errMsg: string,
  t: ISharedStrings
): JSX.Element => {
  const errs = errMsg.split('||');
  const localizedErr: JSX.Element[] = [];
  errs.forEach((referr) => {
    const parts = referr.split('|');
    const sect = parts[1] as string;
    const pass = parts[2] as string;
    const book = parts[3] as string;
    let str = '';
    switch (parts[0]) {
      case 'Empty Book':
        str = t.BookNotSet.replace('{0}', sect).replace('{1}', pass);
        break;
      case 'Missing Book':
        str = myPt(t.bookNotInParatext)
          .replace('{0}', sect)
          .replace('{1}', pass)
          .replace('{2}', book);
        break;
      case 'Chapter':
        str = t.paratextchapterSpan
          .replace('{0}', sect)
          .replace('{1}', pass)
          .replace('{2}', book);
        break;
      case 'Reference':
        str = t.invalidReference
          .replace('{0}', sect)
          .replace('{1}', pass)
          .replace('{2}', book);
    }
    localizedErr.push(
      <>
        {str}
        <br />
      </>
    );
  });
  return <span>{localizedErr}</span>;
};
export const translateParatextError = (
  err: IAxiosStatus,
  t: ISharedStrings
): string | JSX.Element => {
  if (err.errStatus === 401) return t.expiredToken;
  if (err.errStatus === 400) return myPt(t.invalidParatextLogin);
  if (err.errStatus === 500) {
    if (
      (err?.errMsg?.length ?? 0) === 0 ||
      err.errMsg.indexOf('Detail: ') + 'Detail: '.length ===
        err.errMsg.length ||
      err.errMsg.includes('SecurityException') ||
      err.errMsg.includes('401') ||
      err.errMsg.includes('400')
    )
      return myPt(t.expiredParatextToken);
    if (err.errMsg.includes('logged in')) return myPt(t.invalidParatextLogin);
  }
  return translateParatextErr(err.errMsg, t);
};
export const translateParatextErr = (
  errMsg: string,
  t: ISharedStrings
): string | JSX.Element => {
  if (errMsg.includes('ReferenceError')) {
    return translateParatextReferenceError(errMsg, t);
  }
  if (errMsg.includes('no range')) return myPt(t.referenceNotFound);
  if (errMsg.includes('does not contain the book')) return myPt(t.bookNotFound);
  return errMsg;
};
