import { authorizeBrowserViewer } from './browserCredentialHandoff';

export type BrowserPreview =
  | {
      status: 'ready';
      image: string;
      title: string;
      hostname: string;
      capturedAt: number;
    }
  | {
      status:
        | 'busy'
        | 'protected'
        | 'ended'
        | 'expired'
        | 'unsupported'
        | 'unavailable';
    };

export async function browserPreviewEndpoint(viewerUrl: string) {
  const authorized = new URL(await authorizeBrowserViewer(viewerUrl));
  authorized.pathname += '/preview';
  authorized.search = '';
  authorized.hash = '';
  return authorized.toString();
}

export async function fetchBrowserPreview(
  endpoint: string,
  signal: AbortSignal
): Promise<BrowserPreview> {
  const response = await fetch(endpoint, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
  });
  if (response.status === 401 || response.status === 403)
    return { status: 'expired' };
  if (response.status === 410) return { status: 'ended' };
  if (
    response.status === 404 &&
    !response.headers.get('content-type')?.includes('application/json')
  )
    return { status: 'unsupported' };
  const body = await response.json();
  if (response.status === 404)
    return {
      status: body.error === 'preview_unsupported' ? 'unsupported' : 'ended',
    };
  if (!response.ok) throw new Error('Browser preview request failed');
  return body as BrowserPreview;
}
