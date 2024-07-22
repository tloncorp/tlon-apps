import { ComponentProps, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, View as RNView } from 'react-native';

import { ZStack } from '../../core';
import GridDisplay from './GridDisplay';
import WidgetArena from './WidgetArena';
import { useEditorContext } from './editorContext';
import { INITIAL_GRID_MEASURE, calculateGridDimensions } from './utils';

export function WidgetGrid() {
  const gridRef = useRef<RNView | null>(null);
  const { grid, updateGrid } = useEditorContext();

  const onAppLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const gridDimensions = calculateGridDimensions(width, height);
    updateGrid({ ...gridDimensions });
  };

  const onGridLayout = () => {
    if (gridRef.current) {
      gridRef.current.measure((x, y) => {
        updateGrid({
          x,
          y,
        });
      });
    }
  };

  const gridIsInitialized = useMemo(
    () => grid?.numCols && grid?.numRows,
    [grid]
  );

  return (
    <WidgetGridContainer onLayout={onAppLayout}>
      <GridDisplay
        ref={gridRef}
        grid={grid ?? INITIAL_GRID_MEASURE}
        loading={!gridIsInitialized}
        onLayout={onGridLayout}
      />
      {gridIsInitialized ? <WidgetArena grid={grid} /> : <></>}
    </WidgetGridContainer>
  );
}

function WidgetGridContainer(props: ComponentProps<typeof ZStack>) {
  return (
    <ZStack flex={1} {...props}>
      {props.children}
    </ZStack>
  );
}
