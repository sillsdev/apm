import { Box, BoxProps, Chip, styled } from '@mui/material';
import { MediaFile, MediaFileD } from '../model';
import { findRecord, related } from '../crud';
import { dateOrTime, prettySegment } from '../utils';
import { useGlobal } from '../context/useGlobal';

// see: https://mui.com/material-ui/customization/how-to-customize/
interface StyledBoxProps extends BoxProps {
  col?: boolean;
}
const StyledBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'col',
})<StyledBoxProps>(({ col, theme }) => ({
  ...(col
    ? {
        paddingLeft: theme.spacing(2),
      }
    : {
        paddingLeft: theme.spacing(2),
        display: 'flex',
        flexDirection: 'row',
      }),
}));

const PerformedBy = ({ mediafile }: { mediafile?: MediaFile }) => {
  const speaker = mediafile?.attributes?.performedBy;
  return speaker ? (
    <span>
      {speaker}:{'\u00A0'}
    </span>
  ) : (
    <></>
  );
};

export const Segments = ({ mediafile }: { mediafile?: MediaFile }) => {
  const [memory] = useGlobal('memory');

  let version = '';
  const relatedMedia = related(mediafile, 'sourceMedia');
  if (relatedMedia) {
    const s = findRecord(memory, 'mediafile', relatedMedia) as MediaFileD;
    version = s.attributes?.versionNumber?.toString();
  }

  return (
    <span>
      {prettySegment(mediafile?.attributes?.sourceSegments || '')}
      {'\u00A0'}
      {version && <Chip label={version} size="small" />}
      {'\u00A0'}
    </span>
  );
};

const Created = ({
  mediafile,
  lang,
}: {
  mediafile?: MediaFile;
  lang: string;
}) => {
  const date = mediafile?.attributes?.dateCreated;

  return date ? <span>({dateOrTime(date, lang)})</span> : <></>;
};

export const ItemDescription = ({
  mediafile,
  col,
}: {
  mediafile?: MediaFile;
  col?: boolean;
}) => {
  const [locale] = useGlobal('lang');

  return (
    <StyledBox col={col} className="item-desc">
      <PerformedBy mediafile={mediafile} />
      <Segments mediafile={mediafile} />
      <Created mediafile={mediafile} lang={locale} />
    </StyledBox>
  );
};
