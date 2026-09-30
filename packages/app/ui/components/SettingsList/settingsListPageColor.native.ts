/**
 * The page color behind a settings list. Native lists put their grouped rows
 * on the primary background, over a page in the secondary one, the way Tlon's
 * cards sit on a tinted page. Screens hosting a list use it for their header
 * too, so an opaque header doesn't show as a band.
 */
export const settingsListPageColor = '$secondaryBackground' as const;
