import { formatTime } from './formatTime';

interface IProps {
  direction?: string;
  id?: string;
  seconds: number;
}

export function Duration(props: IProps) {
  const { direction, id, seconds } = props;

  return (
    <time id={id} dateTime={`P${Math.ceil(seconds)}S`}>
      {formatTime(seconds, direction)}
    </time>
  );
}

export default Duration;
