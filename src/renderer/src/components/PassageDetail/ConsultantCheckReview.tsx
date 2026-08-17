import { useEffect, useMemo, useState } from 'react';
import { MediaFileD } from '../../model';
import { mediaFileName } from '../../crud/media';
import { useArtifactType } from '../../crud/useArtifactType';
import { related } from '../../crud/related';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import { IRow } from '../../context/PassageDetailContext';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { useRenderProfiler, useWhyRender } from '../../utils/perf';
import {
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableCellProps,
  TableHead,
  TableRow,
  Typography,
  styled,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { consultantSelector } from '../../selector';
import PlayArrow from '@mui/icons-material/PlayArrow';
import CancelPlay from '@mui/icons-material/Clear';
import { prettySegment } from '../../utils/prettySegment';
import ArtifactStatus from '../ArtifactStatus';
import { getSegments, NamedRegions } from '../../utils/namedSegments';
import { parseStepLanguageField } from '../../crud/transcribeStepAsrSettings';
import { phraseBtBoundaryRegionName } from './carefulSpeech/matchesGuidedOutputRow';
import { hasPhraseRegions } from './carefulSpeech/carefulSpeechBoundary';

const StyledCell = styled(TableCell)<TableCellProps>(() => ({
  padding: '4px',
}));

interface IProps {
  item: ArtifactTypeSlug;
  onPlayer?: (mediaId: string) => void;
  playId?: string;
}

function languageOptionsFromRows(
  rows: IRow[],
  artifactType: string,
  vernacularId: string
): { bcp47: string; label: string }[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.artifactType !== artifactType) continue;
    if (related(r.mediafile, 'sourceMedia') !== vernacularId) continue;
    const parsed = parseStepLanguageField(
      r.mediafile.attributes?.languagebcp47
    );
    if (parsed.bcp47 === 'und') continue;
    const label = parsed.languageName
      ? `${parsed.languageName} (${parsed.bcp47})`
      : parsed.bcp47;
    map.set(parsed.bcp47, label);
  }
  return Array.from(map.entries())
    .map(([bcp47, label]) => ({ bcp47, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function ConsultantCheckReview({
  item,
  onPlayer,
  playId,
}: IProps) {
  useRenderProfiler('ConsultantCheckReview');
  const { rowData, mediafileId } = usePassageDetailContext();
  useWhyRender('ConsultantCheckReview', { item, playId, rowData, mediafileId });
  const [allMedia, setAllMedia] = useState<MediaFileD[]>([]);
  const [segments, setSegments] = useState('');
  const [selectedLang, setSelectedLang] = useState<string>('');
  const { localizedArtifactType } = useArtifactType();
  const t = useSelector(consultantSelector, shallowEqual);

  const vernacularId = rowData[0]?.mediafile?.id ?? '';
  const artifactType = localizedArtifactType(item);

  const langOptions = useMemo(
    () =>
      item === ArtifactTypeSlug.PhraseBackTranslation
        ? languageOptionsFromRows(rowData, artifactType, vernacularId)
        : [],
    [item, rowData, artifactType, vernacularId]
  );

  useEffect(() => {
    if (langOptions.length === 0) {
      setSelectedLang('');
      return;
    }
    if (!selectedLang || !langOptions.some((o) => o.bcp47 === selectedLang)) {
      setSelectedLang(langOptions[0].bcp47);
    }
  }, [langOptions, selectedLang]);

  const handleSelect = (id: string) => () => {
    if (playId !== id) {
      onPlayer && onPlayer(id);
    } else {
      onPlayer && onPlayer('');
    }
  };

  const sortRows = (i: IRow, j: IRow) => {
    const iSeg = i.mediafile.attributes.sourceSegments;
    const jSeg = j.mediafile.attributes.sourceSegments;
    let iStart = 0;
    let jStart = 1;
    try {
      iStart = parseFloat(JSON.parse(iSeg).start);
      jStart = parseFloat(JSON.parse(jSeg).start);
      return iStart - jStart;
    } catch {
      return mediaFileName(i.mediafile) <= mediaFileName(j.mediafile) ? -1 : 1;
    }
  };

  useEffect(() => {
    if (item === ArtifactTypeSlug.Vernacular) {
      setAllMedia(
        rowData[0]?.mediafile && mediafileId === rowData[0]?.mediafile.id
          ? [rowData[0]?.mediafile]
          : []
      );
      return;
    }

    const mediaId = rowData[0]?.mediafile.id ?? '';
    const media = rowData
      .filter((r) => {
        if (r.artifactType !== artifactType) return false;
        if (related(r.mediafile, 'sourceMedia') !== mediaId) return false;
        if (
          item === ArtifactTypeSlug.PhraseBackTranslation &&
          selectedLang
        ) {
          const bcp = parseStepLanguageField(
            r.mediafile.attributes?.languagebcp47
          ).bcp47;
          if (bcp !== 'und' && bcp !== selectedLang) return false;
          // Untagged legacy only when no language options (single-lang legacy)
          if (bcp === 'und' && langOptions.length > 0) return false;
        }
        return true;
      })
      .sort(sortRows)
      .map((r) => r.mediafile);
    setAllMedia(media);
    onPlayer && onPlayer('');

    if (item === ArtifactTypeSlug.PhraseBackTranslation) {
      const mediaRec =
        rowData[0]?.mediafile &&
        mediafileId === rowData[0]?.mediafile.id &&
        rowData[0]?.mediafile;
      if (mediaRec) {
        const defaultSegments = mediaRec?.attributes?.segments ?? '[]';
        if (selectedLang) {
          const bucket = getSegments(
            phraseBtBoundaryRegionName(selectedLang),
            defaultSegments
          );
          if (hasPhraseRegions(bucket)) {
            setSegments(bucket);
          } else {
            setSegments(
              getSegments(NamedRegions.BackTranslation, defaultSegments)
            );
          }
        } else {
          setSegments(
            getSegments(NamedRegions.BackTranslation, defaultSegments)
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, selectedLang, rowData, mediafileId, artifactType, langOptions.length]);

  const hasTranscription = allMedia.some((m) => m.attributes.transcription);

  return (
    <Stack id="check-review" spacing={1}>
      {item === ArtifactTypeSlug.PhraseBackTranslation &&
        langOptions.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="cc-pbt-lang-label">{t.language}</InputLabel>
            <Select
              labelId="cc-pbt-lang-label"
              label={t.language}
              value={selectedLang}
              onChange={(e) => setSelectedLang(String(e.target.value))}
              data-testid="pbt-language"
            >
              {langOptions.map((o) => (
                <MenuItem key={o.bcp47} value={o.bcp47}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      {allMedia.length === 0 && (
        <Typography data-testid="no-media">{t.noMedia}</Typography>
      )}
      {allMedia.length > 0 && (
        <>
          {[
            ArtifactTypeSlug.PhraseBackTranslation,
            ArtifactTypeSlug.WholeBackTranslation,
          ].includes(item) && (
            <ArtifactStatus
              recordType={item}
              currentVersion={
                (rowData[0] as IRow).mediafile.attributes?.versionNumber
              }
              vernacularMediaId={vernacularId}
              languageBcp47={
                item === ArtifactTypeSlug.PhraseBackTranslation
                  ? selectedLang || undefined
                  : undefined
              }
              rowData={rowData}
              segments={segments}
            />
          )}
          <Table>
            {allMedia.length > 1 && hasTranscription && (
              <TableHead>
                <TableRow>
                  <StyledCell />
                  <StyledCell>{t.transcription}</StyledCell>
                </TableRow>
              </TableHead>
            )}
            <TableBody>
              {allMedia.map((m) => (
                <TableRow key={m.id}>
                  <StyledCell sx={{ width: '40px' }}>
                    <>
                      <IconButton
                        onClick={handleSelect(m.id)}
                        data-testid="play"
                      >
                        {m.id !== playId ? <PlayArrow /> : <CancelPlay />}
                      </IconButton>
                      {item === ArtifactTypeSlug.PhraseBackTranslation &&
                        prettySegment(m.attributes.sourceSegments)}
                    </>
                  </StyledCell>
                  <StyledCell>
                    {hasTranscription && (
                      <Typography
                        data-testid="transcription"
                        sx={{ whiteSpace: 'break-spaces' }}
                      >
                        {m.attributes.transcription ?? t.noTranscription}
                      </Typography>
                    )}
                  </StyledCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Stack>
  );
}
