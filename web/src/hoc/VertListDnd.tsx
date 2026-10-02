import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box, List, ListItem } from '@mui/material';

export interface DropProp {
  id: string;
  content: ReactNode;
}

// convert children to ItemProps
const cvtChildren = (children?: ReactNode): DropProp[] | undefined => {
  if (Array.isArray(children)) {
    return children.map((child, index) => ({
      id: `${index}`,
      content: child,
    }));
  }
  if (children) {
    return [{ id: '0', content: children }];
  }
};

export interface OnDropProps {
  results: string[];
  oldIndex: number;
  newIndex: number;
}

export interface VertListDndProps extends PropsWithChildren {
  data?: DropProp[];
  dragHandle?: boolean;
  lockHorizontal?: boolean;
  /**
   * `full` — entire row initiates drag (blocks e.g. MUI Slider inside the row).
   * `top-half` — narrow leading gutter initiates drag so titles, checkboxes, and
   * sliders on resource cards remain usable (used by mobile passage artifacts).
   */
  dragHandleRegion?: 'full' | 'top-half';
  /** When true, items cannot be dragged (TT-6618). */
  isDragDisabled?: boolean;
  itemSpacing?: number;
  listPaddingX?: number;
  itemPaddingX?: number;
  onDrop?: (props: OnDropProps) => void;
}

export const VertListDnd = ({
  data,
  onDrop,
  dragHandle,
  lockHorizontal,
  dragHandleRegion = 'full',
  isDragDisabled = false,
  itemSpacing = 1,
  listPaddingX,
  itemPaddingX,
  children,
}: VertListDndProps) => {
  const [items, setItems] = useState<DropProp[]>(
    data ?? cvtChildren(children) ?? []
  );

  useEffect(() => {
    setItems(data ?? cvtChildren(children) ?? []);
  }, [data, children]);

  // a little function to help us with reordering the result
  const reorder = (list: DropProp[], startIndex: number, endIndex: number) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  const onDragEnd = (result: DropResult) => {
    // dropped outside the list
    if (isDragDisabled || !result.destination) {
      return;
    }
    const newItems = reorder(
      items,
      result.source.index,
      result.destination.index
    );
    setItems(newItems);
    if (onDrop) {
      onDrop({
        results: newItems.map((item) => item.id),
        oldIndex: result.source.index,
        newIndex: result.destination.index,
      });
    }
  };

  // style is mutated, watch for side effects
  const lockTransformToVertical = (style: any) => {
    if (!lockHorizontal || !style?.transform) return style;
    const transform = String(style.transform);
    if (transform.startsWith('translate3d(')) {
      // translate3d(xpx, ypx, zpx) -> lock x to 0px
      style.transform = transform.replace(
        /translate3d\([^,]+,\s*([^,]+),\s*([^)]+)\)/,
        'translate3d(0px, $1, $2)'
      );
      return style;
    }
    if (transform.startsWith('translate(')) {
      // translate(xpx, ypx) -> lock x to 0px
      style.transform = transform.replace(
        /translate\([^,]+,\s*([^)]+)\)/,
        'translate(0px, $1)'
      );
      return style;
    }
    return style;
  };

  const useLeadingDragGutter = dragHandleRegion === 'top-half';

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="droppable">
        {(provided, snapshot) => (
          <List
            {...provided.droppableProps}
            ref={provided.innerRef}
            sx={{
              bgcolor: snapshot.isDraggingOver ? 'secondary.light' : 'white',
              py: 1,
              px: listPaddingX ?? 1,
            }}
          >
            {items.map((item, index) => (
              <Draggable
                key={item.id}
                draggableId={item.id}
                index={index}
                isDragDisabled={isDragDisabled}
              >
                {(provided, snapshot) => {
                  const handleProps =
                    !isDragDisabled &&
                    dragHandleRegion === 'full' &&
                    provided.dragHandleProps
                      ? provided.dragHandleProps
                      : {};
                  const gutterProps =
                    !isDragDisabled &&
                    useLeadingDragGutter &&
                    provided.dragHandleProps
                      ? provided.dragHandleProps
                      : {};

                  return (
                    <ListItem
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...handleProps}
                      style={lockTransformToVertical(
                        provided.draggableProps.style
                      )}
                      sx={{
                        position: 'relative',
                        bgcolor: snapshot.isDragging
                          ? 'primary.light'
                          : dragHandle
                            ? 'transparent'
                            : 'lightgrey',
                        mb: itemSpacing,
                        ...(itemPaddingX !== undefined
                          ? { px: itemPaddingX }
                          : {}),
                        ...(useLeadingDragGutter
                          ? {
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'stretch',
                              gap: 0.5,
                            }
                          : {}),
                      }}
                    >
                      {useLeadingDragGutter && !isDragDisabled ? (
                        <>
                          <Box
                            data-cy="vert-list-dnd-drag-handle"
                            {...gutterProps}
                            sx={{
                              flex: '0 0 auto',
                              width: 40,
                              minWidth: 40,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              alignSelf: 'stretch',
                              cursor: 'grab',
                              color: 'text.secondary',
                              my: -0.5,
                            }}
                          >
                            <DragIndicatorIcon
                              sx={{ fontSize: '1.25rem' }}
                              aria-hidden
                            />
                          </Box>
                          <Box
                            sx={{
                              flex: '1 1 auto',
                              minWidth: 0,
                              alignSelf: 'stretch',
                            }}
                          >
                            {item.content}
                          </Box>
                        </>
                      ) : (
                        item.content
                      )}
                    </ListItem>
                  );
                }}
              </Draggable>
            ))}
            {provided.placeholder}
          </List>
        )}
      </Droppable>
    </DragDropContext>
  );
};
