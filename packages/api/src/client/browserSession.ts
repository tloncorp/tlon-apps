const VIEWER_LABEL = 'browser-session-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const VIEWER_HOST = new RegExp(
  `^(?:${VIEWER_LABEL}|browser-session|session-viewer)\\.(?:tlon\\.network|test\\.tlon\\.systems)$`
);

export function isTrustedBrowserViewerHost(hostname: string): boolean {
  return VIEWER_HOST.test(hostname);
}
