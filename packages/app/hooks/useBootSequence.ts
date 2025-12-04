import { AnalyticsEvent, createDevLogger, withRetry } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import {
  AnalyticsSeverity,
  BootPhaseNames,
  NodeBootPhase,
} from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import { preSig } from '@tloncorp/shared/urbit';
import * as utils from '@tloncorp/shared/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLureMetadata } from '../contexts/branch';
import { useShip } from '../contexts/ship';
import BootHelpers from '../lib/bootHelpers';
import { useConfigureUrbitClient } from './useConfigureUrbitClient';
import { usePosthog } from './usePosthog';

const HANDLE_INVITES_TIMEOUT = 1000 * 20;
const HANDLE_SCAFFOLD_TIMEOUT = 1000 * 30;

const GETTING_STARTED_GROUP_ID = '~wittyr-witbes/v3s2kbd7';
const TLON_STUDIO = '~tommur-dostyn/tlon-studio';

const logger = createDevLogger('boot sequence', true);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BootSequenceReport = {
  startedAt?: number;
  completedAt?: number;
} & Record<string, number | boolean>;

/*
  Takes a fresh hosting account and holds its hand until it has a node that's ready to transition
  to a logged in state.

  Two main components:
    runBootPhase — executes a single boot step, returns the next step in the sequence
    runBootSequence — repeatedly executes runBootPhase until the sequence is complete

  The hook remains idle until explicitly kicked off by the caller. Gives up after HANDLE_INVITES_TIMEOUT 
  seconds if we're stuck processing invites, but the node is otherwise ready. Exposes the current boot 
  phase to the caller.
*/
export function useBootSequence() {
  const telemetry = usePosthog();
  const { setShip } = useShip();
  const connectionStatus = store.useConnectionStatus();
  const lureMeta = useLureMetadata();
  const configureUrbitClient = useConfigureUrbitClient();

  const [bootPhase, setBootPhase] = useState(NodeBootPhase.IDLE);
  const [reservedNode, setReservedNode] = useState<{
    id: string;
    code?: string;
    isReady?: boolean;
  } | null>(null);
  const [report, setReport] = useState<BootSequenceReport | null>(null);

  const isRunningRef = useRef(false);
  const lastRunPhaseRef = useRef(bootPhase);
  const lastRunErrored = useRef(false);
  const sequenceStartTimeRef = useRef<number>(0);

  const kickOffBootSequence = useCallback(() => {
    if (bootPhase === NodeBootPhase.IDLE) {
      setBootPhase(NodeBootPhase.RESERVING);
    }
  }, [bootPhase]);

  const runBootPhase = useCallback(async (): Promise<NodeBootPhase> => {
    const hostingUserId = await db.hostingUserId.getValue();
    if (!hostingUserId) {
      logger.crumb('no hosting user found, skipping');
      return bootPhase;
    }

    //
    // RESERVING: reserve a node for the hosting account, or get one if it already exists
    //
    if (bootPhase === NodeBootPhase.RESERVING) {
      const reservedNode = await BootHelpers.reserveNode(hostingUserId);
      setReservedNode(reservedNode);
      logger.crumb(`reserved node`, reservedNode.id);
      db.hostedAccountIsInitialized.setValue(true);
      return NodeBootPhase.BOOTING;
    }

    // you should not be able to advance past here unless reservedNodeId is set
    if (!reservedNode?.id) {
      throw new Error(
        `cannot run boot phase ${bootPhase} without a reserved node`
      );
    }

    //
    // BOOTING: confirm the node has finished booting on hosting
    //
    if (bootPhase === NodeBootPhase.BOOTING) {
      if (reservedNode.isReady) {
        // if we've cached that it's ready during the reservation step, skip this check
        await db.hostedNodeIsRunning.setValue(true);
        return NodeBootPhase.AUTHENTICATING;
      }

      const isReady = await BootHelpers.checkNodeBooted();
      if (isReady) {
        logger.crumb('checked hosting, node is ready');
        return NodeBootPhase.AUTHENTICATING;
      }

      logger.crumb('checked hosting, node still booting');
      return NodeBootPhase.BOOTING;
    }

    //
    // AUTHENTICATING: authenticate with the node itself
    //
    if (bootPhase === NodeBootPhase.AUTHENTICATING) {
      try {
        const shipInfo = await store.authenticateWithReadyNode(
          reservedNode.code
        );
        if (!shipInfo) {
          throw new Error('Could not authenticate with node');
        }
        setShip({ ...shipInfo, needsSplashSequence: true });
        telemetry?.identify(preSig(shipInfo.ship!), { isHostedUser: true });

        // deeper logic relies on the setShip result being available, use small delay
        // to avoid race conditions
        await wait(200);

        configureUrbitClient({
          shipName: shipInfo.ship,
          shipUrl: shipInfo.shipUrl,
        });
        withRetry(() => store.syncStart(), {
          numOfAttempts: 3,
          startingDelay: 30000,
        });

        logger.crumb(`authenticated with node`);
        return NodeBootPhase.CONNECTING;
      } catch (err) {
        logger.crumb('failed to authenticate with node', err);
        return NodeBootPhase.AUTHENTICATING;
      }
    }

    //
    // CONNECTING: make sure the connection is established
    //
    if (bootPhase === NodeBootPhase.CONNECTING) {
      // immediately subscribing on a path that generates a fact significantly reduces connection time
      store.syncGroupPreviews(['~tommur-dostyn/tlon-studio']);
      if (connectionStatus === 'Connected') {
        logger.crumb(`connection to node established`);
        return NodeBootPhase.SCAFFOLDING_WAYFINDING;
      }

      logger.crumb(`still connecting to node`, connectionStatus);
      return NodeBootPhase.CONNECTING;
    }

    //
    // SCAFFOLDING WAYFINDING: make sure the starter group is created
    if (bootPhase === NodeBootPhase.SCAFFOLDING_WAYFINDING) {
      if (lureMeta?.inviteType !== 'user') {
        logger.trackEvent('Detected group invite, skipping scaffold');
        return NodeBootPhase.CHECKING_FOR_INVITE;
      }

      if (lureMeta?.invitedGroupTitle) {
        // workaround for our generic invites that boot you into empty state. Should be
        // removed once a better backend solution is in place

        logger.trackEvent(
          'Detected generic workaround invite, skipping scaffold'
        );
        return NodeBootPhase.CHECKING_FOR_INVITE;
      }

      try {
        await store.scaffoldPersonalGroup();

        // since we know they're using the app for the first time, enable coach marks
        db.wayfindingProgress.setValue((prev) => ({
          ...prev,
          tappedChatInput: false,
          tappedAddCollection: false,
          tappedAddNote: false,
        }));

        const signedUpWithInvite = Boolean(lureMeta?.id);
        return signedUpWithInvite
          ? NodeBootPhase.CHECKING_FOR_INVITE
          : NodeBootPhase.READY;
      } catch (e) {
        return NodeBootPhase.SCAFFOLDING_WAYFINDING;
      }
    }

    //
    // CHECKING_FOR_INVITE [optional]: if we used an invite code to signup, see if we got the invites
    //
    if (bootPhase === NodeBootPhase.CHECKING_FOR_INVITE) {
      // always add the inviter as a contact first
      if (lureMeta?.inviterUserId) {
        const contact = await db.getContact({ id: lureMeta.inviterUserId });
        if (!contact || !contact.isContact) {
          store.addContact(lureMeta?.inviterUserId);
        }
      }

      const { invitedDm, invitedGroup, tlonTeamDM } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'invites to look for',
        invitedDm,
        invitedGroup,
        tlonTeamDM,
      });

      const requiredInvites =
        lureMeta?.inviteType === 'user' ? invitedDm : invitedGroup && invitedDm;

      if (requiredInvites) {
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: 'confirmed node has the invites',
        });
        return NodeBootPhase.ACCEPTING_INVITES;
      }

      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'checked node for invites, not yet found',
      });
      return NodeBootPhase.CHECKING_FOR_INVITE;
    }

    //
    // ACCEPTING_INVITES [optional]: join the invited groups
    //
    if (bootPhase === NodeBootPhase.ACCEPTING_INVITES) {
      const { invitedDm, invitedGroup, tlonTeamDM } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

      // if expected items aren't there, re-run this step
      if (
        !tlonTeamDM ||
        !invitedDm ||
        (lureMeta?.inviteType === 'group' && !invitedGroup)
      ) {
        return NodeBootPhase.ACCEPTING_INVITES;
      }

      // if we have invites, accept them
      if (tlonTeamDM && tlonTeamDM.isDmInvite) {
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: `have tlon team dm invite, accepting`,
        });
        store.respondToDMInvite({ channel: tlonTeamDM, accept: true });
      }

      if (invitedDm && invitedDm.isDmInvite) {
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: `have dm invite from inviter, accepting`,
        });
        store.respondToDMInvite({ channel: invitedDm, accept: true });
      }

      if (
        invitedGroup &&
        !invitedGroup.currentUserIsMember &&
        invitedGroup.haveInvite
      ) {
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: `have group invite, joining`,
        });
        store.joinGroup(invitedGroup);
      }

      if (lureMeta?.invitedGroupId !== GETTING_STARTED_GROUP_ID) {
        api.joinGroup(GETTING_STARTED_GROUP_ID).catch((e) => {
          logger.trackError('failed to join getting started group', {
            errorMessage: e.message,
            errorStack: e.stack,
          });
        });
      }

      // unconditionally attempt to leave Tlon Studio
      store.leaveGroup(TLON_STUDIO).catch((e) => {
        logger.trackError('failed to leave tlon studio group', {
          errorMessage: e.message,
          errorStack: e.stack,
        });
      });

      // give the joins some time to process, then resync & pin
      setTimeout(() => {
        if (invitedGroup && !invitedGroup.currentUserIsMember) {
          store.syncGroup(invitedGroup?.id, undefined, { force: true });
          store.syncGroup(GETTING_STARTED_GROUP_ID, undefined, { force: true });
        }
        if (invitedDm && invitedDm.isDmInvite) {
          store.syncDms();
        }
      }, 5000);

      return NodeBootPhase.READY;
    }

    return bootPhase;
  }, [
    bootPhase,
    configureUrbitClient,
    connectionStatus,
    lureMeta,
    reservedNode,
    setShip,
    telemetry,
  ]);

  // we increment a counter to ensure the effect executes after every run, even if
  // the step didn't advance
  const [bootStepCounter, setBootCounter] = useState(0);
  const tryingWayfindingSince = useRef<number | null>(null);
  const tryingInviteHandling = useRef<number | null>(null);
  const lastPhaseCompletedAt = useRef<number | null>(null);
  useEffect(() => {
    const runBootSequence = async () => {
      // prevent simultaneous runs
      if (isRunningRef.current) {
        return;
      }

      isRunningRef.current = true;
      if (!sequenceStartTimeRef.current) {
        sequenceStartTimeRef.current = Date.now();
      }

      try {
        // if rerunning failed step, wait before retry
        const lastRunDidNotAdvance = bootPhase === lastRunPhaseRef.current;
        if (lastRunDidNotAdvance || lastRunErrored.current) {
          logger.crumb('waiting before retrying last phase');
          await wait(1000);
        }

        lastRunPhaseRef.current = bootPhase;
        lastRunErrored.current = false;
        logger.log(`running boot sequence phase: ${BootPhaseNames[bootPhase]}`);

        const nextBootPhase = await runBootPhase();
        if (nextBootPhase !== bootPhase) {
          const prevStepMarker =
            lastPhaseCompletedAt.current ?? sequenceStartTimeRef.current;
          const durationSeconds = (Date.now() - prevStepMarker) / 1000;

          setReport((r) => ({
            ...r,
            [`${BootPhaseNames[bootPhase]}Duration`]:
              Math.round(durationSeconds * 10) / 10,
          }));
          lastPhaseCompletedAt.current = Date.now();
        }
        setBootPhase(nextBootPhase);
      } catch (e) {
        logger.trackError('runBootPhase error', {
          bootPhase,
          bootPhaseName: BootPhaseNames[bootPhase],
          errorMessage: e.message,
          errorStack: e.stack,
        });
        lastRunErrored.current = true;
        setBootPhase(bootPhase);
      } finally {
        isRunningRef.current = false;
        setBootCounter((c) => c + 1);
      }
    };

    // if we're stuck trying to scaffold wayfinding, bail
    if (bootPhase === NodeBootPhase.SCAFFOLDING_WAYFINDING) {
      if (!tryingWayfindingSince.current) {
        tryingWayfindingSince.current = Date.now();
      } else if (
        Date.now() - tryingWayfindingSince.current >
        HANDLE_SCAFFOLD_TIMEOUT
      ) {
        logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
          context: 'failed to scaffold personal group',
          during: 'mobile signup (useBootSequence)',
          severity: AnalyticsSeverity.Critical,
        });
        const signedUpWithInvite = Boolean(lureMeta?.id);
        const nextBootPhase = signedUpWithInvite
          ? NodeBootPhase.CHECKING_FOR_INVITE
          : NodeBootPhase.READY;
        setBootPhase(nextBootPhase);
        return;
      }
    }

    // if we're stuck trying to handle invites afte user finishes signing up, bail
    if (
      [
        NodeBootPhase.ACCEPTING_INVITES,
        NodeBootPhase.CHECKING_FOR_INVITE,
      ].includes(bootPhase)
    ) {
      if (!tryingInviteHandling.current) {
        tryingInviteHandling.current = Date.now();
      } else if (
        Date.now() - tryingInviteHandling.current >
        HANDLE_INVITES_TIMEOUT
      ) {
        logger.trackError('accept invites abort', { inviteId: lureMeta?.id });
        setBootPhase(NodeBootPhase.READY);
        return;
      }
    }

    if (![NodeBootPhase.IDLE, NodeBootPhase.READY].includes(bootPhase)) {
      runBootSequence();
    }
  }, [runBootPhase, setBootPhase, bootPhase, bootStepCounter, lureMeta?.id]);

  const resetBootSequence = useCallback(() => {
    setBootPhase(NodeBootPhase.IDLE);
    setReport(null);
    setReservedNode(null);
    isRunningRef.current = false;
    lastRunPhaseRef.current = NodeBootPhase.IDLE;
    lastRunErrored.current = false;
    tryingWayfindingSince.current = null;
    tryingInviteHandling.current = null;

    sequenceStartTimeRef.current = 0;
    lastPhaseCompletedAt.current = null;
  }, []);

  // once finished, set the report
  useEffect(() => {
    if (bootPhase === NodeBootPhase.READY && !report?.completedAt) {
      setReport((prev) => ({
        ...prev,
        startedAt: sequenceStartTimeRef.current,
        completedAt: Date.now(),
        duration: utils.formattedDuration(
          sequenceStartTimeRef.current,
          Date.now()
        ),
      }));
    }
  }, [bootPhase, report]);

  return {
    bootPhase,
    kickOffBootSequence,
    resetBootSequence,
    bootReport: report,
  };
}
