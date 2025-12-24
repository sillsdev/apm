import React from 'react';
import { Avatar } from '@mui/material';
import { stringAvatar } from '../../utils';

interface IProps {
  graphicUri?: string;
  reference?: string;
  sectionSeq: number;
  organizedBy: string;
  style?: React.CSSProperties;
  onClick: () => void;
}

export function GraphicAvatar(props: IProps) {
  const { graphicUri, reference, sectionSeq, organizedBy, style, onClick } =
    props;

  const label =
    reference ||
    (organizedBy && sectionSeq !== undefined
      ? `${organizedBy} ${sectionSeq}`
      : '');

  if (graphicUri) {
    return (
      <Avatar
        sx={{ cursor: 'pointer' }}
        src={graphicUri}
        variant="rounded"
        style={style}
        onClick={onClick}
      />
    );
  }
  return (
    <Avatar
      {...stringAvatar(label, { cursor: 'pointer' })}
      variant="rounded"
      style={style}
      onClick={onClick}
    />
  );
}

export default GraphicAvatar;
