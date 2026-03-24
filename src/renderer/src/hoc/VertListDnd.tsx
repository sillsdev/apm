import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
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
  dragHandleRegion?: 'full' | 'top-half';
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
    if (!result.destination) {
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

  const lockTransformToVertical = (style: any) => {
    if (!lockHorizontal || !style?.transform) return style;
    const transform = String(style.transform);
    if (transform.startsWith('translate3d(')) {
      // translate3d(xpx, ypx, zpx) -> lock x to 0px
      style.transform = transform.replace(
        /translate3d\([^,]+,\s*([^,]+),\s*([^\)]+)\)/,
        'translate3d(0px, $1, $2)'
      );
      return style;
    }
    if (transform.startsWith('translate(')) {
      // translate(xpx, ypx) -> lock x to 0px
      style.transform = transform.replace(
        /translate\([^,]+,\s*([^\)]+)\)/,
        'translate(0px, $1)'
      );
      return style;
    }
    return style;
  };

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
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(provided, snapshot) => (
                  <ListItem
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...(dragHandleRegion === 'full'
                      ? provided.dragHandleProps
                      : {})}
                    style={lockTransformToVertical(provided.draggableProps.style)}
                    sx={{
                      position: 'relative',
                      bgcolor: snapshot.isDragging
                        ? 'primary.light'
                        : dragHandle
                          ? 'transparent'
                          : 'lightgrey',
                      mb: itemSpacing,
                      ...(itemPaddingX !== undefined ? { px: itemPaddingX } : {}),
                    }}
                  >
                    {dragHandleRegion === 'top-half' && (
                      <Box
                        {...provided.dragHandleProps}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '50%',
                          zIndex: 1,
                          p: 0,
                          m: 0,
                          bgcolor: 'transparent',
                          cursor: 'grab',
                        }}
                      />
                    )}
                    {item.content}
                  </ListItem>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </List>
        )}
      </Droppable>
    </DragDropContext>
  );
};
