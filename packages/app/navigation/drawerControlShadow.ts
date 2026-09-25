/**
 * The lift the panel's glass controls get — the footer's, which float over
 * the list, and the header's search, which would otherwise be all but
 * invisible: glass over a flat, pale panel has nothing behind it to refract,
 * and only its edge says there is a control there at all.
 *
 * The app's other floating chrome's value, the composer's own, written the way
 * a shadow is written in a native style rather than as a `boxShadow` string.
 * It sits on a wrapper rather than on the glass itself: the glass clips to its
 * bounds, and a view that clips does not cast.
 */
export const DRAWER_CONTROL_SHADOW = {
  // The strength lives in `shadowOpacity`, never in the colour's alpha: on
  // iOS the opacity replaces it rather than multiplying with it, so an alpha
  // written into the colour beside `shadowOpacity: 1` is simply discarded and
  // the shadow comes out full-strength black.
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
} as const;
