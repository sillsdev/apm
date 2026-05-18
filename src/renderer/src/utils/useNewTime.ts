import { DateTime } from 'luxon';
import { useRef } from 'react';

export default function useNewTime() {
  const created = useRef(DateTime.now().toUTC().toMillis());

  const newTime = () => {
    const current = created.current + 1;
    created.current = current;
    return DateTime.fromMillis(current).toUTC().toISO() as string;
  };

  const setCurrent = () => {
    created.current = DateTime.now().toUTC().toMillis();
  };

  return [newTime, setCurrent] as const;
}

export { useNewTime };
