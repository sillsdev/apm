import React from 'react';
import {
  Stack,
  Typography,
  Checkbox,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import { ILanguage, Language } from '../../control/Language';
import { getLangTag } from 'mui-language-picker';
import { asrScriptDetail } from './asrScriptDetail';
import scriptNameData from '../../assets/scriptName';
import { ITranscriberStrings } from '../../model';
import { transcriberSelector } from '../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { AsrTarget } from './AsrTarget';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { logError, Severity } from '../../utils';
import { toError } from '../../utils/toError';
import { asrLanguageFilter, loadAsrLanguages } from './asrLanguages';
import { IAsrState } from './asrState';

interface IAsrAlphabet {
  state: IAsrState;
  setState: React.Dispatch<React.SetStateAction<IAsrState | undefined>>;
}

export const AsrAlphabet = ({ state, setState }: IAsrAlphabet) => {
  const [scriptDetail, setScriptDetail] = React.useState('');
  const [showRoman, setShowRoman] = React.useState(false);
  const init = React.useRef(true);
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const token = React.useContext(TokenContext)?.state?.accessToken ?? null;
  const [errorReporter] = useGlobal('errorReporter');
  const [listStatus, setListStatus] = React.useState<
    'loading' | 'ready' | 'failed'
  >('loading');
  const [scriptName] = React.useState(
    new Map(scriptNameData as [string, string][])
  );

  React.useEffect(() => {
    let cancelled = false;
    // No token yet (common on first render): stay loading. This effect runs
    // again when the token arrives, and only a failed request shows the error.
    if (token) {
      loadAsrLanguages(token)
        .then(() => {
          if (!cancelled) setListStatus('ready');
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          logError(Severity.error, errorReporter, toError(err));
          setListStatus('failed');
        });
    }
    return () => {
      cancelled = true;
    };
  }, [token, errorReporter]);

  React.useEffect(() => {
    const bcp47 = state?.language?.bcp47 ?? 'und';
    const newLangTag = getLangTag(bcp47);
    const { detail, showRoman } = asrScriptDetail({
      langTag: newLangTag,
      scriptName,
    });
    setScriptDetail(detail);
    setShowRoman(showRoman);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.language?.bcp47]);

  const setLang = (language: ILanguage) => {
    if (init.current) {
      init.current = false;
      return;
    }
    const langTag = getLangTag(language?.bcp47 ?? 'und');
    let asrIso = langTag?.iso639_3 ?? 'und';
    if (langTag?.tag === 'zh-CN') asrIso = 'cmn';
    setState({
      ...state,
      language,
      asrIso,
      asrMethod: undefined,
      dialect: undefined,
      selectRoman: false,
    });
  };

  const handleRoman = (_event: any, checked: boolean) => {
    setState({ ...state, selectRoman: checked });
  };

  return (
    <Stack direction="row" spacing={1} sx={{ mx: 1 }}>
      <Stack>
        <Language
          {...state.language}
          onChange={setLang}
          filter={listStatus === 'ready' ? asrLanguageFilter : () => false}
          hideSpelling={true}
          hideFont={true}
        />
        {/* The list stays empty until aero answers; show that it is coming. */}
        {listStatus === 'loading' && <LinearProgress sx={{ mt: 0.5 }} />}
        {listStatus === 'failed' && (
          <Typography variant="body2" color="error">
            {t.asrRequestFailed}
          </Typography>
        )}
      </Stack>
      <Stack direction="column">
        {scriptDetail ? <Typography>{scriptDetail}</Typography> : <></>}
        {showRoman && (
          <FormControlLabel
            control={
              <Checkbox
                checked={state.selectRoman ?? false}
                onChange={handleRoman}
                disabled={state.target !== AsrTarget.alphabet}
              />
            }
            label={t.transliterate}
          />
        )}
      </Stack>
    </Stack>
  );
};
