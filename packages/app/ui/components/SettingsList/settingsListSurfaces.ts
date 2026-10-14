/**
 * The colors a settings list sits on. Web keeps its bordered cards on the
 * primary background; the native lists group theirs (see the `.native` file).
 */
export function useSettingsListSurfaces() {
  return { page: '$background', card: '$background' } as const;
}

/** Web headers sit inline over the page, in its color. */
export function useSettingsListHeaderColor() {
  return useSettingsListSurfaces().page;
}
