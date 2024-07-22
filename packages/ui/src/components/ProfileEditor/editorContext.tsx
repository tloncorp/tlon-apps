import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';

import { GridMeasure } from './types';
import { INITIAL_GRID_MEASURE } from './utils';

// Define the shape of the context data
interface EditorContextType {
  grid: GridMeasure;
  updateGrid: (grid: Partial<GridMeasure>) => void;
}

// Create the context
const EditorContext = createContext<EditorContextType | undefined>(undefined);

// Provider component
export const EditorContextProvider = ({ children }: PropsWithChildren) => {
  const [grid, setGrid] = useState<GridMeasure>(INITIAL_GRID_MEASURE);

  const updateGrid = useCallback(
    (gridUpdate: Partial<GridMeasure>) => {
      setGrid({ ...grid, ...gridUpdate });
    },
    [grid, setGrid]
  );

  return (
    <EditorContext.Provider value={{ grid, updateGrid }}>
      {children}
    </EditorContext.Provider>
  );
};

// Custom hook for using context
export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditorContext must be used within an AppProvider');
  }
  return context;
};
