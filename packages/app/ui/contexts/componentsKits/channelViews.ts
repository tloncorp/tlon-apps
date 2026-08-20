/**
 * Channel views: the open half of the components-kit registry.
 *
 * A channel declares which renderers it wants through its
 * `contentConfiguration` (see `docs/tlon-apps/channel-views.md`). Those ids are
 * untrusted strings that may name a view this build has never registered — a
 * channel authored by a newer client, or by a kit whose view ships in a later
 * release. So resolution has to report *why* it produced a component, not just
 * which one, or the render sites cannot tell "nothing was asked for" apart from
 * "something we don't have was asked for" and every unknown view degrades
 * silently.
 */
import { IPostCollectionView } from '../../components/postCollectionViews/types';
import { DraftInputRendererComponent, RenderItemType } from './componentsKits';

/**
 * One registered view. A view may supply any subset of the three slots; a
 * channel that names the same view id in several `contentConfiguration` fields
 * resolves each from this one entry, so a custom surface is declared under one
 * name rather than three.
 */
export interface ChannelView {
  id: string;
  displayName: string;
  collection?: IPostCollectionView;
  content?: RenderItemType;
  input?: DraftInputRendererComponent;
}

export interface ChannelViewResolution<T> {
  /** The component to render. Null only when no fallback was offered. */
  component: T | null;

  /**
   * False only when a view was declared and nothing has registered it — the
   * one case that warrants the fallback notice. Absent declarations resolve
   * true, because falling back to the channel-type default is the intended
   * path, not a degradation.
   */
  resolved: boolean;

  /** The declared id, when there was one. For the notice copy and analytics. */
  declaredId: string | null;
}

export function resolveChannelView<T>({
  declaredId,
  registry,
  fallback,
}: {
  declaredId: string | null | undefined;
  registry: Readonly<Record<string, T | undefined>>;
  fallback?: T | null;
}): ChannelViewResolution<T> {
  if (declaredId == null || declaredId === '') {
    return { component: fallback ?? null, resolved: true, declaredId: null };
  }

  const registered = registry[declaredId];
  if (registered != null) {
    return { component: registered, resolved: true, declaredId };
  }

  return { component: fallback ?? null, resolved: false, declaredId };
}

/**
 * Fold registered views into the three id-keyed maps the context exposes.
 *
 * Built-ins win on collision: a registered view must not be able to replace
 * `chat` and take the composer out from under every conversation in the app.
 */
export function mergeChannelViews<T>({
  builtins,
  views,
  slot,
  onCollision,
}: {
  builtins: Readonly<Record<string, T>>;
  views: readonly ChannelView[];
  slot: (view: ChannelView) => T | undefined;
  onCollision: (id: string) => void;
}): Readonly<Record<string, T>> {
  const out: Record<string, T> = {};

  for (const view of views) {
    const component = slot(view);
    if (component == null) {
      continue;
    }
    if (builtins[view.id] != null) {
      onCollision(view.id);
      continue;
    }
    out[view.id] = component;
  }

  return { ...out, ...builtins };
}
