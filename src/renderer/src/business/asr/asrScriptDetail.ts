import { LangTag } from 'mui-language-picker';

interface IAsrScriptDetail {
  langTag: LangTag | undefined;
  scriptName: Map<string, string>;
}

export const asrScriptDetail = ({ langTag, scriptName }: IAsrScriptDetail) => {
  let detail = '';
  let showRoman = false;
  const script = langTag?.script ?? '';
  if (script && !['Latn', 'Zyyy'].includes(script)) {
    detail += `Script: ${scriptName.get(script) ?? script} [${script}]`;
    showRoman = true;
  }
  return { detail, showRoman };
};
