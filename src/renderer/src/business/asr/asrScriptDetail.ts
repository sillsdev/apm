import { LangTag } from 'mui-language-picker';

interface IAsrScriptDetail {
  langTag: LangTag | undefined;
  scriptName: Map<string, string>;
}

export const asrScriptDetail = ({ langTag, scriptName }: IAsrScriptDetail) => {
  let detail = '';
  let showRoman = false;
  if (!['Latn', 'Zyyy'].includes(langTag?.script ?? '')) {
    detail += `Script: ${scriptName.get(langTag?.script ?? '')} [${
      langTag?.script ?? ''
    }]`;
    showRoman = true;
  }
  return { detail, showRoman };
};
