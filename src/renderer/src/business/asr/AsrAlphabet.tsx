import React from 'react';
import { Stack, Typography, Checkbox, FormControlLabel } from '@mui/material';
import { ILanguage, Language } from '../../control/Language';
import { getLangTag } from 'mui-language-picker';
import { asrScriptDetail } from './asrScriptDetail';
import scriptNameData from '../../assets/scriptName';
import { ITranscriberStrings } from '../../model';
import { transcriberSelector } from '../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { AsrTarget } from './AsrTarget';
import { asrLanguageFilter, preferredAsrMethodFromBcp47 } from './asrLanguages';
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
  const [scriptName] = React.useState(
    new Map(scriptNameData as [string, string][])
  );

  React.useEffect(() => {
    const bcp47 = state?.language?.bcp47 ?? 'und';
    const newLangTag = getLangTag(bcp47);
    const { detail, showRoman } = asrScriptDetail({
      langTag: newLangTag,
      scriptName,
    });
    setScriptDetail(detail);
    setShowRoman(showRoman);
    const method = preferredAsrMethodFromBcp47(bcp47);
    if (method && method !== state.method) {
      setState((prev) => (prev ? { ...prev, method } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.language?.bcp47]);

  const setLang = (language: ILanguage) => {
    if (init.current) {
      init.current = false;
      return;
    }
    const langTag = getLangTag(language?.bcp47 ?? 'und');
    let mmsIso = langTag?.iso639_3 ?? 'und';
    if (langTag?.tag === 'zh-CN') mmsIso = 'cmn';
    const method = preferredAsrMethodFromBcp47(language?.bcp47 ?? 'und');
    setState({
      ...state,
      language,
      mmsIso,
      method,
      dialect: undefined,
      selectRoman: false,
    });
  };

  const handleRoman = (_event: any, checked: boolean) => {
    setState({ ...state, selectRoman: checked });
  };

  return (
    <Stack direction="row" spacing={1} sx={{ mx: 1 }}>
      <Language
        {...state.language}
        onChange={setLang}
        filter={asrLanguageFilter}
        hideSpelling={true}
        hideFont={true}
      />
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
