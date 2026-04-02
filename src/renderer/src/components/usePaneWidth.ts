import { useContext, useEffect, useRef, useState } from 'react';
import { PassageDetailContext } from '../context/PassageDetailContext';
import { debounce } from '@mui/material';

export const usePaneWidth = () => {
  const { discussionSize, discussOpen, setDiscussionSize } =
    useContext(PassageDetailContext).state;
  const [paneWidth, setPaneWidth] = useState(0);
  const [width, setWidth] = useState(window.innerWidth);
  const widthRef = useRef(window.innerWidth);
  const discussionSizeRef = useRef(discussionSize);

  const setDimensions = () => {
    // Always use actual window width - let components adapt to available space
    const newWidth = window.innerWidth;
    setWidth(newWidth);

    let newDiscWidth = discussionSizeRef.current.width;
    if (newDiscWidth > 450) newDiscWidth = 450;
    const newDiscHeight = window.innerHeight - 170;
    if (
      discussionSizeRef.current.height !== newDiscHeight ||
      discussionSizeRef.current.width !== newDiscWidth
    )
      setDiscussionSize({
        width: newDiscWidth, //should we be smarter here?
        height: newDiscHeight,
      });
  };

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    discussionSizeRef.current = discussionSize;
    widthRef.current = width;
    let newPaneWidth = widthRef.current;
    if (discussOpen) {
      newPaneWidth -= discussionSize.width;
    }
    newPaneWidth = Math.max(0, newPaneWidth);
    setPaneWidth(newPaneWidth);
  }, [discussionSize, width, discussOpen]);

  return { paneWidth, width };
};
