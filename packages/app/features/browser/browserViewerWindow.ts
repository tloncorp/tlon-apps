import {
  authorizeBrowserViewer,
  trustedBrowserViewerUrl,
} from './browserCredentialHandoff';

/** Reserve the tab during the click, then exchange the owner's proof privately. */
export async function openBrowserViewerWindow(
  viewerUrl: string
): Promise<void> {
  trustedBrowserViewerUrl(viewerUrl);
  const viewer = window.open('about:blank', '_blank');
  if (!viewer) throw new Error('Allow pop-ups to open the browser.');
  viewer.opener = null;
  viewer.document.write(
    '<meta name="referrer" content="no-referrer"><title>Opening browser</title>'
  );
  try {
    const authorized = await authorizeBrowserViewer(viewerUrl);
    if (!viewer.closed) viewer.location.replace(authorized);
  } catch (error) {
    viewer.close();
    throw error;
  }
}
