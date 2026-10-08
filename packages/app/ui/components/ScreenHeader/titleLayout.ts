import { type ScreenHeaderAction, visibleScreenHeaderActions } from './actions';

const edgeMargin = 16;
// Between neighbouring buttons, and between the buttons and the title. UIKit
// stops centering a title that comes closer than this to a button platter
// (measured on iOS 26); the Android buttons carry it as padding.
const gap = 12;

/** Reserve both sides of a centered native title, including the gap to buttons. */
export function getNativeTitleMaxWidth({
  width,
  fontScale,
  platform,
  left,
  right,
}: {
  width: number;
  fontScale: number;
  platform: string;
  left: ScreenHeaderAction[];
  right: ScreenHeaderAction[];
}) {
  // UIKit owns the iOS controls, so their widths are not in the React layout.
  // Android draws the smaller React buttons inside its toolbar.
  const iconWidth = platform === 'ios' ? 44 : 32;
  const sideWidth = (actions: ScreenHeaderAction[]) => {
    const visible = visibleScreenHeaderActions(actions);
    // Allow a full em per character for text actions, plus their padding.
    const buttonsWidth = visible.reduce(
      (total, action) =>
        total +
        ('text' in action
          ? Math.max(
              iconWidth,
              Array.from(action.text).length * 17 * fontScale + 16
            )
          : iconWidth),
      0
    );
    return (
      edgeMargin + buttonsWidth + Math.max(0, visible.length - 1) * gap + gap
    );
  };

  // Neither platform clips a title too wide to center: UIKit draws it from the
  // leading edge and the Android toolbar slides it toward the free side. With
  // no leading buttons, as on a tab root, a centered cap would only clip a
  // title that has the room to run up to the trailing buttons.
  if (!visibleScreenHeaderActions(left).length) {
    return Math.max(0, width - edgeMargin - sideWidth(right));
  }

  return Math.max(0, width - 2 * Math.max(sideWidth(left), sideWidth(right)));
}
