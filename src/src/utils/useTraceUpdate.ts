import { useEffect, useRef } from 'react';

// To print out what props are changing
// usage: useTraceUpdate(props) inside your component
export function useTraceUpdate<T extends Record<string, unknown>>(
  props: T
): void {
  const prev = useRef<T>(props);

  useEffect(() => {
    const changedProps: Partial<
      Record<keyof T, [T[keyof T] | undefined, T[keyof T]]>
    > = {};

    (Object.keys(props) as Array<keyof T>).forEach((k) => {
      if (prev.current[k] !== props[k]) {
        changedProps[k] = [prev.current[k], props[k]];
      }
    });

    if (Object.keys(changedProps).length > 0) {
      // eslint-disable-next-line no-console
      console.log('Changed props:');
      (Object.keys(changedProps) as Array<keyof T>).forEach((key) => {
        // eslint-disable-next-line no-console
        console.log(String(key), changedProps[key]);
      });
    }
    prev.current = props;
  });
}
