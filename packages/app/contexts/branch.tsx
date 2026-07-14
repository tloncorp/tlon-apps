import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import {
  AppInvite,
  Lure,
  extractLureMetadata,
  getMetadataFromInviteToken,
  parseInviteDeepLink,
} from '@tloncorp/shared/logic';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Linking } from 'react-native';
import branch from 'react-native-branch';

import { BRANCH_DOMAIN, MCP_OAUTH_COMPLETION_PATH } from '../constants';
import { useGroupNavigation } from '../hooks/useGroupNavigation';
import { resolveDeferredInvite } from '../lib/deferredInvite';
import { getPathFromWer } from '../utils/string';
import { useShip } from './ship';

type State = Lure & {
  deepLinkPath: string | undefined;
};

type ContextValue = State & {
  setLure: (invite: AppInvite) => void;
  clearLure: (options?: { preserveFetching?: boolean }) => void;
  clearDeepLink: () => void;
};

// the invite intake owns one token at a time: either a fetch is in
// flight for it, or a lure for it has been applied (with known
// metadata quality)
type InviteIntake =
  | { token: string; phase: 'fetching' }
  | { token: string; phase: 'applied'; hasMetadata: boolean };

const INITIAL_STATE: State = {
  deepLinkPath: undefined,
  lure: undefined,
  priorityToken: undefined,
};

const logger = createDevLogger('deeplink', true);

// captured at import, before any effect can run: logout wipes shipInfo,
// and the first-install storage wipe (InitialStateCheckScreen) both wipes
// and re-arms flags mid-session — so install freshness must be judged by
// launch-time state. every shipped version maintains these two markers,
// and both survive logout
const priorInstallAtLaunch = Promise.all([
  storage.didClearPreviousInstall.getValue(),
  storage.lastAppVersion.getValue(),
]).then(
  ([cleared, version]) => Boolean(cleared) || version != null,
  () => false
);

const inviteHasMetadata = (invite: Partial<AppInvite>) =>
  Boolean(invite.inviterUserId || invite.invitedGroupId || invite.inviteType);

export const Context = createContext({} as ContextValue);

export const useBranch = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useBranch` within a `BranchProvider` component.'
    );
  }

  return context;
};

export const useSignupParams = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useSignupParams` within a `BranchProvider` component.'
    );
  }

  // No lure fallback: when there's no real invite, these stay undefined so the
  // signup flow sends no lure → backend routes to the default (no-group) policy.
  return {
    lureId: context.lure?.id,
    priorityToken: context.priorityToken,
  };
};

export const useLureMetadata = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useLureMetadata` within a `BranchProvider` component.'
    );
  }

  return context.lure ?? null;
};

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const [{ deepLinkPath, lure, priorityToken }, setState] =
    useState(INITIAL_STATE);
  const { isAuthenticated } = useShip();
  // later arrivals claim the intake slot; earlier fetches that lost it
  // drop their results
  const intakeRef = useRef<InviteIntake | null>(null);
  const initialUrlHandledRef = useRef(false);
  // storage resets are fire-and-forget, so a mount-time restore read can
  // win the race and return a value a wer link or clearLure just wiped —
  // once anything clears the invite this session, in-memory state is
  // authoritative and restores are off
  const inviteClearedRef = useRef(false);
  // auth is read at apply time: a cold-start fetch can begin while
  // ShipProvider still reports unauthenticated and resolve after login
  // state loads — the closure value would mark the invite pre-signup
  const isAuthenticatedRef = useRef(isAuthenticated);
  // layout effect: flushes synchronously with the commit, so a fetch
  // settling right after an auth change cannot read the previous value
  useLayoutEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const { goToChannel } = useGroupNavigation();

  const setInviteLure = useCallback(
    (
      invite: Omit<AppInvite, 'shouldAutoJoin'>,
      options: { priorityToken?: string; source?: string } = {}
    ) => {
      const nextLure: Lure = {
        lure: {
          ...invite,
          // if not already authenticated, we should run Lure's invite auto-join capability after signing in
          shouldAutoJoin: !isAuthenticatedRef.current,
        },
        priorityToken: options.priorityToken,
      };
      logger.log('setting deeplink lure', nextLure);
      // claim the intake slot: an in-flight url fetch for an older invite
      // drops its result instead of overwriting this one (e.g. a pasted
      // invite racing a slow link fetch)
      intakeRef.current = {
        token: invite.id,
        phase: 'applied',
        hasMetadata: inviteHasMetadata(invite),
      };
      setState({
        ...nextLure,
        deepLinkPath: undefined,
      });
      void storage.invitation.setValue(nextLure).catch((error) => {
        logger.trackError(AnalyticsEvent.InviteError, {
          error,
          context: 'Failed to save lure metadata',
          inviteId: invite.id,
          source: options.source,
        });
      });
    },
    []
  );

  // a wer (deep link) clears the invite machine: release the intake slot
  // (a re-tap of the old invite must not be swallowed), tombstone restores,
  // wipe the persisted copy, and route to the path
  const applyWerDeepLink = useCallback((wer: string) => {
    const deepLinkPath = getPathFromWer(wer);
    logger.log('detected non-Branch deep link:', deepLinkPath);
    intakeRef.current = null;
    inviteClearedRef.current = true;
    storage.invitation.resetValue();
    setState({
      deepLinkPath,
      lure: undefined,
      priorityToken: undefined,
    });
  }, []);

  const handleInviteUrl = useCallback(
    async (
      url: string,
      source:
        | 'expo_linking'
        | 'non_branch_link'
        | 'install_referrer'
        | 'clipboard'
        | 'ip_match'
    ) => {
      const parsed = parseInviteDeepLink(url, { branchDomain: BRANCH_DOMAIN });
      if (!parsed) {
        return false;
      }

      if (parsed.type === 'wer') {
        applyWerDeepLink(parsed.wer);
        return true;
      }

      const intake = intakeRef.current;
      if (
        intake?.token === parsed.token &&
        // an applied id-only copy (provider outage at tap time) is the one
        // state a re-tap should refresh rather than dedupe away
        !(intake.phase === 'applied' && !intake.hasMetadata)
      ) {
        return true;
      }
      // signed-out taps paint an id-only lure before the fetch so signup
      // params carry the token even while metadata is slow. the paint is
      // in-memory only: persisting the bare copy would clobber same-token
      // cached metadata that the provider-failure fallback below reads back
      if (!isAuthenticatedRef.current) {
        setState({
          lure: { id: parsed.token, shouldAutoJoin: true },
          priorityToken: undefined,
          deepLinkPath: undefined,
        });
      }
      intakeRef.current = { token: parsed.token, phase: 'fetching' };
      // snapshot the persisted copy now: consuming a painted lure mid-fetch
      // soft-clears storage, and the provider-failure fallback below wants
      // the cache as it existed when this tap arrived
      const cachedLure = storage.invitation.getValue().catch(() => null);

      logger.trackEvent('Detected Branch-Independent Invite Link', {
        inviteId: parsed.token,
        source,
      });

      let invite = await getMetadataFromInviteToken(parsed.token);
      // a same-token copy persisted by an earlier session still matters:
      // its metadata beats the id-only fallback when the provider gives
      // nothing, and its priority token (branch links persist one; direct
      // urls cannot carry it) must survive the re-tap either way
      const saved = await cachedLure;
      const sameTokenSaved = saved?.lure?.id === parsed.token;
      if (
        !invite &&
        sameTokenSaved &&
        saved?.lure &&
        inviteHasMetadata(saved.lure)
      ) {
        invite = saved.lure;
      }
      // assert: the ref may have been reassigned during the awaits, which
      // control-flow narrowing does not see
      const settled = intakeRef.current as InviteIntake | null;
      if (settled?.token !== parsed.token) {
        // a newer invite claimed the slot while we were fetching
        return true;
      }
      if (settled.phase === 'applied' && (settled.hasMetadata || !invite)) {
        // a lure for this token already applied while we were fetching —
        // keep it unless ours is the first real metadata (refreshing an
        // id-only copy persisted during a provider outage)
        return true;
      }
      setInviteLure(invite ?? { id: parsed.token }, {
        source,
        priorityToken: sameTokenSaved ? saved?.priorityToken : undefined,
      });
      return true;
    },
    [applyWerDeepLink, setInviteLure]
  );

  useEffect(() => {
    console.debug('[branch] Subscribing to Branch listener');

    // Subscribe to Branch deep link listener
    const unsubscribe = branch.subscribe({
      onOpenComplete: async ({ params }) => {
        const nonBranchLink = params?.['+non_branch_link'];
        if (nonBranchLink != null && typeof nonBranchLink === 'string') {
          let asUrl: URL;
          try {
            asUrl = new URL(nonBranchLink);
          } catch {
            return;
          }

          const path = [asUrl.hostname, asUrl.pathname.replace(/^\//, '')]
            .filter(Boolean)
            .join('/');
          if (path === MCP_OAUTH_COMPLETION_PATH) {
            return;
          }

          const handled = await handleInviteUrl(
            nonBranchLink,
            'non_branch_link'
          );
          // moves into the shared url handler when the Branch pipe is removed
          if (!handled && asUrl.hostname === 'channel') {
            switch (asUrl.pathname) {
              // example: io.tlon.groups://channel/open?id=0v4.00000.qd4mk.d4htu.er4b8.eao21&startDraft=true
              case '/open': {
                const channelId = asUrl.searchParams.get('id');
                const startDraft = Boolean(
                  asUrl.searchParams.get('startDraft')
                );
                if (channelId) {
                  // opening a channel is fresher intent than a pending
                  // invite fetch — release the slot so a late provider
                  // response drops instead of yanking navigation away
                  if (intakeRef.current?.phase === 'fetching') {
                    intakeRef.current = null;
                  }
                  goToChannel(channelId, { startDraft });
                }
                break;
              }
            }
          }
          return;
        }

        // Handle Branch link click
        if (params?.['+clicked_branch_link']) {
          const lureId =
            typeof params.lure === 'string' &&
            (params.lure.startsWith('0v') || params.lure.includes('/'))
              ? params.lure
              : null;
          logger.trackEvent('Detected Branch Link Click', {
            inviteId: lureId,
            matchGuaranteed: params?.['+match_guaranteed'] === true,
            isFirstSession: params?.['+is_first_session'] === true,
          });

          if (lureId) {
            // Link had a lure field embedded
            logger.log('detected lure link:', lureId);
            if (
              params?.['+match_guaranteed'] &&
              params?.['+is_first_session']
            ) {
              logger.trackEvent(AnalyticsEvent.ActionDeferredDeepLink, {
                inviteId: lureId,
                inviterUserId: params?.inviterUserId,
              });
            }

            try {
              setInviteLure(
                {
                  ...extractLureMetadata(params),
                  id: lureId,
                },
                {
                  priorityToken: params.token as string | undefined,
                  source: 'branch',
                }
              );
            } catch (e) {
              logger.trackError(AnalyticsEvent.InviteError, {
                error: e,
                context: 'Failed to extract lure metadata',
                inviteId: lureId,
              });
            }
          } else if (params.wer) {
            applyWerDeepLink(params.wer as string);
          }
        }
      },
    });

    // the launch url must be consumed at most once per provider lifetime,
    // even if the effect re-runs — a second read would replay it as a fresh
    // invite after signup consumed it (or after logout cleared it)
    if (!initialUrlHandledRef.current) {
      initialUrlHandledRef.current = true;
      (async () => {
        // the saved-lure restore must not race the launch url: a cold-start
        // url claims the intake slot (and a wer link sets the tombstone)
        // synchronously before handleInviteUrl's first await, so by the time
        // the restore below decides, fresher intent is already visible
        try {
          const url = await Linking.getInitialURL();
          if (url) {
            void handleInviteUrl(url, 'expo_linking');
          }
        } catch (error) {
          logger.trackError(AnalyticsEvent.InviteError, {
            error,
            context: 'Failed to get initial URL',
          });
        }

        // restore only when the intake slot is free and nothing cleared
        // this session — whatever claimed the slot is fresher intent, even
        // for the same token. checked before the read too: when the launch
        // url claimed the slot, the read's result is already unusable
        if (!inviteClearedRef.current && intakeRef.current == null) {
          const nextLure = await storage.invitation.getValue();
          if (
            nextLure?.lure &&
            !inviteClearedRef.current &&
            intakeRef.current == null
          ) {
            console.debug('[branch] Detected saved lure:', nextLure.lure);
            intakeRef.current = {
              token: nextLure.lure.id,
              phase: 'applied',
              hasMetadata: inviteHasMetadata(nextLure.lure),
            };
            setState({
              ...nextLure,
              deepLinkPath: undefined,
            });
          }
        }

        // deferred install attribution (cascade steps 2–4): one shot per
        // install. the flag is set on the first pass no matter which path
        // claimed the invite, so the clipboard read — and its ios paste
        // prompt — can never fire on a later launch
        const deferredChecked = await storage.deferredInviteChecked.getValue();
        if (deferredChecked) {
          return;
        }
        void storage.deferredInviteChecked.setValue(true);
        // updaters are not fresh installs: there is no install gap to
        // recover across, and skipping keeps a years-old play referrer
        // from resurrecting the invite that originally installed the app
        // (and spares ios updaters a paste prompt on first launch)
        if (await priorInstallAtLaunch) {
          return;
        }
        if (inviteClearedRef.current || intakeRef.current != null) {
          // a launch url or saved lure already owns this install's invite
          return;
        }
        const deferred = await resolveDeferredInvite();
        if (deferred) {
          logger.trackEvent('Deferred Invite Recovery', {
            source: deferred.source,
            matchedAfterMs: deferred.matchedAfterMs,
          });
          void handleInviteUrl(deferred.url, deferred.source);
        }
      })();
    }

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      void handleInviteUrl(event.url, 'expo_linking');
    });

    return () => {
      console.debug('[branch] Unsubscribing from Branch listener');
      unsubscribe();
      linkingSubscription.remove();
    };
  }, [applyWerDeepLink, goToChannel, handleInviteUrl, setInviteLure]);

  const clearLure = useCallback(
    (options: { preserveFetching?: boolean } = {}) => {
      console.debug('[branch] Clearing lure state');
      // the redeem path passes preserveFetching: an in-flight fetch there is
      // newer intent (a fresh tap racing the redeem of a stale invite). hard
      // clears — logout — cancel it, so the next account cannot inherit a
      // fetch that settles after the wipe
      if (
        !(options.preserveFetching && intakeRef.current?.phase === 'fetching')
      ) {
        intakeRef.current = null;
      }
      inviteClearedRef.current = true;
      setState((curr) => ({
        ...curr,
        lure: undefined,
        priorityToken: undefined,
      }));
      storage.invitation.resetValue();
    },
    []
  );

  const clearDeepLink = useCallback(() => {
    console.debug('[branch] Clearing deep link state');
    setState((curr) => ({
      ...curr,
      deepLinkPath: undefined,
    }));
  }, []);

  return (
    <Context.Provider
      value={{
        deepLinkPath,
        lure,
        priorityToken,
        setLure: setInviteLure,
        clearLure,
        clearDeepLink,
      }}
    >
      {children}
    </Context.Provider>
  );
};
