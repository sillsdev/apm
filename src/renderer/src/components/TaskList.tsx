import { useState, useEffect, useRef, CSSProperties, useContext } from 'react';
import { useGlobal } from '../context/useGlobal';
import { Box, List, ListItemText, ListItem } from '@mui/material';
import useTodo from '../context/useTodo';
import { usePlan } from '../crud';
import usePassageDetailContext from '../context/usePassageDetailContext';
import Duration from '../control/Duration';
import TaskFlag from './TaskFlag';
import { Segments } from '../control/MediaDescription';
import { UnsavedContext } from '../context/UnsavedContext';
import { PlayInPlayer } from '../context/PlayInPlayer';

export const TaskTableWidth = 200;

export function TaskList() {
  const { rowData, activityStateStr, allDone, refresh, setAllDone } = useTodo();
  const { loading, pdBusy, discussionSize, playerMediafile, setSelected } =
    usePassageDetailContext();
  const uctx = useContext(UnsavedContext);
  const { checkSavedFn } = uctx.state;
  const { getPlan } = usePlan();
  const [planId] = useGlobal('plan'); //will be constant here
  const isInline = useRef(false);

  const heightAdjust = -60;
  const widthAdjust = -10;
  const [style, setStyle] = useState<CSSProperties>({
    width: TaskTableWidth + widthAdjust,
    height: discussionSize.height + heightAdjust,
    overflowY: 'auto',
    cursor: 'default',
  });
  const formRef = useRef<any>(undefined);
  const selectedRef = useRef<any>(undefined);
  const notSelectedRef = useRef<any>(undefined);
  const busyRef = useRef(false);

  const handleSelect = (select: string) => () => {
    //if we're all done, we can't need to save
    if (allDone && select === playerMediafile?.id) {
      setAllDone(false);
    } else
      checkSavedFn(() => {
        if (select !== playerMediafile?.id)
          setSelected(select, PlayInPlayer.yes);
        else refresh();
      });
  };

  useEffect(() => {
    busyRef.current = pdBusy || loading;
    setStyle((style) => ({
      ...style,
      width: TaskTableWidth + widthAdjust,
      height: discussionSize.height + heightAdjust,
      cursor: busyRef.current ? 'progress' : 'default',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdBusy, loading, discussionSize]);

  useEffect(() => {
    if (formRef.current && selectedRef.current) {
      formRef.current.scrollTo(0, selectedRef.current.offsetTop);
    }
  });

  useEffect(() => {
    const planRec = getPlan(planId);
    isInline.current = Boolean(planRec?.attributes?.flat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const selBacking: CSSProperties = { background: 'lightgrey' };
  const noSelBacking: CSSProperties = { background: 'transparent' };

  return (
    <Box id="TaskList" ref={formRef} style={style} data-list={'true'}>
      <List>
        {rowData
          .filter((r) => Boolean(r.passage?.id))
          .map((r) => (
            <ListItem
              key={r.mediafile.id}
              ref={
                r.mediafile.id === playerMediafile?.id
                  ? selectedRef
                  : notSelectedRef
              }
              onClick={handleSelect(r.mediafile.id)}
              sx={
                r.mediafile.id === playerMediafile?.id
                  ? selBacking
                  : noSelBacking
              }
            >
              <ListItemText
                primary={
                  <span>
                    <Segments mediafile={r.mediafile} /> (
                    <Duration seconds={r.mediafile.attributes?.duration} />)
                  </span>
                }
                secondary={
                  <TaskFlag
                    ta={activityStateStr}
                    state={r.mediafile.attributes?.transcriptionstate}
                  />
                }
              />
            </ListItem>
          ))}
      </List>
    </Box>
  );
}

export default TaskList;
