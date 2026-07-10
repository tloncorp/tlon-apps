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
  useRef,
  useState,
} from 'react';
import { Linking } from 'react-native';
import branch from 'react-native-branch';

import { BRANCH_DOMAIN, MCP_OAUTH_COMPLETION_PATH } from '../constants';
import { useGroupNavigation } from '../hooks/useGroupNavigation';
import { getPathFromWer } from '../utils/string';
import { useShip } from './ship';

type State = Lure & {
  deepLinkPath: string | undefined;
};

type ContextValue = State & {
  setLure: (invite: AppInvite) => void;
  clearLure: () => void;
  clearDeepLink: () => void;
};

const INITIAL_STATE: State = {
  deepLinkPath: undefined,
  lure: undefined,
  priorityToken: undefined,
};

const logger = createDevLogger('deeplink', true);

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
  const handledInviteTokenRef = useRef<string | null>(null);
  const lastSetLureIdRef = useRef<string | null>(null);
  const initialUrlHandledRef = useRef(false);

  const { goToChannel } = useGroupNavigation();

  const setInviteLure = useCallback(
    (
      invite: AppInvite,
      options: { priorityToken?: string; source?: string } = {}
    ) => {
      const nextLure: Lure = {
        lure: {
          ...invite,
          // if not already authenticated, we should run Lure's invite auto-join capability after signing in
          shouldAutoJoin: !isAuthenticated,
        },
        priorityToken: options.priorityToken,
      };
      logger.log('setting deeplink lure', nextLure);
      lastSetLureIdRef.current = invite.id;
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
    [isAuthenticated]
  );

  const handleInviteUrl = useCallback(
    async (url: string, source: 'expo_linking' | 'non_branch_link') => {
      const parsed = parseInviteDeepLink(url, { branchDomain: BRANCH_DOMAIN });
      if (!parsed) {
        return false;
      }

      if (parsed.type === 'wer') {
        const deepLinkPath = getPathFromWer(parsed.wer);
        logger.log('detected non-Branch deep link:', deepLinkPath);
        // this clears the lure, so the dedupe refs must not keep swallowing
        // a re-tap of an invite that no longer has state
        handledInviteTokenRef.current = null;
        lastSetLureIdRef.current = null;
        setState({
          deepLinkPath,
          lure: undefined,
          priorityToken: undefined,
        });
        return true;
      }

      if (handledInviteTokenRef.current === parsed.token) {
        return true;
      }
      handledInviteTokenRef.current = parsed.token;

      logger.trackEvent('Detected Branch-Independent Invite Link', {
        inviteId: parsed.token,
        source,
      });

      const invite = await getMetadataFromInviteToken(parsed.token);
      if (handledInviteTokenRef.current !== parsed.token) {
        // a newer invite link superseded this one while we were fetching
        return true;
      }
      if (lastSetLureIdRef.current === parsed.token) {
        // a lure for this token landed while we were fetching — typically the
        // Branch callback's payload, which is at least as rich and carries a
        // priority token this set would otherwise clobber
        return true;
      }
      setInviteLure(
        invite ?? {
          id: parsed.token,
          shouldAutoJoin: !isAuthenticated,
        },
        { source }
      );
      return true;
    },
    [isAuthenticated, setInviteLure]
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
          if (!handled && asUrl.hostname === 'channel') {
            switch (asUrl.pathname) {
              // example: io.tlon.groups://channel/open?id=0v4.00000.qd4mk.d4htu.er4b8.eao21&startDraft=true
              case '/open': {
                const channelId = asUrl.searchParams.get('id');
                const startDraft = Boolean(
                  asUrl.searchParams.get('startDraft')
                );
                if (channelId) {
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
            handledInviteTokenRef.current = lureId;
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
                  shouldAutoJoin: !isAuthenticated,
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
            // Link had a wer (deep link) field embedded
            const deepLinkPath = getPathFromWer(params.wer as string);
            console.debug('detected deep link:', deepLinkPath);
            setState({
              deepLinkPath,
              lure: undefined,
              priorityToken: undefined,
            });
          }
        }
      },
    });

    // once per provider lifetime: the effect re-runs on auth changes, and a
    // second read would replay the launch url as a fresh invite after signup
    // consumed it (or after logout cleared it)
    if (!initialUrlHandledRef.current) {
      initialUrlHandledRef.current = true;
      Linking.getInitialURL()
        .then((url) => {
          if (url) {
            void handleInviteUrl(url, 'expo_linking');
          }
        })
        .catch((error) => {
          logger.trackError(AnalyticsEvent.InviteError, {
            error,
            context: 'Failed to get initial URL',
          });
        });
    }

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      void handleInviteUrl(event.url, 'expo_linking');
    });

    // Check for saved lure
    (async () => {
      const nextLure = await storage.invitation.getValue();
      if (nextLure && handledInviteTokenRef.current == null) {
        console.debug('[branch] Detected saved lure:', nextLure.lure);
        setState({
          ...nextLure,
          deepLinkPath: undefined,
        });
      }
    })();

    return () => {
      console.debug('[branch] Unsubscribing from Branch listener');
      unsubscribe();
      linkingSubscription.remove();
    };
  }, [goToChannel, handleInviteUrl, isAuthenticated, setInviteLure]);

  const setLure = setInviteLure;

  const clearLure = useCallback(() => {
    console.debug('[branch] Clearing lure state');
    handledInviteTokenRef.current = null;
    lastSetLureIdRef.current = null;
    setState((curr) => ({
      ...curr,
      lure: undefined,
      priorityToken: undefined,
    }));
    storage.invitation.resetValue();
  }, []);

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
        setLure,
        clearLure,
        clearDeepLink,
      }}
    >
      {children}
    </Context.Provider>
  );
};
