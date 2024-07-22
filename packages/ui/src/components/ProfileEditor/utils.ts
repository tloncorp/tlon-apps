import { GridMeasure } from './types';

export const INITIAL_GRID_MEASURE: GridMeasure = {
  x: 0,
  y: 0,
  cellSize: 0,
  borderWidth: 0,
  numRows: 0,
  numCols: 0,
};

export function calculateGridDimensions(
  windowWidth: number,
  windowHeight: number
): Partial<GridMeasure> {
  console.log(`calculating grid dims`, windowWidth, windowHeight);
  const numCols = 6;
  const borderWidth = 2;

  // Calculate the width of each cell, including the border
  const cellWidth = (windowWidth - (numCols + 1) * borderWidth) / numCols;

  // Use the same measurement for cell height
  const cellHeight = cellWidth;

  // Calculate the number of rows that can fit in the windowHeight
  // Each row height is cellHeight plus the top border
  const numRows = Math.floor(
    (windowHeight - borderWidth * 2) / (cellHeight + borderWidth)
  );

  return {
    numCols,
    cellSize: cellWidth, // Assuming square cells, width and height are the same
    numRows,
    borderWidth,
  };
}
