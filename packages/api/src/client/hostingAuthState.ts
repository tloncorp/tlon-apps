export type HostingSessionPersistence = {
  getCookie: () => Promise<string | null | undefined>;
  getUserId: () => Promise<string | null | undefined>;
  setCookie: (cookie: string) => Promise<void>;
  setUserId: (userId: string) => Promise<void>;
};

let hostingSessionPersistence: HostingSessionPersistence | null = null;

export function configureHostingSessionPersistence(
  persistence: HostingSessionPersistence | null
) {
  if (hostingSessionPersistence === persistence) {
    return;
  }

  hostingSessionPersistence = persistence;
}

function requireHostingSessionPersistence(): HostingSessionPersistence {
  if (!hostingSessionPersistence) {
    throw new Error(
      'Hosting session persistence is not configured. Call configureHostingSessionPersistence() before using hosting APIs.'
    );
  }

  return hostingSessionPersistence;
}

export async function getHostingAuthCookie(): Promise<string> {
  return (await requireHostingSessionPersistence().getCookie()) ?? '';
}

export async function getHostingUserId(): Promise<string | null> {
  return (await requireHostingSessionPersistence().getUserId()) ?? null;
}

type HostingSessionUpdate = {
  cookie?: string;
  userId?: string;
};

function persistHostingSessionUpdate(operation: Promise<void>): void {
  operation.catch(() => {
    // no-op: callers can handle persistence errors in their own callback logic.
  });
}

export function setHostingSession({
  cookie,
  userId,
}: HostingSessionUpdate): void {
  const persistence = requireHostingSessionPersistence();
  if (cookie) {
    persistHostingSessionUpdate(persistence.setCookie(cookie));
  }
  if (userId) {
    persistHostingSessionUpdate(persistence.setUserId(userId));
  }
}
