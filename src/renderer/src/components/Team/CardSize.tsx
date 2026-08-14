import {
  ReactNode,
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface ICardSizeContext {
  tallest: number;
  reportHeight: (id: string, height: number | null) => void;
}

const CardSizeContext = createContext<ICardSizeContext>({
  tallest: 0,
  reportHeight: () => {},
});

/**
 * Gives every project/add card the same height: the height of the tallest one.
 * Cards report what their content needs and read back the maximum, so cards
 * in different panels stay in step instead of only matching the other cards
 * in their own grid row.
 *
 * The individual heights live in a ref rather than state, so a card revising
 * its measurement only re-renders this subtree when the *maximum* moves.
 */
function CardSizeProvider({ children }: { children: ReactNode }) {
  const heights = useRef(new Map<string, number>());
  const [tallest, setTallest] = useState(0);

  const reportHeight = useCallback((id: string, height: number | null) => {
    if (height === null) {
      if (!heights.current.delete(id)) return;
    } else {
      if (heights.current.get(id) === height) return;
      heights.current.set(id, height);
    }
    setTallest(Math.max(0, ...heights.current.values()));
  }, []);

  const value = useMemo(
    () => ({ tallest, reportHeight }),
    [tallest, reportHeight]
  );

  return (
    <CardSizeContext.Provider value={value}>
      {children}
    </CardSizeContext.Provider>
  );
}

export { CardSizeContext, CardSizeProvider };
