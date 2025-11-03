import {
  ArtifactCategoryType,
  IArtifactCategory,
  remoteIdNum,
  useArtifactCategory,
  useGraphicCreate,
  useGraphicUpdate,
} from '../../crud';
import { useEffect, useRef, useState } from 'react';
import GraphicsIcon from '@mui/icons-material/Image';
import MediaTitle from '../../control/MediaTitle';
import Colorful, { ColorfulProps } from '@uiw/react-color-colorful';
import { useSelector, shallowEqual } from 'react-redux';
import {
  ApmDim,
  CompressedImages,
  GraphicUploader,
  IGraphicInfo,
  Rights,
} from '../GraphicUploader';
import GraphicRights from '../GraphicRights';
import { useGlobal } from '../../context/useGlobal';
import { useOrbitData } from '../../hoc/useOrbitData';
import { GraphicD, ICategoryStrings, ISharedStrings } from '../../model';
import { UploadType } from '../UploadType';
import { useSnackBar } from '../../hoc/SnackBar';
import { Avatar, Button, IconButton, styled } from '@mui/material';
import { ColorResult } from '@uiw/color-convert';
import { RecordKeyMap } from '@orbit/records';
import { categorySelector, sharedSelector } from '../../selector';
import { apmGraphic } from '../../components/apmGraphic';

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
  const [mediafile, setMediafile] = useState('');
  const [helperText, setHelperText] = useState(helper ?? '');
  const [graphicRights, setGraphicRights] = useState('');
  const [graphicUri, setGraphicUri] = useState('');
  const [graphicFullsizeUrl, setGraphicFullsizeUrl] = useState('');
  const graphics = useOrbitData<GraphicD[]>('graphic');
  const [uploadGraphicVisible, setUploadGraphicVisible] = useState(false);
  const cancelled = useRef(false);
  const { showMessage } = useSnackBar();
  const [color, setColor] = useState('');
  const [showColor, setShowColor] = useState(false);
  const [resourceId, setResourceId] = useState(0);
  const [graphicRec, setGraphicRec] = useState<GraphicD>();
  const resourceType = 'category';

  const t: ICategoryStrings = useSelector(categorySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

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
  const handleUploadGraphicVisible = (visible: boolean) => {
    if (!visible && !cancelled.current) {
      afterConvert([]).then(() => {
        setUploadGraphicVisible(false);
        showMessage(ts.saving);
      });
    } else {
      setUploadGraphicVisible(visible);
    }
    // Reset graphicFullsizeUrl to match graphicRec when dialog opens or closes
    if (graphicRec) {
      const gr = apmGraphic(graphicRec);
      setGraphicFullsizeUrl(gr?.url ?? '');
    } else {
      setGraphicFullsizeUrl('');
    }
  };

  const handleRightsChange = (value: string) => {
    setGraphicRights(value);
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
      setGraphicRights(gr?.graphicRights ?? '');
      setGraphicUri(gr?.graphicUri ?? '');
      setGraphicFullsizeUrl(gr?.url ?? '');
    }
  }, [graphicRec]);

  const afterConvert = async (images: CompressedImages[]) => {
    if (images.length == 0) return;

    const curData = JSON.parse(
      graphicRec?.attributes?.info || '{}'
    ) as IGraphicInfo;
    const infoData: IGraphicInfo = { ...curData, [Rights]: graphicRights };

    images.forEach((image) => {
      infoData[image.dimension.toString()] = image;
    });
    const info = JSON.stringify(infoData);
    if (graphicRec) {
      const upd = {
        ...graphicRec,
        attributes: { ...graphicRec.attributes, info },
      };
      const newrec = (await graphicUpdate(upd)) as GraphicD;
      setGraphicRec(newrec);
    } else if (images.length > 0) {
      setGraphicRec(
        await graphicCreate({
          resourceType,
          resourceId,
          info,
        })
      );
    }
    showMessage(ts.uploadSuccess);
  };
  const handleColor = (color: ColorResult) => {
    category.color = color.hex;
    setColor(color.hex);
    onChanged(category);
  };
  const handleUpload = () => {
    cancelled.current = false;
    handleUploadGraphicVisible(true);
  };
  const onFiles = (files: File[]) => {
    if (files.length > 0) {
      setGraphicFullsizeUrl(URL.createObjectURL(files[0] as File));
    } else setGraphicFullsizeUrl('');
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
              <IconButton sx={pointer} onClick={handleUpload}>
                <GraphicsIcon />
              </IconButton>
            ))}
          {uploadGraphicVisible && (
            <GraphicUploader
              dimension={[1024, 512, ApmDim]}
              defaultFilename={defaultMediaName(resourceId.toString())}
              isOpen={uploadGraphicVisible}
              onOpen={handleUploadGraphicVisible}
              showMessage={showMessage}
              hasRights={Boolean(graphicRights)}
              finish={afterConvert}
              cancelled={cancelled}
              uploadType={UploadType.Graphic}
              onFiles={onFiles}
              metadata={
                <>
                  <GraphicRights
                    value={graphicRights ?? ''}
                    teamId={teamId}
                    onChange={handleRightsChange}
                  />
                  {graphicFullsizeUrl && (
                    <img
                      key={graphicFullsizeUrl}
                      src={`${graphicFullsizeUrl}${graphicFullsizeUrl.includes('?') ? '&' : '?'}t=${Date.now()}`}
                      alt="new"
                      width={400}
                    />
                  )}
                </>
              }
            />
          )}
        </>
      )}
    </RowDiv>
  );
}
