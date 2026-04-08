import { poke, scry } from './urbit';
import { formatUd, parseIdNumber } from './apiUtils';

export interface PublicProfileWidget {
  desk: string;
  term: string;
}

function normalizeReferencePath(path: string) {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  return withLeadingSlash.replaceAll("'", '');
}

function quoteTerminalReferencePathId(path: string) {
  const normalized = normalizeReferencePath(path);
  const match = normalized.match(/^(.*\/(?:msg|note|curio)\/)([^/]+)$/);
  if (!match) {
    return normalized;
  }

  const prefix = match[1];
  const id = match[2];

  try {
    const canonical = parseIdNumber(id).toString();
    return `${prefix}'${canonical}'`;
  } catch {
    return normalized;
  }
}

function getReferencePathVariants(path: string) {
  const normalized = normalizeReferencePath(path);
  const variants = new Set<string>([normalized]);
  const match = normalized.match(/^(.*\/(?:msg|note|curio)\/)([^/]+)$/);
  if (!match) {
    return [...variants];
  }

  const prefix = match[1];
  const id = match[2];

  try {
    const canonical = parseIdNumber(id).toString();
    variants.add(`${prefix}${canonical}`);
    variants.add(`${prefix}${formatUd(canonical)}`);
    variants.add(`${prefix}'${canonical}'`);
  } catch {
    // Non-numeric terminal segments should only use the normalized path.
  }

  return [...variants];
}

async function scryProfileBoolean(path: string) {
  return scry<boolean>({
    app: 'profile',
    path,
  });
}

async function scryProfileLayout(path: string) {
  return scry<PublicProfileWidget[]>({
    app: 'profile',
    path,
  });
}

function getExposeCitesFromContact(contact: unknown) {
  if (!contact || typeof contact !== 'object') {
    return [];
  }

  const exposeCites = (contact as Record<string, unknown>)['expose-cites'];
  if (!exposeCites || typeof exposeCites !== 'object') {
    return [];
  }

  const field = exposeCites as Record<string, unknown>;
  if (field.type !== 'set' || !Array.isArray(field.value)) {
    return [];
  }

  return field.value.flatMap((value) => {
    if (!value || typeof value !== 'object') {
      return [];
    }

    const entry = value as Record<string, unknown>;
    if (entry.type !== 'text' || typeof entry.value !== 'string') {
      return [];
    }

    return [normalizeReferencePath(entry.value)];
  });
}

function getContactFromSelfScry(response: unknown) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  if (!('self' in response)) {
    return response;
  }

  return (response as { self?: unknown }).self;
}

async function getPublicProfilePostShownFromContacts(
  referencePathVariants: string[]
) {
  try {
    const selfContactResponse = await scry<unknown>({
      app: 'contacts',
      path: '/v1/self',
    });
    const selfContact = getContactFromSelfScry(selfContactResponse);

    const exposedCites = new Set(getExposeCitesFromContact(selfContact));
    return referencePathVariants.some((referencePath) =>
      exposedCites.has(normalizeReferencePath(referencePath))
    );
  } catch {
    return false;
  }
}

async function pokePublicExpose(
  json: { show?: string; hide?: string },
  options?: { suppressErrorTracking?: boolean }
) {
  await poke({
    app: 'expose',
    mark: 'json',
    json,
    suppressErrorTracking: options?.suppressErrorTracking,
  });
}

async function pokePublicExposePath(path: string, mode: 'show' | 'hide') {
  const quotedPath = quoteTerminalReferencePathId(path);
  const unquotedPath = normalizeReferencePath(path);

  const buildPayload = (value: string) =>
    mode === 'show' ? { show: value } : { hide: value };

  try {
    await pokePublicExpose(buildPayload(quotedPath), {
      suppressErrorTracking: true,
    });
  } catch (error) {
    // Some %expose builds do not accept quoted terminal IDs.
    if (quotedPath === unquotedPath) {
      throw error;
    }
    await pokePublicExpose(buildPayload(unquotedPath));
  }
}

async function clearPublicExposeCites() {
  const selfContactResponse = await scry<unknown>({
    app: 'contacts',
    path: '/v1/self',
  });
  const selfContact = getContactFromSelfScry(selfContactResponse);
  const rawCites = getExposeCitesFromContact(selfContact);

  const citesToHide = new Set<string>(rawCites);
  await Promise.all(
    [...citesToHide].map((referencePath) =>
      pokePublicExposePath(referencePath, 'hide')
    )
  );
}

async function tryScryPaths<T>(
  scryFn: (path: string) => Promise<T>,
  paths: string[],
  fallback: T
): Promise<T> {
  for (const path of paths) {
    try {
      return await scryFn(path);
    } catch {
      // try next path
    }
  }
  return fallback;
}

export async function getPublicProfileRunning() {
  const boundResult = await tryScryPaths(
    scryProfileBoolean,
    ['/bound/json', '/x/bound/json'],
    null
  );
  if (boundResult !== null) return true;

  const layoutResult = await tryScryPaths(
    scryProfileLayout,
    ['/layout/json', '/x/layout/json'],
    null
  );
  return layoutResult !== null;
}

export async function getPublicProfileEnabled() {
  return tryScryPaths(
    scryProfileBoolean,
    ['/bound/json', '/x/bound/json'],
    false
  );
}

export async function setPublicProfileEnabled(enabled: boolean) {
  if (enabled) {
    return poke({
      app: 'profile',
      mark: 'json',
      json: { bind: null },
    });
  }

  await poke({
    app: 'profile',
    mark: 'json',
    json: { unbind: null },
  });

  try {
    await clearPublicExposeCites();
  } catch (error) {
    // Public profile has already been disabled by unbinding.
    console.warn('Failed to clear %expose cites after unbinding %profile', error);
  }
}

export async function getPublicProfileLayout() {
  return scry<PublicProfileWidget[]>({
    app: 'profile',
    path: '/layout/json',
  });
}

export async function setPublicProfileWidgetEnabled(
  widget: PublicProfileWidget,
  enabled: boolean
) {
  return poke({
    app: 'profile',
    mark: 'json',
    json: enabled
      ? {
          'put-widget': widget,
        }
      : {
          'del-widget': widget,
        },
  });
}

export async function getPublicProfilePostShown(path: string) {
  const referencePathVariants = getReferencePathVariants(path);
  if (!referencePathVariants.length) {
    return false;
  }

  return getPublicProfilePostShownFromContacts(referencePathVariants);
}

export async function getExposedPostCitesNormalized(): Promise<Set<string>> {
  try {
    const selfContactResponse = await scry<unknown>({
      app: 'contacts',
      path: '/v1/self',
    });
    const selfContact = getContactFromSelfScry(selfContactResponse);
    const rawCites = getExposeCitesFromContact(selfContact);
    // Expand each cite to all path variants (UD, numeric, normalized) so
    // lookups succeed regardless of which format the %expose agent stored.
    const allVariants = new Set<string>();
    for (const cite of rawCites) {
      for (const variant of getReferencePathVariants(cite)) {
        allVariants.add(variant);
      }
    }
    return allVariants;
  } catch {
    return new Set();
  }
}

export async function setPublicProfilePostShown(path: string, shown: boolean) {
  if (!shown) {
    await pokePublicExposePath(path, 'hide');
    return;
  }

  await pokePublicExposePath(path, 'show');
}
