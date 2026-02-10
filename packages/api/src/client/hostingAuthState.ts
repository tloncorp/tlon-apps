export type HostingSession = {
  cookie: string | null;
  userId: string | null;
};

export type HostingSessionChangeHandler = (
  session: HostingSession
) => void | Promise<void>;

export type ConfigureHostingSessionParams = {
  initialSession?: Partial<HostingSession>;
  onSessionChange?: HostingSessionChangeHandler | null;
};

export type SetHostingSessionOptions = {
  notify?: boolean;
};

let hostingSession: HostingSession = {
  cookie: null,
  userId: null,
};

let onSessionChange: HostingSessionChangeHandler | null = null;

function normalize(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return value;
}

function applySessionUpdate(update: Partial<HostingSession>): boolean {
  let changed = false;

  if ('cookie' in update) {
    const nextCookie = normalize(update.cookie);
    if (hostingSession.cookie !== nextCookie) {
      hostingSession.cookie = nextCookie;
      changed = true;
    }
  }

  if ('userId' in update) {
    const nextUserId = normalize(update.userId);
    if (hostingSession.userId !== nextUserId) {
      hostingSession.userId = nextUserId;
      changed = true;
    }
  }

  return changed;
}

function emitSessionChange() {
  if (!onSessionChange) {
    return;
  }

  Promise.resolve(onSessionChange(getHostingSession())).catch(() => {
    // no-op: callers can handle persistence errors in their own callback logic
  });
}

export function configureHostingSession(
  params: ConfigureHostingSessionParams = {}
) {
  if ('onSessionChange' in params) {
    onSessionChange = params.onSessionChange ?? null;
  }
  if (params.initialSession) {
    setHostingSession(params.initialSession, { notify: false });
  }
}

export function setHostingSession(
  update: Partial<HostingSession>,
  options: SetHostingSessionOptions = {}
) {
  const { notify = true } = options;
  const changed = applySessionUpdate(update);

  if (changed && notify) {
    emitSessionChange();
  }

  return getHostingSession();
}

export function getHostingSession(): HostingSession {
  return {
    cookie: hostingSession.cookie,
    userId: hostingSession.userId,
  };
}

export function getHostingSessionCookie(): string | null {
  return hostingSession.cookie;
}

export function getHostingSessionUserId(): string | null {
  return hostingSession.userId;
}

export function clearHostingSession(options?: SetHostingSessionOptions) {
  return setHostingSession({ cookie: null, userId: null }, options);
}
