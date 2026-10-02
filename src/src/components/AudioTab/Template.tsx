import { useState, useEffect } from 'react';
import { Box, IconButton } from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import { TemplateEditor } from '../../control';
import { TemplateCode, SECT_TEMPLATE } from '../../control/TemplateEditorUtils';
import { IMatchData } from './makeRefMap';
import { templateSelector } from '../../selector';
import { ITemplateStrings } from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { Render } from '../../assets/brands';

interface IstrMap {
  [key: string]: string;
}

export interface ITemplateProps {
  matchMap: (pat: string, options: IMatchData) => void;
  options: IMatchData;
}

export function Template(props: ITemplateProps) {
  const { matchMap, options } = props;
  const [template, setTemplate] = useState<string>('');
  const tTemplate: ITemplateStrings = useSelector(
    templateSelector,
    shallowEqual
  );

  useEffect(() => {
    if (!template) {
      const lastTemplate = localStorage.getItem('template');
      if (lastTemplate) {
        setTemplate(lastTemplate);
      } else {
        setTemplate(SECT_TEMPLATE);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTemplateChange = (value: string) => {
    setTemplate(value);
    localStorage.setItem('template', value);
  };

  const handleApply = () => {
    if (!template) return;
    const terms = template
      .match(/{([A-Za-z]{3,8})}/g)
      ?.map((v) => v.slice(1, -1));
    const rex: IstrMap = {
      BOOK: '([A-Z1-3]{3})',
      BOOKNAME: '([A-Za-z]+)',
      SECT: '([0-9]+)',
      PASS: '([0-9]+)',
      CHAP: '([0-9]{1,3})',
      BEG: '([0-9]{1,3})',
      END: '([0-9]{1,3})',
    };

    let sPat = template;
    if (terms)
      for (const t of terms) {
        sPat = sPat.replace('{' + t + '}', rex[t]);
      }
    matchMap(sPat, { ...options, terms } as IMatchData);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, maxWidth: '600px' }}>
        <TemplateEditor
          value={template}
          onChange={handleTemplateChange}
          validCodes={[
            TemplateCode.BOOK,
            TemplateCode.BOOKNAME,
            TemplateCode.SECT,
            TemplateCode.PASS,
            TemplateCode.CHAP,
            TemplateCode.BEG,
            TemplateCode.END,
          ]}
          showLabel={true}
          id="audioTabTemplate"
        />
        {template === SECT_TEMPLATE && (
          <Box sx={{ mt: 0.5, ml: 1.5, fontSize: '0.75rem' }}>
            {tTemplate.renderExportTemplate.replace('{0}', Render)}
          </Box>
        )}
      </Box>
      <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
        <IconButton
          id="templApply"
          sx={{ p: 1 }}
          aria-label={tTemplate.apply}
          onClick={handleApply}
          title={tTemplate.apply}
        >
          <DoneIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
export default Template;
