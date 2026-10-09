import { createContext, useContext, useEffect } from 'react';

type SheetCover = {
  height: number;
  /** Tells the sheet that a caller insets its own content. Returns a release. */
  claim: () => () => void;
};

const noClaim = () => () => {};

export const SheetCoverContext = createContext<SheetCover>({
  height: 0,
  claim: noClaim,
});

/**
 * How much of the bottom of a sheet's content is hidden behind the sheet's
 * footer and the keyboard. It is 0 everywhere but an Android fixed-height
 * sheet, where the content keeps its size and the keyboard slides over it.
 *
 * A list should add this to the bottom padding of its content. Its rows then
 * stay where they are under the keyboard, and it can still scroll to its end.
 * Once anything in a sheet calls this, the sheet stops padding the content
 * itself.
 */
export function useSheetCoveredHeight() {
  const { height, claim } = useContext(SheetCoverContext);
  useEffect(() => claim(), [claim]);
  return height;
}
