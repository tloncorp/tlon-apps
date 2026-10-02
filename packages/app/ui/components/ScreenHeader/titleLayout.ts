import { type ScreenHeaderAction, visibleScreenHeaderActions } from './actions';

/** Reserve both sides of a centered native title, including the gap to buttons. */
export function getNativeTitleMaxWidth({
  width,
  fontScale,
  left,
  right,
}: {
  width: number;
  fontScale: number;
  left: ScreenHeaderAction[];
  right: ScreenHeaderAction[];
}) {
  const sideWidth = (actions: ScreenHeaderAction[]) => {
    const visible = visibleScreenHeaderActions(actions);
    // UIKit owns these controls, so their widths are not in the React layout.
    // Allow a full em per character for text actions, plus their padding.
    const buttonsWidth = visible.reduce(
      (total, action) =>
        total +
        ('text' in action
          ? Math.max(44, Array.from(action.text).length * 17 * fontScale + 16)
          : 44),
      0
    );
    return 16 + buttonsWidth + Math.max(0, visible.length - 1) * 8 + 8;
  };

  return Math.max(0, width - 2 * Math.max(sideWidth(left), sideWidth(right)));
}
