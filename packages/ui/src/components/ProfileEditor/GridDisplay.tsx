import React, { Ref } from 'react';
import { View as RNView } from 'react-native';

import { Square, Stack, XStack, YStack } from '../../core';
import { LoadingSpinner } from '../LoadingSpinner';
import { GridMeasure } from './types';

interface GridDisplayProps {
  grid: GridMeasure;
  loading: boolean;
  onLayout: (event: any) => void;
}

const GridDisplay = React.forwardRef(function GridDisplayComponent(
  { grid, loading, onLayout }: GridDisplayProps,
  ref: Ref<RNView>
) {
  if (loading) {
    return (
      <Stack flex={1}>
        <LoadingSpinner />
      </Stack>
    );
  }

  console.log(`grid display`, grid);

  const rows = new Array(grid.numRows ?? 1).fill(null);
  const columns = new Array(grid.numCols ?? 1).fill(null);

  return (
    <Stack alignItems="center">
      <RNView ref={ref} onLayout={onLayout}>
        <YStack>
          {rows.map((_, i) => (
            <XStack key={i}>
              {columns.map((_, j) => (
                <Square
                  key={j}
                  size={grid.cellSize}
                  backgroundColor="$secondaryBackground"
                  borderColor="$border"
                  borderLeftWidth={j == 0 ? 2 : 0}
                  borderTopWidth={i === 0 ? 2 : 0}
                  borderRightWidth={2}
                  borderBottomWidth={2}
                />
              ))}
            </XStack>
          ))}
        </YStack>
      </RNView>
    </Stack>
  );
});

export default GridDisplay;
