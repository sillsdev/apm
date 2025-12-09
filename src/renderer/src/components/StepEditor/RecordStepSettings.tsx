import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ISharedStrings, IRecordStepSettingsStrings } from '../../model';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useOrganizedBy } from '../../crud';
import { sharedSelector, recordStepSettingsSelector } from '../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { JSONParse } from '../../utils';
import { ActionRow, AltButton, PriButton, TemplateEditor } from '../../control';
import { TemplateText } from '../../control/TemplateEditorHelpers';
import {
  TemplateCode,
  BOOK_CHAPTER_PASSAGE_TEMPLATE,
  SECTION_PASSAGE_TEMPLATE,
  REFERENCE_TEMPLATE,
  NOTE_TITLE_TEMPLATE,
} from '../../control/TemplateEditorUtils';

interface IProps {
  toolSettings: string;
  onChange: (toolSettings: string) => void;
  onClose?: () => void;
}

type FilenameFormat =
  | 'bookChapterPassage'
  | 'reference'
  | 'sectionPassage'
  | 'title'
  | 'custom';

export const RecordStepSettings = ({
  toolSettings,
  onChange,
  onClose,
}: IProps) => {
  const [scriptureTemplate, setScriptureTemplate] = useState<string>(
    BOOK_CHAPTER_PASSAGE_TEMPLATE
  );
  const [generalTemplate, setGeneralTemplate] = useState<string>('');
  const [notesTemplate, setNotesTemplate] = useState<string>('');
  const [saveAsWav, setSaveAsWav] = useState(false);
  const [scriptureFormat, setScriptureFormat] =
    useState<FilenameFormat>('bookChapterPassage');
  const [generalFormat, setGeneralFormat] =
    useState<FilenameFormat>('reference');
  const [notesFormat, setNotesFormat] = useState<FilenameFormat>('title');
  const [scriptureExpanded, setScriptureExpanded] = useState(false);
  const [generalExpanded, setGeneralExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [scriptureTemplateValid, setScriptureTemplateValid] = useState(true);
  const [generalTemplateValid, setGeneralTemplateValid] = useState(true);
  const [notesTemplateValid, setNotesTemplateValid] = useState(true);
  const initialSettingsRef = useRef<string>('');
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t: IRecordStepSettingsStrings = useSelector(
    recordStepSettingsSelector,
    shallowEqual
  );
  const scriptureCodes = [
    TemplateCode.BOOK,
    TemplateCode.BOOKNAME,
    TemplateCode.SECT,
    TemplateCode.PASS,
    TemplateCode.CHAP,
    TemplateCode.BEG,
    TemplateCode.END,
    TemplateCode.REF,
  ];
  const generalCodes = [TemplateCode.SECT, TemplateCode.PASS, TemplateCode.REF];
  const notesCodes = [
    TemplateCode.BOOK,
    TemplateCode.BOOKNAME,
    TemplateCode.SECT,
    TemplateCode.PASS,
    TemplateCode.REF,
    TemplateCode.TITLE,
  ];
  const templateMap = useMemo(
    () =>
      new Map<FilenameFormat, string>([
        ['bookChapterPassage', BOOK_CHAPTER_PASSAGE_TEMPLATE],
        ['sectionPassage', SECTION_PASSAGE_TEMPLATE],
        ['reference', REFERENCE_TEMPLATE],
        ['title', NOTE_TITLE_TEMPLATE],
      ]),
    []
  );

  const handleScriptureTemplateChange = (newValue: string) => {
    setScriptureTemplate(newValue);
    setScriptureFormat('custom');
  };

  const handleGeneralTemplateChange = (newValue: string) => {
    setGeneralTemplate(newValue);
    setGeneralFormat('custom');
  };

  const handleNotesTemplateChange = (newValue: string) => {
    setNotesTemplate(newValue);
    setNotesFormat('custom');
  };

  const handleSaveAsWavChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSaveAsWav(checked);
  };

  const handleScriptureFormatChange = (format: FilenameFormat) => {
    setScriptureFormat(format);
    // Reset validity when switching away from custom
    if (format !== 'custom') {
      setScriptureTemplateValid(true);
    }
  };

  const handleGeneralFormatChange = (format: FilenameFormat) => {
    setGeneralFormat(format);
    // Reset validity when switching away from custom
    if (format !== 'custom') {
      setGeneralTemplateValid(true);
    }
  };

  const handleNotesFormatChange = (format: FilenameFormat) => {
    setNotesFormat(format);
    // Reset validity when switching away from custom
    if (format !== 'custom') {
      setNotesTemplateValid(true);
    }
  };

  const getCurrentSettings = () => {
    return JSON.stringify({
      saveAsWav,
      scriptureFilenameTemplate: getScriptureTemplate(),
      generalFilenameTemplate: getGeneralTemplate(),
      notesFilenameTemplate: getNotesTemplate(),
    });
  };

  const hasInvalidTemplates = (): boolean => {
    // Only check templates that are in "custom" format
    if (scriptureFormat === 'custom' && !scriptureTemplateValid) {
      return true;
    }
    if (generalFormat === 'custom' && !generalTemplateValid) {
      return true;
    }
    if (notesFormat === 'custom' && !notesTemplateValid) {
      return true;
    }
    return false;
  };

  const getScriptureTemplate = (): string => {
    return (
      templateMap.get(scriptureFormat) ||
      scriptureTemplate ||
      BOOK_CHAPTER_PASSAGE_TEMPLATE
    );
  };

  const getGeneralTemplate = (): string => {
    return (
      templateMap.get(generalFormat) || generalTemplate || REFERENCE_TEMPLATE
    );
  };

  const getNotesTemplate = (): string => {
    return templateMap.get(notesFormat) || notesTemplate || NOTE_TITLE_TEMPLATE;
  };

  const hasChanges = () => {
    return getCurrentSettings() !== initialSettingsRef.current;
  };

  const handleSave = () => {
    onChange(getCurrentSettings());
    initialSettingsRef.current = getCurrentSettings();
    if (onClose) {
      onClose();
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    const formatFromTemplate = (findit: string) => {
      let foundFormat: FilenameFormat = 'custom';
      for (const [format, template] of templateMap.entries()) {
        if (template === findit) {
          foundFormat = format;
          break;
        }
      }
      return foundFormat;
    };
    let newScriptureTemplate = BOOK_CHAPTER_PASSAGE_TEMPLATE;
    let newGeneralTemplate = REFERENCE_TEMPLATE;
    let newNotesTemplate = NOTE_TITLE_TEMPLATE;
    let saveAsWav = false;
    if (toolSettings) {
      const json = JSONParse(toolSettings) as Record<string, any>;
      newScriptureTemplate =
        json.scriptureFilenameTemplate || BOOK_CHAPTER_PASSAGE_TEMPLATE;
      newGeneralTemplate = json.generalFilenameTemplate || REFERENCE_TEMPLATE;
      newNotesTemplate = json.notesFilenameTemplate || NOTE_TITLE_TEMPLATE;
      saveAsWav = json.saveAsWav || false;
    }
    setScriptureTemplate(newScriptureTemplate);
    setGeneralTemplate(newGeneralTemplate);
    setNotesTemplate(newNotesTemplate);
    setSaveAsWav(saveAsWav);

    setScriptureFormat(formatFromTemplate(newScriptureTemplate));
    setGeneralFormat(formatFromTemplate(newGeneralTemplate));
    setNotesFormat(formatFromTemplate(newNotesTemplate));
    // Reset validity states - TemplateEditor will update them when rendered
    setScriptureTemplateValid(true);
    setGeneralTemplateValid(true);
    setNotesTemplateValid(true);

    // Store initial settings
    initialSettingsRef.current = JSON.stringify({
      saveAsWav: saveAsWav,
      scriptureFilenameTemplate: newScriptureTemplate,
      generalFilenameTemplate: newGeneralTemplate,
      notesFilenameTemplate: newNotesTemplate,
    });
  }, [toolSettings, templateMap]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={saveAsWav}
              onChange={handleSaveAsWavChange}
              id="record-save-as-wav"
            />
          }
          label={t.saveAsWav}
        />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 4.5 }}>
          {t.saveAsWavHelper}
        </Typography>
      </Box>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
        }}
      >
        <FormLabel component="legend" sx={{ mb: 2, fontWeight: 'medium' }}>
          {t.fileNameTemplate}
        </FormLabel>

        <Accordion
          expanded={scriptureExpanded}
          onChange={(_, expanded) => setScriptureExpanded(expanded)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}
            >
              <Typography>{t.scripture}</Typography>
              {!scriptureExpanded && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {scriptureFormat === 'custom' ? (
                    <TemplateText template={getScriptureTemplate()} />
                  ) : (
                    getScriptureTemplate()
                  )}
                </Typography>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={scriptureFormat}
                onChange={(e) =>
                  handleScriptureFormatChange(e.target.value as FilenameFormat)
                }
              >
                <FormControlLabel
                  value="bookChapterPassage"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>{t.useBookChapterPassage}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {BOOK_CHAPTER_PASSAGE_TEMPLATE}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="sectionPassage"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>
                        {t.useSectionNumberAndPassageNumber.replace(
                          '{0}',
                          organizedBy
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {SECTION_PASSAGE_TEMPLATE}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>{t.custom}</Typography>
                      <TemplateText
                        template={
                          scriptureTemplate || BOOK_CHAPTER_PASSAGE_TEMPLATE
                        }
                      />
                    </Box>
                  }
                />
              </RadioGroup>
              {scriptureFormat === 'custom' && (
                <TemplateEditor
                  value={scriptureTemplate}
                  onChange={handleScriptureTemplateChange}
                  validCodes={scriptureCodes}
                  id="scripture"
                  onValid={setScriptureTemplateValid}
                />
              )}
            </FormControl>
          </AccordionDetails>
        </Accordion>

        <Accordion
          expanded={generalExpanded}
          onChange={(_, expanded) => setGeneralExpanded(expanded)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}
            >
              <Typography>{t.general}</Typography>
              {!generalExpanded && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {generalFormat === 'custom' ? (
                    <TemplateText template={getGeneralTemplate()} />
                  ) : (
                    getGeneralTemplate()
                  )}
                </Typography>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={generalFormat}
                onChange={(e) =>
                  handleGeneralFormatChange(e.target.value as FilenameFormat)
                }
              >
                <FormControlLabel
                  value="reference"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>{t.useReference}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {REFERENCE_TEMPLATE}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="sectionPassage"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>
                        {t.useSectionNumberAndPassageNumber.replace(
                          '{0}',
                          organizedBy
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {SECTION_PASSAGE_TEMPLATE}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>{t.custom}</Typography>
                      <TemplateText
                        template={generalTemplate || REFERENCE_TEMPLATE}
                      />
                    </Box>
                  }
                />
              </RadioGroup>
              {generalFormat === 'custom' && (
                <TemplateEditor
                  value={generalTemplate}
                  onChange={handleGeneralTemplateChange}
                  validCodes={generalCodes}
                  id="general"
                  onValid={setGeneralTemplateValid}
                />
              )}
            </FormControl>
          </AccordionDetails>
        </Accordion>

        <Accordion
          expanded={notesExpanded}
          onChange={(_, expanded) => setNotesExpanded(expanded)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}
            >
              <Typography>{t.notes}</Typography>
              {!notesExpanded && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {notesFormat === 'custom' ? (
                    <TemplateText template={getNotesTemplate()} />
                  ) : (
                    getNotesTemplate()
                  )}
                </Typography>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={notesFormat}
                onChange={(e) =>
                  handleNotesFormatChange(e.target.value as FilenameFormat)
                }
              >
                <FormControlLabel
                  value="title"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>{t.useTitle}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {NOTE_TITLE_TEMPLATE}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="sectionPassage"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>
                        {t.useSectionNumberAndPassageNumber.replace(
                          '{0}',
                          organizedBy
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {SECTION_PASSAGE_TEMPLATE}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>{t.custom}</Typography>
                      <TemplateText
                        template={notesTemplate || NOTE_TITLE_TEMPLATE}
                      />
                    </Box>
                  }
                />
              </RadioGroup>
              {notesFormat === 'custom' && (
                <TemplateEditor
                  value={notesTemplate}
                  onChange={handleNotesTemplateChange}
                  validCodes={notesCodes}
                  id="notes"
                  onValid={setNotesTemplateValid}
                />
              )}
            </FormControl>
          </AccordionDetails>
        </Accordion>
      </Box>

      <ActionRow>
        <AltButton onClick={handleCancel}>{ts.cancel}</AltButton>
        <PriButton
          onClick={handleSave}
          disabled={!hasChanges() || hasInvalidTemplates()}
        >
          {ts.save}
        </PriButton>
      </ActionRow>
    </Box>
  );
};
