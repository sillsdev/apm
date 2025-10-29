import { useEffect, useRef } from 'react';

/**
 * Helps tracking the props changes made in a react functional component.
 *
 * Prints the name of the properties/states variables causing a render (or re-render).
 * For debugging purposes only.
 *
 * @usage You can simply track the props of the components like this:
 *  useRenderingTrace('MyComponent', props);
 *
 * @usage You can also track additional state like this:
 *  const [someState] = useState(null);
 *  useRenderingTrace('MyComponent', { ...props, someState });
 *
 * @param componentName Name of the component to display
 * @param propsAndStates
 * @param level
 *
 * @see https://stackoverflow.com/a/51082563/2391795
 */
function useRenderingTrace<
  T extends Record<string, unknown>,
  L extends 'debug' | 'info' | 'log' = 'debug',
>(componentName: string, propsAndStates: T, level: L = 'debug' as L): void {
  const prev = useRef<T>(propsAndStates);

  useEffect(() => {
    type Diff = { [K in keyof T]?: { old: T[K] | undefined; new: T[K] } };
    const changedProps = (
      Object.entries(propsAndStates) as Array<[keyof T, T[keyof T]]>
    ).reduce<Diff>((acc, [key, value]) => {
      if (prev.current[key] !== value) {
        acc[key] = { old: prev.current[key], new: value };
      }
      return acc;
    }, {});
    console.log('changedProps', componentName, changedProps);
    if (Object.keys(changedProps).length > 0) {
      // eslint-disable-next-line no-console
      console[level](`[${componentName}] Changed props:`, changedProps);
    } else {
      // eslint-disable-next-line no-console
      console[level](`[${componentName}] no changed props:`);
    }

    prev.current = propsAndStates;
  });
}

export default useRenderingTrace;
