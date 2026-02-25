import { BadResponseError, poke, scry } from './urbit';
import { formatUd, parseIdNumber } from './apiUtils';

const START_PROFILE_COMMAND = '|start %groups %profile';
const SUSPEND_PROFILE_COMMAND = '|suspend %groups %profile';
const START_EXPOSE_COMMAND = '|start %groups %expose';
let exposeKnownRunning = false;
let exposeStartAttempted = false;
let startExposePromise: Promise<void> | null = null;

export interface PublicProfileWidget {
  desk: string;
  term: string;
}

function normalizeReferencePath(path: string) {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  return withLeadingSlash.replaceAll("'", '');
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

async function ensurePublicExposeRunning() {
  if (exposeKnownRunning || exposeStartAttempted) {
    return;
  }

  if (!startExposePromise) {
    startExposePromise = (async () => {
      exposeStartAttempted = true;
      try {
        await poke({
          app: 'hood',
          mark: 'helm-hi',
          json: START_EXPOSE_COMMAND,
        });
      } catch (error) {
        console.warn('Failed to start %expose app', error);
      }
    })().finally(() => {
      startExposePromise = null;
    });
  }

  await startExposePromise;
}

function isNotFoundError(error: unknown) {
  return error instanceof BadResponseError && error.status === 404;
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

async function pokePublicExpose(json: { show?: string; hide?: string }) {
  try {
    await poke({
      app: 'expose',
      mark: 'json',
      json,
    });
    exposeKnownRunning = true;
    return;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  await ensurePublicExposeRunning();
  await poke({
    app: 'expose',
    mark: 'json',
    json,
  });
  exposeKnownRunning = true;
}

export async function getPublicProfileRunning() {
  try {
    await scryProfileBoolean('/bound/json');
    return true;
  } catch {
    try {
      await scryProfileBoolean('/x/bound/json');
      return true;
    } catch {
      try {
        await scryProfileLayout('/layout/json');
        return true;
      } catch {
        try {
          await scryProfileLayout('/x/layout/json');
          return true;
        } catch {
          return false;
        }
      }
    }
  }
}

export async function getPublicProfileEnabled() {
  try {
    return await scryProfileBoolean('/bound/json');
  } catch {
    try {
      return await scryProfileBoolean('/x/bound/json');
    } catch {
      return false;
    }
  }
}

export async function setPublicProfileEnabled(enabled: boolean) {
  if (enabled) {
    try {
      await poke({
        app: 'hood',
        mark: 'helm-hi',
        json: START_PROFILE_COMMAND,
      });
    } catch (error) {
      // Binding can still succeed if %profile is already running.
      console.warn('Failed to start %profile app', error);
    }

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
    await poke({
      app: 'hood',
      mark: 'helm-hi',
      json: SUSPEND_PROFILE_COMMAND,
    });
  } catch (error) {
    // Public profile has already been disabled by unbinding.
    console.warn('Failed to suspend %profile app', error);
  }
}

export async function getPublicProfileLayout() {
  try {
    return await scryProfileLayout('/layout/json');
  } catch {
    try {
      return await scryProfileLayout('/x/layout/json');
    } catch {
      return [];
    }
  }
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
    return new Set(getExposeCitesFromContact(selfContact));
  } catch {
    return new Set();
  }
}

export async function setPublicProfilePostShown(path: string, shown: boolean) {
  const referencePathVariants = getReferencePathVariants(path);
  if (!shown) {
    await Promise.all(
      referencePathVariants.map((referencePath) =>
        pokePublicExpose({
          hide: referencePath,
        })
      )
    );
    return;
  }

  const referencePath = normalizeReferencePath(path);
  await pokePublicExpose({
    show: referencePath,
  });
}
