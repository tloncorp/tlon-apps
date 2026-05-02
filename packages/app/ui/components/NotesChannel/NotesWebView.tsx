import { AppWebView } from '../AppWebView';

interface NotesWebViewProps {
  // Required on native (the WebView needs an absolute URL); on web we use the
  // current origin since the Tlon web app is served by the same ship.
  shipUrl?: string;
  notebookFlag?: string;
  hideHeader?: boolean;
}

function buildQuery({ notebookFlag, hideHeader }: NotesWebViewProps) {
  const params = new URLSearchParams();
  if (notebookFlag) params.set('notebook', notebookFlag);
  if (hideHeader) params.set('embed', '1');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function NotesWebView(props: NotesWebViewProps) {
  const path = `/notes/${buildQuery(props)}`;
  const cacheKey = `notes:${props.notebookFlag ?? '__none__'}`;
  return (
    <AppWebView shipUrl={props.shipUrl} path={path} cacheKey={cacheKey} />
  );
}
