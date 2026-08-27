import {
  ArtifactCategoryType,
  IArtifactCategory,
  remoteIdNum,
  useArtifactCategory,
  useGraphicCreate,
  useGraphicUpdate,
} from '../../crud';
import { useEffect, useState } from 'react';
import GraphicsIcon from '@mui/icons-material/Image';
import MediaTitle from '../../control/MediaTitle';
import Colorful, { ColorfulProps } from '@uiw/react-color-colorful';
import { useSelector, shallowEqual } from 'react-redux';
import GraphicPicker from '../GraphicPicker';
import { saveGraphicRecord, useGraphicPicker } from '../useGraphicPicker';
import { useGlobal } from '../../context/useGlobal';
import { useOrbitData } from '../../hoc/useOrbitData';
import { GraphicD, ICategoryStrings, ISharedStrings } from '../../model';
import { useSnackBar } from '../../hoc/SnackBar';
import { Avatar, IconButton, styled } from '@mui/material';
import { ColorResult } from '@uiw/color-convert';
import { RecordKeyMap } from '@orbit/records';
import { categorySelector, sharedSelector } from '../../selector';
import { apmGraphic } from '../../components/apmGraphic';
import { Button } from '../../control/Button';
import JSONAPISource from '@orbit/jsonapi';
import { recToMemory } from '../../crud/syncToMemory';

const StyledColorful = styled(Colorful)<ColorfulProps>(() => ({
  '& .w-color-alpha': {
    display: 'none',
  },
  '& .w-color-alpha.w-color-hue': {
    display: 'block',
  },
}));

interface IProps {
  category: IArtifactCategory;
  type: ArtifactCategoryType;
  label?: string;
  helper?: string;
  mediaplan: string;
  teamId?: string;
  onChanged(category: IArtifactCategory): void;
  onDeleted(category: IArtifactCategory): void;
  onRecording(recording: boolean): void;
  disabled: boolean;
}
const RowDiv = styled('div')(() => ({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'left',
}));

export default function CategoryEdit({
  category,
  type,
  label,
  mediaplan,
  teamId,
  helper,
  onChanged,
  onRecording,
  disabled,
}: IProps) {
  const { isDuplicateCategory, localizedArtifactCategory, defaultMediaName } =
    useArtifactCategory(category.org);
  const graphicCreate = useGraphicCreate();
  const graphicUpdate = useGraphicUpdate();
  const [memory] = useGlobal('memory');
  const [coordinator] = useGlobal('coordinator');
  const [offline] = useGlobal('offline');
  const remote = coordinator?.getSource('remote') as JSONAPISource | undefined;
  const [mediafile, setMediafile] = useState('');
  const [helperText, setHelperText] = useState(helper ?? '');
  const [graphicUri, setGraphicUri] = useState('');
  const graphics = useOrbitData<GraphicD[]>('graphic');
  const { showMessage } = useSnackBar();
  const [color, setColor] = useState('');
  const [showColor, setShowColor] = useState(false);
  const [resourceId, setResourceId] = useState(0);
  const [graphicRec, setGraphicRec] = useState<GraphicD>();
  const resourceType = 'category';

  const t: ICategoryStrings = useSelector(categorySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const graphicPicker = useGraphicPicker(async (images, rights) => {
    const rec = await saveGraphicRecord({
      images,
      rights,
      graphicRec,
      resourceType,
      resourceId,
      graphicCreate,
      graphicUpdate,
      showMessage,
      saving: ts.saving,
      uploadSuccess: ts.uploadSuccess,
    });
    if (rec) setGraphicRec(rec);
  });

  const handleTitleChange = (value: string) => {
    value = value.replace(/\|/g, '').trim(); // remove pipe character
    category.category = value;
    onChanged(category);
    isDuplicateCategory(value, type, category.id).then((result) => {
      setHelperText(result ? t.duplicate : (helper ?? ''));
    });
    return '';
  };
  const pointer = { cursor: 'pointer' };
  const handleMediaChange = (value: string) => {
    setMediafile(value);
    category.titleMediaId = value;
    onChanged(category);
  };

  useEffect(() => {
    const remoteId = remoteIdNum(
      'artifactcategory',
      category.id,
      memory?.keyMap as RecordKeyMap
    );
    setColor(category.color);
    setMediafile(category.titleMediaId ?? '');
    if (!isNaN(remoteId)) {
      setResourceId(remoteId);
      const rec = graphics.find(
        (g) =>
          g.attributes.resourceType === resourceType &&
          g.attributes.resourceId === remoteId
      ) as GraphicD;
      if (graphicRec?.id !== rec?.id) setGraphicRec(rec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, graphics]);

  useEffect(() => {
    if (graphicRec) {
      const gr = apmGraphic(graphicRec);
      setGraphicUri(gr?.graphicUri ?? '');
    }
  }, [graphicRec]);

  const handleColor = (color: ColorResult) => {
    category.color = color.hex;
    setColor(color.hex);
    onChanged(category);
  };
  const handleUpload = () => {
    const gr = graphicRec ? apmGraphic(graphicRec) : undefined;
    graphicPicker.open({
      url: gr?.url ?? '',
      rights: gr?.graphicRights ?? '',
    });
    if (!graphicRec || !remote || offline) return;
    recToMemory({ recId: graphicRec, memory, remote })
      .then((fresh) => {
        const rec = fresh as GraphicD;
        setGraphicRec(rec);
        const g = apmGraphic(rec);
        graphicPicker.setCurrentUrl(g?.url ?? '');
        graphicPicker.setCurrentRights(g?.graphicRights ?? '');
      })
      .catch(() => {
        /* keep cached graphic */
      });
  };
  return (
    <RowDiv>
      <MediaTitle
        titlekey={category.id ?? 'newcat'}
        label={label ?? ''}
        mediaId={mediafile}
        title={localizedArtifactCategory(category.category)}
        onTextChange={handleTitleChange}
        defaultFilename={defaultMediaName(resourceId.toString() + 'title')}
        onRecording={
          type === ArtifactCategoryType.Note ? onRecording : undefined
        }
        useplan={mediaplan}
        onMediaIdChange={(mediaId: string) => handleMediaChange(mediaId)}
        disabled={disabled}
        helper={helperText}
      />
      {type === ArtifactCategoryType.Note && (
        <>
          <Button
            sx={{
              width: showColor ? '60px' : '30px',
              height: '30px',
              minWidth: '30px',
              minHeight: '30px',
              borderRadius: showColor ? '' : '50%',
              margin: '5px',
            }}
            style={{ backgroundColor: color }}
            variant="contained"
            onClick={() => setShowColor(!showColor)}
          >
            {showColor ? t.close : ''}
          </Button>
          {showColor && (
            <StyledColorful
              id="colorful"
              color={color}
              onChange={(color) => {
                handleColor(color);
              }}
            />
          )}
          {category.id !== 'newcat' &&
            (graphicUri !== '' ? (
              <Avatar
                sx={pointer}
                src={graphicUri}
                variant="rounded"
                onClick={handleUpload}
              />
            ) : (
              <IconButton id="cat-graphic" sx={pointer} onClick={handleUpload}>
                <GraphicsIcon />
              </IconButton>
            ))}
          {category.id !== 'newcat' && (
            <GraphicPicker
              scripture={false}
              teamId={teamId}
              isOpen={graphicPicker.isOpen}
              onOpen={graphicPicker.onOpen}
              cancelled={graphicPicker.cancelled}
              showMessage={graphicPicker.showMessage}
              dimension={graphicPicker.dimension}
              defaultFilename={defaultMediaName(resourceId.toString())}
              finish={graphicPicker.finish}
              onSelectedRights={graphicPicker.onSelectedRights}
              currentUrl={graphicPicker.currentUrl}
              currentRights={graphicPicker.currentRights}
            />
          )}
        </>
      )}
    </RowDiv>
  );
}
