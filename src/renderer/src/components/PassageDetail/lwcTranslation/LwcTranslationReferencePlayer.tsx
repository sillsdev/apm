import ClauseAudioPlayer from '../boldClause/ClauseAudioPlayer';

interface Props {
  width: number;
  referenceMediaId: string | undefined;
  playKey: number;
  onPlaybackComplete: () => void;
  onPlayStatus?: (playing: boolean) => void;
}

export default function LwcTranslationReferencePlayer({
  referenceMediaId,
  ...rest
}: Props) {
  return (
    <ClauseAudioPlayer
      {...rest}
      mediaId={referenceMediaId}
      playerId="lwc-reference-player"
      dataCy="lwc-reference-player"
      waitLabel="lwc reference media url"
    />
  );
}
